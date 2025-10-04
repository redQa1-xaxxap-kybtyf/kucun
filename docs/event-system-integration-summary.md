# 事件系统集成总结

## 🎉 已完成的集成工作

### 1. 库存相关 API ✅

#### `app/api/inventory/adjust/route.ts`

**集成内容**:

- 添加 `publishInventoryChange` 导入
- 在库存调整后发布 `inventory:change` 事件
- 包含完整的库存变更信息（产品名、旧数量、新数量、原因、操作员）

**代码示例**:

```typescript
await publishInventoryChange({
  action: 'adjust',
  productId: validatedData.productId,
  productName: result.inventory.product.name,
  oldQuantity: result.adjustment.beforeQuantity,
  newQuantity: result.adjustment.afterQuantity,
  reason: validatedData.reason,
  operator: user.name || user.username,
  userId: user.id,
});
```

#### `app/api/inventory/outbound/route.ts`

**集成内容**:

- 添加 `publishInventoryChange` 导入
- 修改事务函数返回 `{ inventory, oldQuantity }` 以提供变更数据
- 在出库后发布 `inventory:change` 事件

**代码示例**:

```typescript
await publishInventoryChange({
  action: 'outbound',
  productId,
  productName: result.inventory.product.name,
  oldQuantity: result.oldQuantity,
  newQuantity: result.inventory.quantity,
  reason: validatedData.reason,
  operator: user.name || user.username,
  userId: user.id,
});
```

---

### 2. 订单相关 API ✅

#### `app/api/sales-orders/[id]/route.ts`

**集成内容**:

- 添加 `publishOrderStatus` 导入
- 在订单状态更新后发布 `order:status` 事件
- 包含订单类型、订单号、旧状态、新状态、客户信息

**代码示例**:

```typescript
await publishOrderStatus({
  orderType: 'sales',
  orderId: fullOrder.id,
  orderNumber: fullOrder.orderNumber,
  oldStatus: existingOrder.status,
  newStatus: fullOrder.status,
  customerId: fullOrder.customerId,
  customerName: fullOrder.customer.name,
  userId: user.id,
});
```

**实时通知效果**:

- 所有订阅 `orders` 频道的客户端会实时收到订单状态变更
- 可用于自动刷新订单列表、显示通知等

---

### 3. 审核相关 API ✅

#### `app/api/return-orders/[id]/approve/route.ts`

**集成内容**:

- 添加 `publishApprovalResult` 和 `notifyUser` 导入
- 在审核完成后发布审核结果事件
- 自动通知请求者审核结果（通过 `publishApprovalResult` 内部实现）

**代码示例**:

```typescript
await publishApprovalResult({
  approved,
  resourceType: 'return',
  resourceId: updatedReturnOrder.id,
  resourceNumber: updatedReturnOrder.returnNumber,
  requesterId: existingReturnOrder.userId,
  requesterName: existingReturnOrder.user?.name || '未知用户',
  approverId: user.id,
  approverName: user.name || user.username,
  comment: remarks,
  userId: user.id,
});
```

**实时通知效果**:

- 发布到 `approvals` 频道：所有审核页面收到更新
- 发送到请求者个人频道：请求者收到专属通知

---

### 4. 财务相关 API ✅

#### `app/api/payments/route.ts`

**集成内容**:

- 添加 `publishFinanceEvent` 导入
- 在收款记录创建后发布 `finance:payment` 事件

**代码示例**:

```typescript
await publishFinanceEvent({
  action: 'created',
  recordType: 'payment',
  recordId: payment.id,
  recordNumber: payment.paymentNumber,
  amount: payment.paymentAmount,
  customerId: payment.customerId,
  customerName: payment.customer.name,
  userId,
});
```

#### `app/api/finance/refunds/route.ts`

**集成内容**:

- 添加 `publishFinanceEvent` 导入
- 在退款记录创建后发布 `finance:refund` 事件

**代码示例**:

```typescript
await publishFinanceEvent({
  action: 'created',
  recordType: 'refund',
  recordId: newRefund.id,
  recordNumber: newRefund.refundNumber,
  amount: newRefund.refundAmount,
  customerId: newRefund.customerId,
  customerName: newRefund.customer.name,
  userId: user.id,
});
```

---

### 5. 产品相关 API ✅

#### `app/api/products/route.ts`

**集成内容**:

- 已在之前的缓存迁移中集成 `publishDataUpdate`
- 在产品创建时发布 `data:change` 事件

---

### 6. 前端页面集成 ✅

#### `app/(dashboard)/inventory/page-client.tsx` - 库存页面

**集成内容**:

- 添加 `useInventoryUpdates` hook
- 实时监听库存变更事件
- 自动刷新库存列表
- 显示库存变更 toast 通知

**代码示例**:

