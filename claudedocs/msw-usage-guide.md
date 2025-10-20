# MSW (Mock Service Worker) 使用指南

> ⚠️ **注意**: 本项目已决定不使用MSW，改为使用Jest Mock。本文档仅作为参考保留。

## MSW 2.x 在 Jest 环境中的复杂性

### 为什么放弃MSW？

1. **Node.js环境兼容性问题**
   - MSW 2.x 依赖浏览器Fetch API（Response, Request等）
   - Node.js需要额外polyfill（undici, whatwg-fetch）
   - 引入polyfill后会触发更多依赖问题（TextEncoder, ReadableStream等）

2. **ES模块转换问题**
   - MSW及其依赖包使用ES模块语法
   - Jest默认不转换node_modules
   - 需要复杂的transformIgnorePatterns配置
   - until-async、@bundled-es-modules等包难以正确转换

3. **配置复杂度**
   - 需要修改jest.config.js的transformIgnorePatterns
   - 需要在jest.setup.js中添加多个polyfill
   - 需要创建server.ts、handlers.ts等配置文件
   - 每个测试文件需要正确启动/停止MSW server

4. **维护成本**
   - MSW版本更新可能破坏配置
   - 与其他测试工具的兼容性问题
   - 团队学习成本较高

## 推荐方案：Jest Mock

### 优势

- ✅ 原生Jest功能，无需额外依赖
- ✅ 配置简单，学习成本低
- ✅ 与现有测试基础设施完美兼容
- ✅ 性能更好（不需要拦截网络请求）

### 示例实现

```typescript
// __tests__/unit/inventory/api/inbound-submit.test.tsx

// Mock Next.js API helpers
jest.mock('@/lib/api/with-auth', () => ({
  withAuth: (handler: any) => handler,
}));

jest.mock('@/lib/api/error-handler', () => ({
  handleApiError: jest.fn(error => {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
}));

// Mock Prisma client
const mockPrisma = {
  inboundRecord: {
    create: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

describe('API: POST /api/inventory/inbound', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应成功创建入库记录', async () => {
    mockPrisma.inboundRecord.create.mockResolvedValue({
      id: 'test-id',
      // ... 其他字段
    });

    const response = await POST(
      new Request('http://localhost:3000/api/inventory/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // ... 测试数据
        }),
      })
    );

    expect(response.status).toBe(200);
  });

  it('应返回422错误当数据无效', async () => {
    const response = await POST(
      new Request('http://localhost:3000/api/inventory/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invalidField: 'invalid',
        }),
      })
    );

    expect(response.status).toBe(422);
  });
});
```

## MSW安装记录（已回滚）

### 安装的包（已卸载）

```json
{
  "devDependencies": {
    "msw": "^2.11.5",
    "undici": "^7.16.0",
    "whatwg-fetch": "^3.6.20"
  }
}
```

### 创建的文件（已删除）

- `__mocks__/server.ts`
- `__mocks__/handlers.ts`
- `__tests__/examples/msw-example.test.ts`

### jest.setup.js修改（已回滚）

```javascript
// 尝试添加的polyfills（已删除）
const { fetch, Request, Response, Headers } = require('undici');
const { TextEncoder, TextDecoder } = require('util');
const { ReadableStream, TransformStream } = require('node:stream/web');
```

### jest.config.js修改（已回滚）

```javascript
// 尝试的transformIgnorePatterns（已恢复到原配置）
transformIgnorePatterns: [
  'node_modules/(?!(@faker-js|msw|@mswjs|@bundled-es-modules|until-async|@open-draft|statuses))',
];
```

## 结论

对于当前项目的测试需求，**Jest Mock是更合适的选择**：

- 功能完全满足需求（模拟API响应）
- 配置简单，无兼容性问题
- 性能更好，维护成本更低
- 团队更容易理解和使用

MSW更适合：

- 需要真实的浏览器环境
- 需要拦截实际的网络请求
- 需要在开发环境中使用
- 团队已有MSW经验

## 参考资源

- [Jest Mock Functions](https://jestjs.io/docs/mock-functions)
- [Testing Next.js API Routes](https://nextjs.org/docs/pages/building-your-application/testing#jest-and-react-testing-library)
- [MSW官方文档](https://mswjs.io/)（如未来考虑使用）
