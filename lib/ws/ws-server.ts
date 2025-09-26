import { WebSocketServer, type WebSocket } from 'ws';

import { appConfig, isDevelopment, wsConfig } from '@/lib/env';

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

  function subscribe(client: ClientInfo, channel: string) {
    if (!channels.has(channel)) channels.set(channel, new Set());
    channels.get(channel)?.add(client.socket);
    client.channels.add(channel);
  }

  function unsubscribe(client: ClientInfo, channel: string) {
    channels.get(channel)?.delete(client.socket);
    client.channels.delete(channel);
  }

  function broadcast(channel: string, message: unknown) {
    const payload = JSON.stringify({ channel, data: message, ts: Date.now() });
    channels.get(channel)?.forEach(ws => {
      if (ws.readyState === ws.OPEN) ws.send(payload);
    });
  }

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
        socket.close(1008, 'Origin not allowed');
        return;
      }
    }

    // Auth
    const auth = await isAuthenticated(request.headers.cookie);
    if (!auth.ok) {
      socket.close(1008, 'Unauthorized');
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
      broadcast(channel, payload);
    },
  };
}

export const wsServer: ServerApi =
  g[globalKey] ?? (g[globalKey] = createServer());

export function publishWs<T extends object>(channel: string, payload: T): void {
  wsServer.publish(channel, payload);
}
