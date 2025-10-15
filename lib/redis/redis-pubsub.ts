/**
 * Redis Pub/Sub helper built on top of the shared redis client.
 * Provides simple helpers for channel and pattern subscriptions with
 * automatic connection lifecycle management.
 */

import type Redis from 'ioredis';

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

import { redis } from './redis-client';

export type SubscribeCallback = (message: string, channel: string) => void;
export type PSubscribeCallback = (
  message: string,
  channel: string,
  pattern: string
) => void;

interface ChannelSubscriber {
  client: Redis;
  handler: (channel: string, message: string) => void;
}

interface PatternSubscriber {
  client: Redis;
  handler: (pattern: string, channel: string, message: string) => void;
}

class SubscriberManager {
  private channelSubscribers = new Map<string, ChannelSubscriber>();
  private channelCallbacks = new Map<string, Set<SubscribeCallback>>();

  private patternSubscribers = new Map<string, PatternSubscriber>();
  private patternCallbacks = new Map<string, Set<PSubscribeCallback>>();

  private createClient(context: { channel?: string; pattern?: string }): Redis {
    const client = redis.getClient().duplicate();

    client.on('error', (error: unknown) => {
      logger.error(
        'redis-pubsub',
        'Subscriber connection error',
        error,
        undefined,
        context
      );
    });

    client.on('reconnecting', () => {
      if (env.NODE_ENV !== 'test') {
        logger.warn(
          'redis-pubsub',
          'Subscriber reconnecting',
          undefined,
          context
        );
      }
    });

    client.on('connect', () => {
      if (env.NODE_ENV !== 'production') {
        logger.info('redis-pubsub', 'Subscriber connected', undefined, context);
      }
    });

    return client;
  }

  async subscribe(channel: string, callback: SubscribeCallback): Promise<void> {
    const callbacks = this.channelCallbacks.get(channel) ?? new Set();
    callbacks.add(callback);
    this.channelCallbacks.set(channel, callbacks);

    if (this.channelSubscribers.has(channel)) {
      return;
    }

    const client = this.createClient({ channel });

    const handler = (ch: string, message: string) => {
      if (ch !== channel) {
        return;
      }

      const registered = this.channelCallbacks.get(channel);
      if (!registered) {
        return;
      }

      for (const cb of registered) {
        try {
          cb(message, channel);
        } catch (error) {
          logger.error(
            'redis-pubsub',
            'Subscriber callback error',
            error,
            undefined,
            { channel }
          );
        }
      }
    };

    client.on('message', handler);

    await client.subscribe(channel);

    this.channelSubscribers.set(channel, { client, handler });
  }

  async unsubscribe(
    channel: string,
    callback?: SubscribeCallback
  ): Promise<void> {
    const callbacks = this.channelCallbacks.get(channel);
    if (!callbacks) {
      return;
    }

    if (callback) {
      callbacks.delete(callback);
    } else {
      callbacks.clear();
    }

    if (callbacks.size > 0) {
      return;
    }

    const subscriber = this.channelSubscribers.get(channel);
    if (!subscriber) {
      return;
    }

    try {
      await subscriber.client.unsubscribe(channel);
    } catch (error) {
      logger.error(
        'redis-pubsub',
        'Failed to unsubscribe channel',
        error,
        undefined,
        { channel }
      );
    }

    subscriber.client.removeListener('message', subscriber.handler);
    subscriber.client.disconnect();

    this.channelSubscribers.delete(channel);
    this.channelCallbacks.delete(channel);
  }

