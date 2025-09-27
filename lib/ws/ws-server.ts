import { WebSocketServer, type WebSocket } from 'ws';

import { appConfig, isDevelopment, wsConfig } from '@/lib/env';
import { redis } from '@/lib/redis/redis-client';

interface ClientInfo {
  socket: WebSocket;
  channels: Set<string>;
  userId?: string;
}

interface ServerApi {
  ensureStarted(): void;
  publish<T extends object>(channel: string, payload: T): void;
}

const globalKey = Symbol.for('kucun.ws.server');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;

function createServer(): ServerApi {
  const wss = new WebSocketServer({ port: wsConfig.port });
  const channels = new Map<string, Set<WebSocket>>();
  const clients = new Set<ClientInfo>();

  // Redis 订阅客户端用于跨实例通信
  const redisSubscriber = redis.getClient();
  const redisPublisher = redis.getClient();

  function subscribe(client: ClientInfo, channel: string) {
    if (!channels.has(channel)) {
      channels.set(channel, new Set());
      // 首次订阅该频道时，订阅 Redis 频道
      redisSubscriber.subscribe(`ws:${channel}`);
    }
    channels.get(channel)?.add(client.socket);
    client.channels.add(channel);
  }

  function unsubscribe(client: ClientInfo, channel: string) {
    channels.get(channel)?.delete(client.socket);
    client.channels.delete(channel);

    // 如果该频道没有客户端了，取消 Redis 订阅
    if (channels.get(channel)?.size === 0) {
      channels.delete(channel);
      redisSubscriber.unsubscribe(`ws:${channel}`);
    }
  }

  function broadcast(channel: string, message: unknown) {
    const payload = JSON.stringify({ channel, data: message, ts: Date.now() });
    channels.get(channel)?.forEach(ws => {
      if (ws.readyState === ws.OPEN) ws.send(payload);
    });
  }

  // 处理来自 Redis 的消息
  redisSubscriber.on('message', (redisChannel: string, message: string) => {
    if (redisChannel.startsWith('ws:')) {
      const channel = redisChannel.slice(3); // 移除 'ws:' 前缀
      try {
        const data = JSON.parse(message);
        broadcast(channel, data);
      } catch (error) {
        console.error('解析Redis消息失败:', error);
      }
    }
  });

  // Simple auth: verify Next-Auth session via internal fetch using request cookies
  async function isAuthenticated(
    cookieHeader: string | undefined
  ): Promise<{ ok: boolean; userId?: string }> {
    if (!cookieHeader) return { ok: false };
    try {
      const res = await fetch(
        `http://localhost:${appConfig.port}/api/auth/session`,
        {
          headers: { cookie: cookieHeader },
        }
      );
      if (!res.ok) return { ok: false };
      const json = (await res.json()) as { user?: { id?: string } };
      return json?.user?.id
        ? { ok: true, userId: json.user.id }
        : { ok: false };
    } catch {
      return { ok: false };
    }
  }

  wss.on('connection', async (socket, request) => {
    // Origin check
    if (wsConfig.allowedOrigins.length > 0) {
      const origin = request.headers.origin || '';
      if (!wsConfig.allowedOrigins.includes(origin)) {
        socket.close(1008, '禁止的来源');
        return;
      }
    }

    // Auth
    const auth = await isAuthenticated(request.headers.cookie);
    if (!auth.ok) {
      socket.close(1008, '未授权');
      return;
    }

    const client: ClientInfo = {
      socket,
      channels: new Set(),
      userId: auth.userId,
    };
    clients.add(client);

    // Heartbeat
    let alive = true;
    socket.on('pong', () => {
      alive = true;
    });
    const interval = setInterval(() => {
      if (!alive) {
        socket.terminate();
        clearInterval(interval);
        return;
      }
      alive = false;
      try {
        socket.ping();
      } catch {
        /* noop */
      }
    }, 25_000);

    socket.on('message', data => {
      try {
        const msg = JSON.parse(String(data)) as {
          type: 'subscribe' | 'unsubscribe';
          channel: string;
        };
        if (msg.type === 'subscribe') subscribe(client, msg.channel);
        if (msg.type === 'unsubscribe') unsubscribe(client, msg.channel);
      } catch {
        // ignore
      }
    });

    socket.on('close', () => {
      client.channels.forEach(ch => channels.get(ch)?.delete(socket));
      clients.delete(client);
      clearInterval(interval);
    });
  });

  if (isDevelopment) {
    // eslint-disable-next-line no-console
    console.log(
      `🔌 WebSocket server listening on ws://localhost:${wsConfig.port}`
    );
  }

  return {
    ensureStarted() {
      // server already started
    },
    publish(channel, payload) {
      // 本地广播
      broadcast(channel, payload);
      // 通过 Redis 发布到其他实例
      redisPublisher.publish(`ws:${channel}`, JSON.stringify(payload));
    },
  };
}

export const wsServer: ServerApi =
  g[globalKey] ?? (g[globalKey] = createServer());

export function publishWs<T extends object>(channel: string, payload: T): void {
  wsServer.publish(channel, payload);
}
