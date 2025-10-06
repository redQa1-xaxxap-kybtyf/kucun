import { WebSocketServer, type WebSocket } from 'ws';

import { initializeCacheSystem, setWsEventEmitter } from '@/lib/cache';
import { isDevelopment, wsConfig } from '@/lib/env';
import { redis } from '@/lib/redis/redis-client';
import { logger } from '@/lib/utils/console-logger';
import { verifyWebSocketAuth } from '@/lib/ws/ws-auth';

interface ClientInfo {
  socket: WebSocket;
  channels: Set<string>;
  userId?: string;
}

interface ServerApi {
  ensureStarted(): void;
  publish<T extends object>(channel: string, payload: T): void;
}

/**
 * 全局符号，用于单例模式
 */
const globalKey = Symbol.for('kucun.ws.server');

/**
 * 全局对象类型定义
 */
interface GlobalWithWsServer {
  [key: symbol]: ServerApi;
}

const g = globalThis as GlobalWithWsServer;

function createServer(): ServerApi {
  let wss: WebSocketServer | null = null;
  const channels = new Map<string, Set<WebSocket>>();
  const clients = new Set<ClientInfo>();

  // Redis 订阅客户端用于跨实例通信
  let redisSubscriber: ReturnType<typeof redis.getClient> | null = null;
  let redisPublisher: ReturnType<typeof redis.getClient> | null = null;

  // 优雅关闭函数
  function gracefulShutdown() {
    logger.info('ws-server', '开始优雅关闭 WebSocket 服务器...');

    // 关闭所有客户端连接
    clients.forEach(client => {
      try {
        client.socket.close(1001, '服务器关闭');
      } catch (error) {
        logger.error('ws-server', '关闭客户端连接失败:', error);
      }
    });
    clients.clear();

    // 取消所有 Redis 订阅
    if (redisSubscriber) {
      try {
        redisSubscriber.unsubscribe();
        redisSubscriber.quit();
      } catch (error) {
        logger.error('ws-server', '关闭 Redis 订阅客户端失败:', error);
      }
      redisSubscriber = null;
    }

    // 关闭 Redis 发布客户端
    if (redisPublisher) {
      try {
        redisPublisher.quit();
      } catch (error) {
        logger.error('ws-server', '关闭 Redis 发布客户端失败:', error);
      }
      redisPublisher = null;
    }

    // 关闭 WebSocket 服务器
    if (wss) {
      wss.close(() => {
        logger.info('ws-server', 'WebSocket 服务器已关闭');
      });
      wss = null;
    }

    // 清理频道映射
    channels.clear();
  }

  function initializeServer() {
    try {
      if (wss) {
        return;
      } // Already initialized

      wss = new WebSocketServer({ port: wsConfig.port });
      redisSubscriber = redis.getClient();
      redisPublisher = redis.getClient();

      if (isDevelopment) {
        console.log(
          `🔌 WebSocket server starting on ws://localhost:${wsConfig.port}`
        );
      }

      // 初始化缓存系统（Pub/Sub 订阅）
      initializeCacheSystem();

      // 设置 WebSocket 事件发射器，将缓存事件转发到 WebSocket
      setWsEventEmitter(event => {
        // 根据事件类型确定频道
        let channel = 'system';
        if (event.type === 'data:update') {
          channel = event.resource;
        } else if (event.type === 'inventory:change') {
          channel = 'inventory';
        } else if (event.type === 'order:status') {
          channel = 'orders';
        } else if (event.type === 'finance:change') {
          channel = 'finance';
        }

        // 广播到所有订阅该频道的客户端
        broadcast(channel, event);
      });

      setupWebSocketHandlers();

      // 注册进程退出事件监听器（仅在首次初始化时注册）
      if (typeof process !== 'undefined') {
        process.once('SIGTERM', gracefulShutdown);
        process.once('SIGINT', gracefulShutdown);
        process.once('beforeExit', gracefulShutdown);
      }
    } catch (error) {
      console.error('Failed to initialize WebSocket server:', error);
      throw error;
    }
  }

  function broadcast(channel: string, message: unknown) {
    const payload = JSON.stringify({
      channel,
      data: message,
      ts: Date.now(),
    });
    channels.get(channel)?.forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        ws.send(payload);
      }
    });
  }

  function setupWebSocketHandlers() {
    if (!wss || !redisSubscriber || !redisPublisher) {
      return;
    }

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

    // 处理来自 Redis 的消息
    redisSubscriber.on('message', (redisChannel: string, message: string) => {
      if (redisChannel.startsWith('ws:')) {
        const channel = redisChannel.slice(3); // 移除 'ws:' 前缀
        try {
          const data = JSON.parse(message);
          broadcast(channel, data);
        } catch (error) {
          logger.error('ws-server', '解析Redis消息失败:', error);
        }
      }
    });

    wss.on('connection', async (socket, request) => {
      // Origin check
      if (wsConfig.allowedOrigins.length > 0) {
        const origin = request.headers.origin || '';
        if (!wsConfig.allowedOrigins.includes(origin)) {
          socket.close(1008, '禁止的来源');
          return;
        }
      }

      // Auth - 使用内部 JWT 验证，避免 HTTP 往返
      const auth = await verifyWebSocketAuth(request.headers.cookie);
      if (!auth.authenticated) {
        socket.close(1008, auth.error || '未授权');
        logger.warn('ws-server', 'WebSocket 连接被拒绝:', auth.error);
        return;
      }

      const client: ClientInfo = {
        socket,
        channels: new Set(),
        userId: auth.userId,
      };
      clients.add(client);

      // 记录连接信息
      logger.info(
        'ws-server',
        `WebSocket 连接建立: userId=${auth.userId}, username=${auth.username}`
      );

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
          if (msg.type === 'subscribe') {
            subscribe(client, msg.channel);
          }
          if (msg.type === 'unsubscribe') {
            unsubscribe(client, msg.channel);
          }
        } catch {
          // ignore
        }
      });

      socket.on('close', () => {
        // 清理心跳定时器
        clearInterval(interval);
        // 清理所有订阅的频道
        client.channels.forEach(ch => channels.get(ch)?.delete(socket));
        // 从客户端集合中移除
        clients.delete(client);
      });
    });

    if (isDevelopment) {
      console.log(
        `🔌 WebSocket server listening on ws://localhost:${wsConfig.port}`
      );
    }
  }

  return {
    ensureStarted() {
      initializeServer();
    },
    publish(channel, payload) {
      // 确保服务器已初始化
      if (!redisPublisher) {
        initializeServer();
      }
      // 本地广播
      broadcast(channel, payload);
      // 通过 Redis 发布到其他实例
      if (redisPublisher) {
        redisPublisher.publish(`ws:${channel}`, JSON.stringify(payload));
      }
    },
  };
}

export const wsServer: ServerApi =
  g[globalKey] ?? (g[globalKey] = createServer());

export function publishWs<T extends object>(channel: string, payload: T): void {
  wsServer.publish(channel, payload);
}
