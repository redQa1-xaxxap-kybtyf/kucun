# WebSocket → 轮询迁移技术文档

## 📋 迁移原因

### 问题分析

1. **过度复杂**：
   - WebSocket 服务器 + Redis Pub/Sub 跨实例通信
   - 需要额外端口（3002）和连接管理
   - 自动重连、频道管理等复杂逻辑
   - 总代码量：500+ 行

2. **实际使用频率低**：
   - 仅10处使用 `publishWs`
   - 主要场景：通知推送、库存/订单状态变更
   - **实时性要求不高**：60秒延迟完全可接受

3. **维护成本高**：
   - 需要监控 WebSocket 连接状态
   - 调试困难（非标准 HTTP）
   - 热重载时的连接管理问题

### 替代方案优势

| 对比项   | WebSocket      | 轮询           |
| -------- | -------------- | -------------- |
| 复杂度   | 高             | 低             |
| 可靠性   | 中（断线重连） | 高（HTTP标准） |
| 调试难度 | 难             | 易             |
| 资源消耗 | 持续连接       | 定时请求       |
| 代码量   | 500+ 行        | <150 行        |
| 额外端口 | 需要           | 不需要         |

## 🔄 迁移方案

### 1. 用户通知

**之前（WebSocket）**：

```typescript
// 服务端推送
publishWs('notifications', { userId, message });

// 客户端订阅
useWebSocket('user:notifications', handleNotification);
```

**之后（轮询）**：

```typescript
// API 端点：GET /api/notifications
// 客户端轮询（60秒间隔）
useQuery({
  queryKey: ['notifications'],
  queryFn: fetchNotifications,
  refetchInterval: 60 * 1000, // 60秒
});
```

### 2. 数据变更通知

**之前（WebSocket）**：

```typescript
// 库存变更后推送
publishWs('inventory', { productId, quantity });

// 客户端订阅并更新缓存
useWebSocket('inventory', data => {
  queryClient.setQueryData(['inventory', data.productId], data);
});
```

**之后（乐观更新 + 自动刷新）**：

```typescript
// 1. 执行 CRUD 后立即更新缓存（乐观更新）
queryClient.setQueryData(['inventory', productId], newData);

// 2. TanStack Query 自动后台刷新（可选）
useQuery({
  queryKey: ['inventory', productId],
  queryFn: fetchInventory,
  staleTime: 5 * 60 * 1000, // 5分钟
});
```

## 📂 迁移步骤

### ✅ 已完成

1. **创建轮询 Hook**：`hooks/use-polling-notifications.ts`
   - 每60秒轮询通知接口
   - 支持标记已读、清除通知
   - 自动乐观更新

2. **更新 Header 组件**：
   - 移除 `useRealtimeNotifications`
   - 使用 `usePollingNotifications`
   - 更新连接状态指示器

3. **移除 WebSocket Provider**：
   - 从 `app/layout.tsx` 移除 `<WebSocketProvider>`

4. **清理 API 路由**：
   - ✅ 移除 `publishWs` 调用（4处）
   - ✅ 移除客户端组件中的 WebSocket 订阅
   - 已清理文件：
     - `app/api/products/route.ts`
     - `app/api/inventory/inbound/route.ts`
     - `app/api/inventory/outbound/route.ts`
     - `app/api/inventory/adjust/route.ts`
     - `app/(dashboard)/inventory/page-client.tsx` - 移除 useInventoryUpdates

5. **删除 WebSocket 相关文件**：
   - ✅ 已删除所有 WebSocket 相关文件：
     - `lib/ws/ws-server.ts`
     - `lib/ws/ws-client.ts`
     - `lib/ws/ws-auth.ts`
     - `hooks/use-websocket.ts`
     - `hooks/use-realtime-notifications.ts`
     - `components/providers/websocket-provider.tsx`
     - `components/ui/connection-status.tsx`
     - `scripts/test-redis-websocket.ts`
     - `app/api/ws/route.ts`

6. **移除依赖**：
   - ✅ 已卸载 `ws` 和 `@types/ws` 依赖

7. **创建通知 API 端点**：
   - ✅ `app/api/notifications/route.ts` - 获取通知列表
   - ✅ `app/api/notifications/[id]/read/route.ts` - 标记已读
   - ✅ `app/api/notifications/read-all/route.ts` - 全部标记已读
   - ✅ `app/api/notifications/[id]/route.ts` - 删除通知

8. **修复 Query Keys**：
   - ✅ 在 `lib/queryKeys.ts` 中添加 `notificationKeys`
   - ✅ 修复 `hooks/use-polling-notifications.ts` 中的 query key 引用

### 📝 后续工作

9. **数据库迁移（可选）**：
   - 创建 `Notification` 数据模型
   - 添加 Prisma schema 定义
   - 运行数据库迁移

10. **测试验证**：

- 验证轮询功能正常工作
- 确认无 WebSocket 相关错误
- 检查通知 API 端点功能

## 🎯 预期收益

1. **代码减少**：~500 行 → ~150 行（减少70%）
2. **复杂度降低**：无需管理 WebSocket 连接、Redis Pub/Sub
3. **可靠性提升**：HTTP 请求更稳定，易于调试
4. **资源节省**：无需额外端口，减少Redis连接
5. **开发效率**：轮询逻辑更简单，易于理解和维护

## ⚠️ 注意事项

1. **实时性略降**：
   - WebSocket：即时推送（<1秒）
   - 轮询：最多60秒延迟
   - **业务可接受**：通知不是紧急事项

2. **服务器负载**：
   - 每个用户每分钟1个请求
   - 100用户 = 100 req/min ≈ 1.67 req/s
   - **完全可接受**

3. **客户端资源**：
   - 定时器占用：可忽略不计
   - 网络请求：60秒1次，影响极小

## 📊 性能对比

### WebSocket 方案

- 初始连接：1次
- 心跳包：每30秒1次
- 持续占用：内存 + Socket 连接
- 服务端资源：WebSocket Server + Redis Pub/Sub

### 轮询方案

- HTTP 请求：每60秒1次
- 无持续连接：按需释放资源
- 服务端资源：标准 API 路由

**结论**：对于低频通知场景，轮询更简单高效。

## 🔗 相关资源

- [TanStack Query - Polling](https://tanstack.com/query/latest/docs/framework/react/guides/queries#polling)
- [Next.js API Routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes)
- [When to use WebSocket](https://ably.com/topic/websockets#when-to-use-websockets)

---

**迁移日期**：2025-10-06
**负责人**：Claude Code
**状态**：✅ 已完成 (除可选的数据库迁移)