```typescript
useInventoryUpdates(
  React.useCallback(
    event => {
      // 刷新库存列表
      queryClient.invalidateQueries({ queryKey: ['inventory'] });

      // 显示变更提示
      const changeType = event.changeAmount > 0 ? '增加' : '减少';
      const amount = Math.abs(event.changeAmount);
      toast.info(
        `库存变更: ${event.productName || '产品'} ${changeType} ${amount}`,
        {
          description: event.reason || event.action,
        }
      );
    },
    [queryClient]
  )
);
```

#### `components/sales-orders/erp-sales-order-list.tsx` - 订单列表

**集成内容**:

- 添加 `useOrderUpdates` hook
- 实时监听订单状态变更
- 自动更新本地订单缓存
- 刷新订单列表
- 显示状态变更通知

**代码示例**:

```typescript
useOrderUpdates(
  React.useCallback(
    event => {
      // 更新本地订单缓存
      queryClient.setQueryData(
        salesOrderQueryKeys.detail(event.orderId),
        (old: any) => (old ? { ...old, status: event.newStatus } : old)
      );

      // 刷新订单列表
      queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.lists() });

      // 显示状态变更通知
      const statusLabel =
        SALES_ORDER_STATUS_LABELS[event.newStatus] || event.newStatus;
      toast.info(`订单 ${event.orderNumber} 状态更新`, {
        description: `${event.oldStatus} → ${statusLabel}`,
      });
    },
    [queryClient]
  )
);
```

---

## 架构优势

### 1. **完全解耦**

- API 路由不需要知道谁在监听事件
- 前端组件可以独立订阅感兴趣的事件
- 通过 Redis Pub/Sub 实现跨进程通信

### 2. **类型安全**

```typescript
// 编译时类型检查
await publishInventoryChange({
  action: 'adjust', // 只能是 'adjust' | 'inbound' | 'outbound' | 'reserve' | 'release'
  productId: string,
  oldQuantity: number, // 必填
  newQuantity: number, // 必填
  // ...
});
```

### 3. **向后兼容**

保留了旧的 `publishWs` 调用，可以平滑迁移：

```typescript
// 新事件系统
await publishInventoryChange({ ... });

// 旧系统（向后兼容）
publishWs('inventory', { type: 'adjust', ... });
```

---

## 待集成的接口

### 高优先级

1. **财务相关**
   - `app/api/finance/payments/route.ts` - 收款确认时发布 `finance:payment` 事件
   - `app/api/finance/refunds/[id]/process/route.ts` - 退款处理时发布 `finance:refund` 事件

2. **产品相关**
   - `app/api/products/route.ts` - 已集成 `publishDataUpdate`，需验证

3. **入库相关**
   - `app/api/inventory/inbound/[id]/route.ts` - 入库确认时发布 `inventory:change` 事件

### 中优先级

4. **工厂发货**
   - `app/api/factory-shipments/[id]/status/route.ts` - 状态变更时发布事件

5. **客户/供应商**
   - `app/api/customers/route.ts` - 客户创建/更新时发布 `data:change` 事件
   - `app/api/suppliers/route.ts` - 供应商创建/更新时发布 `data:change` 事件

---

## 前端集成建议

### 1. 全局监控（Layout 组件）

在根布局中添加全局事件监控：

```typescript
// app/layout.tsx
import { useUserNotifications, useSystemUpdates } from '@/hooks/use-websocket';

export default function RootLayout({ children }) {
  const session = useSession();

  // 个人通知
  useUserNotifications(session?.user?.id, (notification) => {
    toast[notification.notificationType](notification.title, {
      description: notification.message,
      action: notification.actionUrl ? {
        label: notification.actionLabel,
        onClick: () => router.push(notification.actionUrl),
      } : undefined,
    });
  });

  // 系统通知
  useSystemUpdates((event) => {
    if (event.level === 'critical') {
      showModal({ title: '系统通知', message: event.message });
    }
  });

  return <html>{children}</html>;
}
```

### 2. 页面级监控

#### 库存页面

```typescript
// app/(dashboard)/inventory/page.tsx
'use client';

import { useInventoryUpdates } from '@/hooks/use-websocket';
import { useQueryClient } from '@tanstack/react-query';

export default function InventoryPage() {
  const queryClient = useQueryClient();

  useInventoryUpdates((event) => {
    // 刷新库存列表
    queryClient.invalidateQueries(['inventory']);

    // 显示变更提示
    toast.info(`库存变更: ${event.productName} ${event.changeAmount > 0 ? '+' : ''}${event.changeAmount}`);
  });

  return <InventoryList />;
}
```

#### 订单页面

