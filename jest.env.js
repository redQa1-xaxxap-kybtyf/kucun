/**
 * Jest 运行前置环境变量
 * 在测试框架初始化和任何模块加载之前执行
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// Polyfills for MSW / undici in Jest (jsdom) environment
// Some Jest/jsdom environments don't expose TextEncoder/TextDecoder by default.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { TextDecoder, TextEncoder } = require('util');
  if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = TextEncoder;
  }
  if (typeof global.TextDecoder === 'undefined') {
    global.TextDecoder = TextDecoder;
  }
} catch (error) {
  if (process.env.JEST_LOG_ENV === 'true') {
    // eslint-disable-next-line no-console
    console.log('Jest env util polyfill failed:', error);
  }
}

// Polyfills for Web Streams (undici/MSW expects ReadableStream in Node)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const webStreams = require('stream/web');
  if (typeof global.ReadableStream === 'undefined') {
    global.ReadableStream = webStreams.ReadableStream;
  }
  if (typeof global.WritableStream === 'undefined') {
    global.WritableStream = webStreams.WritableStream;
  }
  if (typeof global.TransformStream === 'undefined') {
    global.TransformStream = webStreams.TransformStream;
  }
} catch (error) {
  if (process.env.JEST_LOG_ENV === 'true') {
    // eslint-disable-next-line no-console
    console.log('Jest env web streams polyfill failed:', error);
  }
}

// Polyfills for MessageChannel/MessagePort (undici expects MessagePort in Node)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const workerThreads = require('worker_threads');
  if (typeof global.MessageChannel === 'undefined') {
    global.MessageChannel = workerThreads.MessageChannel;
  }
  if (typeof global.MessagePort === 'undefined') {
    global.MessagePort = workerThreads.MessagePort;
  }
  if (typeof global.BroadcastChannel === 'undefined') {
    global.BroadcastChannel = workerThreads.BroadcastChannel;
  }
} catch (error) {
  if (process.env.JEST_LOG_ENV === 'true') {
    // eslint-disable-next-line no-console
    console.log('Jest env worker threads polyfill failed:', error);
  }
}

// Polyfills for fetch APIs (MSW depends on them in Node/JSDOM tests)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const undici = require('undici');
  const targets = new Set();
  // In jest-environment-jsdom, globals may live on `global`, `globalThis`, and/or `window`.
  // Set polyfills on all available targets to ensure unqualified global lookups work.
  if (typeof global !== 'undefined') targets.add(global);
  if (typeof globalThis !== 'undefined') targets.add(globalThis);
  if (typeof window !== 'undefined') targets.add(window);
  if (typeof global !== 'undefined' && global.window)
    targets.add(global.window);

  const defineIfMissing = (target, key, value) => {
    if (typeof target[key] !== 'undefined') return;
    try {
      Object.defineProperty(target, key, {
        value,
        writable: true,
        configurable: true,
      });
    } catch {
      // fallback
      try {
        target[key] = value;
      } catch {
        // ignore
      }
    }
  };

  for (const target of targets) {
    defineIfMissing(target, 'fetch', undici.fetch);
    defineIfMissing(target, 'Headers', undici.Headers);
    defineIfMissing(target, 'Request', undici.Request);
    defineIfMissing(target, 'Response', undici.Response);
    defineIfMissing(target, 'FormData', undici.FormData);
  }
} catch (error) {
  if (process.env.JEST_LOG_ENV === 'true') {
    // eslint-disable-next-line no-console
    console.log('Jest env undici polyfill failed:', error);
  }
}

const defaultDatabaseUrl =
  'mysql://root:root@localhost:3306/kucun_dev?connection_limit=5&pool_timeout=30&connect_timeout=10';

process.env.DATABASE_URL = process.env.DATABASE_URL || defaultDatabaseUrl;

if (process.env.JEST_LOG_ENV === 'true') {
  // eslint-disable-next-line no-console
  console.log('Jest env DATABASE_URL:', process.env.DATABASE_URL);
  // eslint-disable-next-line no-console
  console.log('Jest env globals:', {
    fetch: typeof fetch,
    Response: typeof Response,
    globalResponse: typeof global.Response,
    globalThisResponse: typeof globalThis.Response,
  });
}

process.env.NEXTAUTH_SECRET =
  process.env.NEXTAUTH_SECRET ||
  'test-secret-key-for-jest-should-be-longer-than-32-chars-123';
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
