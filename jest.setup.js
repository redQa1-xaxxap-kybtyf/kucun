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
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'mysql://root:root@localhost:3306/kucun_dev?connection_limit=5&pool_timeout=30&connect_timeout=10';
process.env.NEXTAUTH_SECRET =
  process.env.NEXTAUTH_SECRET ||
  'test-secret-key-for-jest-should-be-longer-than-32-chars-123';
process.env.NEXTAUTH_URL = 'http://localhost:3000';

// Mock next/router
jest.mock('next/navigation', () => {
  const actual = jest.requireActual('next/navigation');
  return {
    ...actual,
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
    redirect: jest.fn(url => {
      throw new Error(`redirected:${url}`);
    }),
  };
});

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
        role: 'admin',
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

if (typeof global.setImmediate === 'undefined') {
  global.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
}

// Mock @faker-js/faker to avoid ES module issues
jest.mock('@faker-js/faker', () => {
  const randomWord = prefix =>
    `${prefix}-${Math.random().toString(36).substring(2, 10)}`;

  return {
    faker: {
      string: {
        uuid: () => `mock-uuid-${Math.random().toString(36).substring(2, 11)}`,
        alphanumeric: length =>
          Array.from(
            { length },
            () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]
          ).join(''),
      },
      number: {
        int: ({ min = 0, max = 100 } = {}) =>
          Math.floor(Math.random() * (max - min + 1)) + min,
        float: ({ min = 0, max = 100, fractionDigits = 2 } = {}) =>
          parseFloat(
            (Math.random() * (max - min) + min).toFixed(fractionDigits)
          ),
      },
      helpers: {
        maybe: (fn, { probability = 0.5 } = {}) =>
          Math.random() < probability ? fn() : undefined,
        arrayElement: array => array[Math.floor(Math.random() * array.length)],
      },
      internet: {
        email: () => `${randomWord('user')}@example.com`,
        userName: () => randomWord('user'),
      },
      person: {
        fullName: () => `测试用户-${randomWord('name')}`,
      },
      phone: {
        number: () => `138${Math.floor(10000000 + Math.random() * 89999999)}`,
      },
      company: {
        name: () => `测试公司-${randomWord('corp')}`,
      },
      location: {
        streetAddress: () => `测试地址-${randomWord('road')}号`,
      },
      commerce: {
        productName: () => `测试产品-${randomWord('product')}`,
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
  };
});