```typescript
// app/(dashboard)/sales-orders/page.tsx
'use client';

import { useOrderUpdates } from '@/hooks/use-websocket';

export default function OrdersPage() {
  const queryClient = useQueryClient();

  useOrderUpdates((event) => {
    // 更新本地缓存
    queryClient.setQueryData(['orders', event.orderId], (old) => ({
      ...old,
      status: event.newStatus,
    }));

    // 刷新列表
    queryClient.invalidateQueries(['orders', 'list']);

    toast.info(`订单 ${event.orderNumber} 状态: ${event.oldStatus} → ${event.newStatus}`);
  });

  return <OrdersList />;
}
```

#### 审核工作台

```typescript
// app/(dashboard)/approvals/page.tsx
'use client';

import { useApprovalUpdates } from '@/hooks/use-websocket';

export default function ApprovalsPage() {
  const queryClient = useQueryClient();

  useApprovalUpdates((event) => {
    if (event.type === 'approval:request') {
      // 新的审核请求
      queryClient.invalidateQueries(['approvals', 'pending']);
      playSound('notification.mp3');
      toast.warning(`新的审核: ${event.resourceNumber}`);
    }
  });

  return <ApprovalsList />;
}
```

---

## 数据流

```
┌─────────────────┐
│  用户操作       │
│ (调整库存)      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  API Route Handler      │
│  /api/inventory/adjust  │
│                         │
│  1. 业务逻辑执行        │
│  2. 数据库更新         │
│  3. publishInventoryChange() │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Redis Pub/Sub          │
│  Channel: ws:inventory  │
└────────┬────────────────┘
         │
         ├──────────────────┬──────────────────┐
         ▼                  ▼                  ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ WebSocket       │  │ WebSocket       │  │ WebSocket       │
│ Server 1        │  │ Server 2        │  │ Server 3        │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ 客户端 A        │  │ 客户端 B        │  │ 客户端 C        │
│ (库存页面)      │  │ (Dashboard)     │  │ (移动端)        │
│                 │  │                 │  │                 │
│ useInventory    │  │ useInventory    │  │ useInventory    │
│ Updates()       │  │ Updates()       │  │ Updates()       │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
    刷新列表              更新统计            显示通知
```

---

## 性能考虑

### 1. 事件发布不阻塞业务

所有 `publish*` 函数都是异步的，但错误不会抛出：

```typescript
try {
  await redis.publish(channel, payload);
} catch (error) {
  console.error('[Events] Failed to publish:', error);
  // 不抛出错误，避免阻塞业务逻辑
}
```

### 2. 批量更新优化

如果一次操作影响多个产品，考虑批量发布：

```typescript
await Promise.all(
  productIds.map(id => publishInventoryChange({ productId: id, ... }))
);
```

### 3. 客户端防抖

前端组件应该对频繁的事件进行防抖处理：

```typescript
const debouncedRefresh = useMemo(
  () => debounce(() => queryClient.invalidateQueries(['inventory']), 500),
  []
);

useInventoryUpdates(event => {
  debouncedRefresh();
});
```

---

## 调试和监控

### 1. 开发环境日志

在 `.env.local` 中启用详细日志：

```bash
LOG_LEVEL=debug
WS_DEBUG=true
```

### 2. Redis 监控

实时监控所有事件：

```bash
redis-cli
PSUBSCRIBE ws:*
```

### 3. 前端调试

临时添加全局监听器查看所有事件：

```typescript
useWebSocket({
  channels: Object.values(EventChannels),
  onMessage: msg => {
    console.log('[WS Event]', msg.channel, msg.data);
  },
});
```

---

## 下一步工作

### 必须完成

- [ ] 集成财务相关 API 事件发布
- [ ] 集成入库确认事件发布
- [ ] 在主要页面添加事件订阅（Dashboard、库存、订单）

### 建议完成

- [ ] 添加事件重播机制（Redis Streams）
- [ ] 实现离线消息队列
- [ ] 添加事件统计和监控面板
- [ ] 创建事件日志审计系统

### 可选优化

- [ ] 实现事件版本控制
- [ ] 添加事件过滤和转换中间件
- [ ] 支持事件订阅权限控制
- [ ] 实现跨系统事件集成

---

## 总结

✅ **已完成**:

1. 库存调整/出库事件发布
2. 订单状态变更事件发布
3. 退货单审核事件发布
4. 完整的类型定义和 React Hooks
5. 详细的文档和使用示例

✅ **核心优势**:

- 完全解耦的事件驱动架构
- 端到端 TypeScript 类型安全
- 支持多进程/多服务器部署
- 向后兼容，平滑迁移

📝 **文档完整**:

- 系统架构文档: `docs/event-system-guide.md`
- 使用示例: `components/examples/WebSocketHooksExample.tsx`
- Server Actions 示例: `lib/actions/event-actions.example.ts`
- 集成总结: `docs/event-system-integration-summary.md` (本文档)

现在可以开始在前端页面集成事件订阅，实现真正的实时响应！
