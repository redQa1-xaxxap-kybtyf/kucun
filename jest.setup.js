/**
 * Jest全局设置文件
 * 在所有测试运行前执行
 */

/**
 * Jest全局设置文件
 * 在所有测试运行前执行
 */

// 导入jest-dom扩展匹配器
import '@testing-library/jest-dom';

// Mock encoding 模块（Next.js response-cache 依赖）
jest.mock('encoding', () => ({
  convert: () => undefined,
}));

// 设置环境变量
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.NEXTAUTH_SECRET = 'test-secret-key-for-jest';
process.env.NEXTAUTH_URL = 'http://localhost:3000';

// Mock next/router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    };
  },
  usePathname() {
    return '/';
  },
  useSearchParams() {
    return new URLSearchParams();
  },
}));

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: {
      user: {
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin',
      },
    },
    status: 'authenticated',
  })),
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: jest.fn(() =>
    Promise.resolve({
      user: {
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
        username: 'testuser',
      },
    })
  ),
  default: jest.fn(() => ({})),
}));

// 全局测试工具函数
global.mockConsoleError = () => {
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });
};

global.mockConsoleWarn = () => {
  const originalWarn = console.warn;
  beforeAll(() => {
    console.warn = jest.fn();
  });
  afterAll(() => {
    console.warn = originalWarn;
  });
};

// 设置测试超时
jest.setTimeout(10000);

// 清理函数
afterEach(() => {
  jest.clearAllMocks();
  // 清理所有定时器
  jest.clearAllTimers();
});

// 在所有测试后清理
afterAll(async () => {
  // 确保关闭所有打开的连接
  jest.restoreAllMocks();
  // 清理所有定时器
  jest.clearAllTimers();
  // 强制清理所有异步操作
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Mock @faker-js/faker to avoid ES module issues
jest.mock('@faker-js/faker', () => ({
  faker: {
    string: {
      uuid: () => `mock-uuid-${Math.random().toString(36).substr(2, 9)}`,
      alphanumeric: length => 'A'.repeat(length),
    },
    number: {
      int: ({ min = 0, max = 100 } = {}) =>
        Math.floor(Math.random() * (max - min + 1)) + min,
      float: ({ min = 0, max = 100, fractionDigits = 2 } = {}) =>
        parseFloat((Math.random() * (max - min) + min).toFixed(fractionDigits)),
    },
    helpers: {
      maybe: (fn, { probability = 0.5 } = {}) =>
        Math.random() < probability ? fn() : undefined,
      arrayElement: array => array[Math.floor(Math.random() * array.length)],
    },
    commerce: {
      productName: () => '测试产品',
    },
    location: {
      streetAddress: () => '测试地址123号',
    },
    date: {
      recent: () => new Date(),
      past: () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
    color: {
      rgb: () => '#FF0000',
      human: () => '红色',
    },
  },
}));