  async psubscribe(
    pattern: string,
    callback: PSubscribeCallback
  ): Promise<void> {
    const callbacks = this.patternCallbacks.get(pattern) ?? new Set();
    callbacks.add(callback);
    this.patternCallbacks.set(pattern, callbacks);

    if (this.patternSubscribers.has(pattern)) {
      return;
    }

    const client = this.createClient({ pattern });

    const handler = (pat: string, channel: string, message: string) => {
      if (pat !== pattern) {
        return;
      }

      const registered = this.patternCallbacks.get(pattern);
      if (!registered) {
        return;
      }

      for (const cb of registered) {
        try {
          cb(message, channel, pattern);
        } catch (error) {
          logger.error(
            'redis-pubsub',
            'Pattern subscriber callback error',
            error,
            undefined,
            { pattern, channel }
          );
        }
      }
    };

    client.on('pmessage', handler);

    await client.psubscribe(pattern);

    this.patternSubscribers.set(pattern, { client, handler });
  }

  async punsubscribe(
    pattern: string,
    callback?: PSubscribeCallback
  ): Promise<void> {
    const callbacks = this.patternCallbacks.get(pattern);
    if (!callbacks) {
      return;
    }

    if (callback) {
      callbacks.delete(callback);
    } else {
      callbacks.clear();
    }

    if (callbacks.size > 0) {
      return;
    }

    const subscriber = this.patternSubscribers.get(pattern);
    if (!subscriber) {
      return;
    }

    try {
      await subscriber.client.punsubscribe(pattern);
    } catch (error) {
      logger.error(
        'redis-pubsub',
        'Failed to unsubscribe pattern',
        error,
        undefined,
        { pattern }
      );
    }

    subscriber.client.removeListener('pmessage', subscriber.handler);
    subscriber.client.disconnect();

    this.patternSubscribers.delete(pattern);
    this.patternCallbacks.delete(pattern);
  }

  async cleanup(): Promise<void> {
    const channelClients = Array.from(this.channelSubscribers.values());
    const patternClients = Array.from(this.patternSubscribers.values());

    await Promise.all(
      channelClients.map(async ({ client }) => {
        try {
          await client.quit();
        } catch (error) {
          logger.error('redis-pubsub', 'Failed to quit channel client', error);
        }
      })
    );

    await Promise.all(
      patternClients.map(async ({ client }) => {
        try {
          await client.quit();
        } catch (error) {
          logger.error('redis-pubsub', 'Failed to quit pattern client', error);
        }
      })
    );

    this.channelSubscribers.clear();
    this.channelCallbacks.clear();
    this.patternSubscribers.clear();
    this.patternCallbacks.clear();
  }
}

const subscriberManager = new SubscriberManager();

export async function publish(
  channel: string,
  message: string | object
): Promise<number> {
  const payload =
    typeof message === 'string' ? message : JSON.stringify(message);

  try {
    const count = await redis.getClient().publish(channel, payload);
    return count;
  } catch (error) {
    logger.error(
      'redis-pubsub',
      `Failed to publish to ${channel}`,
      error,
      undefined,
      { channel }
    );
    throw error;
  }
}

export async function subscribe(
  channel: string,
  callback: SubscribeCallback
): Promise<void> {
  return subscriberManager.subscribe(channel, callback);
}

export async function unsubscribe(
  channel: string,
  callback?: SubscribeCallback
): Promise<void> {
  return subscriberManager.unsubscribe(channel, callback);
}

export async function psubscribe(
  pattern: string,
  callback: PSubscribeCallback
): Promise<void> {
  return subscriberManager.psubscribe(pattern, callback);
}

export async function punsubscribe(
  pattern: string,
  callback?: PSubscribeCallback
): Promise<void> {
  return subscriberManager.punsubscribe(pattern, callback);
}

export async function cleanup(): Promise<void> {
  return subscriberManager.cleanup();
}

if (typeof process !== 'undefined') {
  process.on('SIGTERM', () => {
    cleanup().catch(error => {
      logger.error('redis-pubsub', 'Cleanup failed during SIGTERM', error);
    });
  });
  process.on('SIGINT', () => {
    cleanup().catch(error => {
      logger.error('redis-pubsub', 'Cleanup failed during SIGINT', error);
    });
  });
}
