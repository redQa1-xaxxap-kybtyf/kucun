# 空错误响应问题排查

## 问题描述

浏览器控制台显示：

```
[DEBUG] 更新订单状态 - 服务器错误响应: {}
```

这意味着服务器返回了一个错误状态码（非 200），但响应体是空对象 `{}`。

## 可能的原因

### 1. 服务器端代码在执行前就失败了

- Next.js 路由处理器本身出错
- 中间件或认证层出错
- TypeScript 编译错误

### 2. 服务器端代码抛出了异常，但没有被 catch 块捕获

- `await params` 失败
- `resolveUserId()` 失败
- `parseAndValidateRequest()` 失败但没有返回正确的错误响应

### 3. JSON 序列化失败

- 错误对象包含循环引用
- 错误对象包含无法序列化的字段

## 排查步骤

### 步骤 1: 检查服务器是否真的在运行

打开另一个终端，测试 API 是否可访问：

```bash
# 测试服务器是否在运行
curl http://localhost:3000/api/health

# 或者在浏览器中访问
# http://localhost:3000/api/health
```

如果服务器没有运行，重启：

```bash
npm run dev
```

### 步骤 2: 检查服务器终端输出

查看运行 `npm run dev` 的终端窗口：

**期望看到**:

```
✓ Ready in Xms
○ Local:    http://localhost:3000
✓ Compiled in Xms
```

**如果看到编译错误**:

```
✖ Failed to compile
./app/api/factory-shipments/[id]/status/route.ts
...
```

这说明 TypeScript 编译失败，需要修复编译错误。

### 步骤 3: 检查 Next.js 开发服务器日志

在服务器终端中应该看到我们添加的 `[DEBUG]` 日志。

**如果没有看到任何日志**，说明：

- 请求根本没有到达 PATCH 处理器
- 路由匹配失败
- 中间件拦截了请求

### 步骤 4: 检查浏览器网络标签

1. 打开浏览器开发者工具（F12）
2. 切换到 **Network** 标签
3. 重新尝试确认发货
4. 找到 `status` 请求
5. 查看详细信息：
   - **Request URL**: 应该是 `/api/factory-shipments/{id}/status`
   - **Request Method**: 应该是 `PATCH`
   - **Status Code**: 记录状态码（如 500, 404, 422 等）
   - **Response**: 查看原始响应内容

**示例**:

```
Request URL: http://localhost:3000/api/factory-shipments/abc123/status
Request Method: PATCH
Status Code: 500 Internal Server Error

Response:
{}  // 或者可能是 HTML 错误页面
```

**如果响应是 HTML**，说明：

- Next.js 返回了错误页面而不是 JSON
- 通常是因为服务器端代码崩溃

### 步骤 5: 检查 TypeScript 类型错误

运行类型检查：

```bash
npm run type-check
```

如果有类型错误，修复后重新编译。

### 步骤 6: 临时添加更简单的测试端点

创建一个简单的测试端点来验证路由是否工作：

在 `app/api/factory-shipments/[id]/status/route.ts` 的最开始添加：

```typescript
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return NextResponse.json({
    test: 'ok',
    orderId: id,
    timestamp: new Date().toISOString(),
  });
}
```

然后在浏览器中访问：

```
http://localhost:3000/api/factory-shipments/test123/status
```

**如果能看到 JSON 响应**，说明路由正常，问题出在 PATCH 处理器内部。

**如果看到 404**，说明路由配置有问题。

## 常见问题和解决方案

### 问题 1: `await params` 失败

**错误信息**: `params is not a promise`

**原因**: Next.js 版本问题，旧版本中 params 不是 Promise

**解决方案**:

```typescript
// 检查 Next.js 版本
// package.json 中应该是 "next": "^15.4.0" 或更高

// 如果版本低于 15，使用：
const { id } = params;

// 如果版本是 15+，使用：
const { id } = await params;
```

### 问题 2: 认证失败但没有返回错误

**原因**: `auth()` 函数抛出异常而不是返回 null

**解决方案**: 在 `resolveUserId()` 中添加 try-catch

```typescript
async function resolveUserId(): Promise<string | null> {
  try {
    const session = await auth();
    return session?.user?.id ?? null;
  } catch (error) {
    console.error('[DEBUG] 认证失败:', error);
    return null;
  }
}
```

### 问题 3: Prisma 连接失败

**错误信息**: 可能没有明确的错误信息

**解决方案**: 检查数据库连接

```bash
# 检查 .env 文件中的 DATABASE_URL
# 确保数据库文件存在

# 重新生成 Prisma Client
npx prisma generate

# 推送数据库架构
npx prisma db push
```

### 问题 4: JSON 序列化失败

**原因**: 尝试序列化包含循环引用或特殊对象的数据

**解决方案**: 在返回响应前打印对象

```typescript
try {
  const result = someOperation();
  console.log('[DEBUG] 准备返回的数据:', JSON.stringify(result));
  return NextResponse.json(result);
} catch (error) {
  console.error('[DEBUG] JSON 序列化失败:', error);
  // 返回简化的响应
  return NextResponse.json(
    {
      error: '服务器错误',
      message: error instanceof Error ? error.message : '未知错误',
    },
    { status: 500 }
  );
}
```

## 下一步

1. ✅ 检查服务器终端是否有 `[DEBUG]` 日志输出
2. ✅ 检查浏览器 Network 标签的详细信息
3. ✅ 运行 `npm run type-check` 检查类型错误
4. ✅ 如果仍然没有线索，添加 GET 测试端点验证路由
5. ✅ 将服务器终端的**完整输出**截图或复制下来

## 快速测试命令

```bash
# 1. 检查 Next.js 版本
npm list next

# 2. 检查类型错误
npm run type-check

# 3. 检查 ESLint 错误
npm run lint

# 4. 重新生成 Prisma Client
npx prisma generate

# 5. 重启开发服务器（清除缓存）
rm -rf .next
npm run dev
```
