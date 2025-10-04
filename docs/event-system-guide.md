# 事件驱动实时系统完整指南

## 概述

本系统实现了完全解耦的事件驱动架构，通过 Redis Pub/Sub 将业务逻辑与 WebSocket 实时推送分离。

### 核心特性

- ✅ **完全解耦**: 业务代码不直接依赖 WebSocket，只需发布事件
- ✅ **类型安全**: TypeScript 完整类型支持，编译时错误检测
- ✅ **多实例支持**: 通过 Redis 支持多进程/多服务器部署
- ✅ **自动重连**: WebSocket 客户端自动重连机制
- ✅ **频道隔离**: 不同业务场景使用独立频道
- ✅ **个性化通知**: 支持用户专属通知频道

---

## 系统架构

```
Next.js Server Actions / Route Handlers
          ↓
    Event Publishers (lib/events/publisher.ts)
          ↓
    Redis Pub/Sub Channels (ws:*)
          ↓
    WebSocket Server (lib/ws/ws-server.ts)
          ↓
    React Hooks (hooks/use-websocket.ts)
          ↓
    UI Components
```

---

## 一、事件类型定义

### 基础事件类型 (`lib/events/types.ts`)

所有事件都继承自 `BaseEvent`:

```typescript
export interface BaseEvent {
  type: string;
  timestamp: number;
  userId?: string;
}
```

### 业务事件类型

#### 1. 通知事件 (NotificationEvent)

```typescript
interface NotificationEvent extends BaseEvent {
  type: 'notification';
  notificationType: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
}
```

**使用场景**:
- 用户操作成功/失败提示
- 审核结果通知
- 系统消息推送

#### 2. 库存变更事件 (InventoryChangeEvent)

```typescript
interface InventoryChangeEvent extends BaseEvent {
  type: 'inventory:change';
  action: 'adjust' | 'inbound' | 'outbound' | 'reserve' | 'release';
  productId: string;
  productName?: string;
  variantId?: string;
  oldQuantity: number;
  newQuantity: number;
  changeAmount: number;
  reason?: string;
  operator?: string;
}
```

**使用场景**:
- 库存调整
- 入库/出库操作
- 库存预留/释放

#### 3. 订单状态事件 (OrderStatusEvent)

```typescript
interface OrderStatusEvent extends BaseEvent {
  type: 'order:status';
  orderType: 'sales' | 'return' | 'purchase';
  orderId: string;
  orderNumber: string;
  oldStatus: string;
  newStatus: string;
  customerId?: string;
  customerName?: string;
}
```

**使用场景**:
- 销售订单状态变更
- 退货单状态更新
- 采购单流程跟踪

#### 4. 审核事件 (ApprovalEvent)

```typescript
interface ApprovalEvent extends BaseEvent {
  type: 'approval:request' | 'approval:approved' | 'approval:rejected';
  resourceType: 'order' | 'return' | 'payment' | 'refund' | 'adjustment';
  resourceId: string;
  resourceNumber: string;
  requesterId: string;
  requesterName: string;
  approverId?: string;
  approverName?: string;
  reason?: string;
  comment?: string;
}
```

**使用场景**:
- 审核请求提交
- 审核结果通知
- 审核流程追踪

#### 5. 财务事件 (FinanceEvent)

```typescript
interface FinanceEvent extends BaseEvent {
  type: 'finance:payment' | 'finance:refund' | 'finance:overdue';
  action: 'created' | 'confirmed' | 'cancelled' | 'overdue';
  recordType: 'payment' | 'paymentOut' | 'refund';
  recordId: string;
  recordNumber: string;
  amount: number;
  customerId?: string;
  customerName?: string;
  supplierId?: string;
  supplierName?: string;
}
```

**使用场景**:
- 收款/付款确认
- 退款处理
- 逾期提醒

#### 6. 数据变更事件 (DataChangeEvent)

```typescript
interface DataChangeEvent extends BaseEvent {
  type: 'data:change';
  resource: 'product' | 'customer' | 'supplier' | 'category' | 'user';
  action: 'created' | 'updated' | 'deleted';
  resourceId: string;
  resourceName?: string;
  changes?: Record<string, any>;
}
```

**使用场景**:
- 商品创建/更新/删除
- 客户/供应商信息变更
- 数据同步通知

#### 7. 系统事件 (SystemEvent)

```typescript
interface SystemEvent extends BaseEvent {
  type: 'system:maintenance' | 'system:update' | 'system:alert';
  level: 'info' | 'warning' | 'critical';
  message: string;
  affectedUsers?: string[];
  scheduledTime?: number;
  estimatedDuration?: number;
}
```

**使用场景**:
- 系统维护通知
- 版本更新公告
- 紧急系统告警

---

## 二、事件频道 (EventChannels)

### 频道分类

```typescript
export const EventChannels = {
  // 个人通知（用户专属）
  userNotification: (userId: string) => `user:${userId}:notifications`,

  // 业务频道
  inventory: 'inventory',       // 库存
  orders: 'orders',             // 订单
  approvals: 'approvals',       // 审核
  finance: 'finance',           // 财务

  // 资源频道
  products: 'products',         // 商品
  customers: 'customers',       // 客户
  suppliers: 'suppliers',       // 供应商

  // 系统频道
  system: 'system',             // 系统
  broadcast: 'broadcast',       // 全局广播
}
```

### Redis 频道映射

所有频道在 Redis 中都会加上 `ws:` 前缀:

- `EventChannels.inventory` → Redis: `ws:inventory`
- `EventChannels.userNotification('user123')` → Redis: `ws:user:user123:notifications`

---

## 三、服务端发布事件

### 3.1 在 Server Actions 中使用

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import {
  publishInventoryChange,
  publishOrderStatus,
  notifyUser,
} from '@/lib/events';

export async function adjustInventoryAction(data: {
  productId: string;
  productName: string;
  quantity: number;
  reason: string;
  userId: string;
  userName: string;
}) {
  // 1. 执行业务逻辑
  const result = await prisma.inventory.update({
    where: { productId: data.productId },
    data: { quantity: { increment: data.quantity } },
  });

  // 2. 发布库存变更事件
  await publishInventoryChange({
    action: 'adjust',
    productId: data.productId,
    productName: data.productName,
    oldQuantity: result.quantity - data.quantity,
    newQuantity: result.quantity,
    reason: data.reason,
    operator: data.userName,
    userId: data.userId,
  });

  // 3. 刷新缓存
  revalidatePath('/inventory');

  return { success: true };
}
```

### 3.2 在 Route Handlers 中使用

```typescript
// app/api/sales-orders/[id]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { publishOrderStatus, notifyUser } from '@/lib/events';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { newStatus } = await request.json();

  // 更新订单状态
  const order = await prisma.salesOrder.update({
    where: { id: params.id },
    data: { status: newStatus },
    include: { customer: true },
  });

  // 发布订单状态事件
  await publishOrderStatus({
    orderType: 'sales',
    orderId: order.id,
    orderNumber: order.orderNumber,
    oldStatus: order.status,
    newStatus: newStatus,
    customerId: order.customerId,
    customerName: order.customer.name,
  });

  // 通知客户
  await notifyUser(order.customerId, {
    type: 'notification',
    notificationType: 'info',
    title: '订单状态更新',
    message: `您的订单 ${order.orderNumber} 状态已更新为：${newStatus}`,
    actionUrl: `/orders/${order.id}`,
    actionLabel: '查看订单',
  });

  return NextResponse.json({ success: true, data: order });
}
```

### 3.3 所有可用的发布函数

#### 通用事件发布

```typescript
publishEvent(channel: EventChannel, event: BusinessEvent): Promise<void>
```

#### 专用发布函数

```typescript
// 个人通知
notifyUser(userId: string, notification: NotificationData): Promise<void>

// 库存变更
publishInventoryChange(data: InventoryChangeData): Promise<void>

// 订单状态
publishOrderStatus(data: OrderStatusData): Promise<void>

// 审核请求
publishApprovalRequest(data: ApprovalRequestData): Promise<void>

// 审核结果
publishApprovalResult(data: ApprovalResultData): Promise<void>

// 财务事件
publishFinanceEvent(data: FinanceEventData): Promise<void>

// 数据变更
publishDataChange(data: DataChangeData): Promise<void>

// 系统事件
publishSystemEvent(data: SystemEventData): Promise<void>

// 全局广播
broadcast(data: BroadcastData): Promise<void>
```

---

## 四、客户端订阅事件

### 4.1 基础 WebSocket Hook

```typescript
import { useWebSocket } from '@/hooks/use-websocket';

function MyComponent() {
  const { isConnected, subscribe, unsubscribe } = useWebSocket({
    channels: ['inventory', 'orders'],
    onMessage: (message) => {
      console.log('Received:', message);
    },
    autoConnect: true,
  });

  return <div>Status: {isConnected ? 'Connected' : 'Disconnected'}</div>;
}
```

### 4.2 类型安全的专用 Hooks

#### 用户通知

```typescript
import { useUserNotifications } from '@/hooks/use-websocket';

function NotificationCenter({ userId }: { userId: string }) {
  const { isConnected } = useUserNotifications(userId, (notification) => {
    // TypeScript 自动推断类型
    showToast(notification.title, notification.message, notification.notificationType);

    if (notification.actionUrl) {
      // 显示操作按钮
    }
  });

  return <div>Notifications: {isConnected ? 'ON' : 'OFF'}</div>;
}
```

#### 库存监控

```typescript
import { useInventoryUpdates } from '@/hooks/use-websocket';

function InventoryMonitor() {
  useInventoryUpdates((event) => {
    console.log(`${event.productName}: ${event.oldQuantity} → ${event.newQuantity}`);

    // 刷新缓存
    queryClient.invalidateQueries(['inventory', event.productId]);

    // 低库存警告
    if (event.newQuantity < 10) {
      showWarning(`库存不足: ${event.productName}`);
    }
  });

  return null; // 后台监控
}
```

#### 订单状态追踪

```typescript
import { useOrderUpdates } from '@/hooks/use-websocket';

function OrderStatusTracker() {
  useOrderUpdates((event) => {
    // 自动类型推断
    console.log(`Order ${event.orderNumber}: ${event.oldStatus} → ${event.newStatus}`);

    // 更新订单列表
    queryClient.setQueryData(['orders', event.orderId], (old) => ({
      ...old,
      status: event.newStatus,
    }));
  });

  return null;
}
```

#### 审核工作流

```typescript
import { useApprovalUpdates } from '@/hooks/use-websocket';

function ApprovalMonitor() {
  useApprovalUpdates((event) => {
    if (event.type === 'approval:request') {
      showNotification(`新的审核请求: ${event.resourceNumber}`);
      playSound('notification.mp3');
    } else if (event.type === 'approval:approved') {
      showSuccess(`审核通过: ${event.resourceNumber}`);
    } else if (event.type === 'approval:rejected') {
      showWarning(`审核拒绝: ${event.resourceNumber}\n原因: ${event.comment}`);
    }

    queryClient.invalidateQueries(['approvals']);
  });

  return null;
}
```

#### 财务事件

```typescript
import { useFinanceUpdates } from '@/hooks/use-websocket';

function FinanceMonitor() {
  useFinanceUpdates((event) => {
    if (event.type === 'finance:payment' && event.action === 'confirmed') {
      showSuccess(`收款确认: ¥${event.amount}`);
    } else if (event.type === 'finance:overdue') {
      showError(`逾期提醒: ${event.recordNumber}`);
    }

    queryClient.invalidateQueries(['finance']);
  });

  return null;
}
```

#### 系统通知

```typescript
import { useSystemUpdates } from '@/hooks/use-websocket';

function SystemAnnouncements() {
  useSystemUpdates((event) => {
    if (event.level === 'critical') {
      showModal({
        title: '重要通知',
        message: event.message,
        blocking: true,
      });
    } else if (event.type === 'system:maintenance') {
      const maintenanceTime = new Date(event.scheduledTime!);
      showWarning(`系统维护: ${maintenanceTime.toLocaleString()}`);
    }
  });

  return null;
}
```

#### 全局广播

```typescript
import { useBroadcast } from '@/hooks/use-websocket';

function BroadcastReceiver() {
  useBroadcast((event) => {
    showToast(event.message, event.level);
  });

  return null;
}
```

### 4.3 所有可用的订阅 Hooks

```typescript
// 个人通知
useUserNotifications(userId: string, onNotification: (e) => void)

// 库存更新
useInventoryUpdates(onUpdate: (e) => void)

// 订单状态
useOrderUpdates(onUpdate: (e) => void)

// 审核事件
useApprovalUpdates(onUpdate: (e) => void)

// 财务事件
useFinanceUpdates(onUpdate: (e) => void)

// 商品变更
useProductUpdates(onUpdate: (e) => void)

// 客户变更
useCustomerUpdates(onUpdate: (e) => void)

// 供应商变更
useSupplierUpdates(onUpdate: (e) => void)

// 系统通知
useSystemUpdates(onUpdate: (e) => void)

// 全局广播
useBroadcast(onMessage: (e) => void)
```

---

## 五、完整使用示例

### 场景 1: 库存调整流程

#### 服务端 (Server Action)

```typescript
'use server';

import { publishInventoryChange, notifyUser } from '@/lib/events';
import { revalidateInventory } from '@/lib/cache';

export async function adjustInventory(data: {
  productId: string;
  quantity: number;
  reason: string;
  userId: string;
}) {
  const product = await prisma.product.findUnique({
    where: { id: data.productId },
  });

  const oldQty = product.inventory.quantity;
  const newQty = oldQty + data.quantity;

  // 更新库存
  await prisma.inventory.update({
    where: { productId: data.productId },
    data: { quantity: newQty },
  });

  // 发布库存变更事件（所有监控页面都会收到）
  await publishInventoryChange({
    action: 'adjust',
    productId: data.productId,
    productName: product.name,
    oldQuantity: oldQty,
    newQuantity: newQty,
    reason: data.reason,
    userId: data.userId,
  });

  // 通知操作者
  await notifyUser(data.userId, {
    type: 'notification',
    notificationType: 'success',
    title: '库存调整成功',
    message: `${product.name} 库存已调整：${oldQty} → ${newQty}`,
  });

  // 清除缓存
  await revalidateInventory(data.productId);

  return { success: true, newQuantity: newQty };
}
```

#### 客户端 (React Component)

```typescript
'use client';

import { useInventoryUpdates, useUserNotifications } from '@/hooks/use-websocket';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function InventoryPage({ userId }: { userId: string }) {
  const queryClient = useQueryClient();

  // 监听库存变更
  useInventoryUpdates((event) => {
    // 刷新列表
    queryClient.invalidateQueries(['inventory']);

    // 显示提示
    toast.info(`${event.productName} 库存变更: ${event.changeAmount > 0 ? '+' : ''}${event.changeAmount}`);
  });

  // 监听个人通知
  useUserNotifications(userId, (notification) => {
    toast[notification.notificationType](notification.title, {
      description: notification.message,
    });
  });

  return <InventoryList />;
}
```

### 场景 2: 订单审核流程

#### 服务端 (提交审核)

```typescript
'use server';

import { publishApprovalRequest, notifyUser } from '@/lib/events';

export async function submitOrderForApproval(
  orderId: string,
  requesterId: string
) {
  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
  });

  // 创建审核记录
  const approval = await prisma.approval.create({
    data: {
      resourceType: 'order',
      resourceId: orderId,
      requesterId,
      status: 'pending',
    },
  });

  // 发布审核请求事件
  await publishApprovalRequest({
    resourceType: 'order',
    resourceId: orderId,
    resourceNumber: order.orderNumber,
    requesterId,
    requesterName: order.createdBy.name,
  });

  // 获取所有审核人
  const approvers = await prisma.user.findMany({
    where: { role: 'APPROVER' },
  });

  // 通知所有审核人
  await Promise.all(
    approvers.map((approver) =>
      notifyUser(approver.id, {
        type: 'notification',
        notificationType: 'warning',
        title: '待审核',
        message: `订单 ${order.orderNumber} 等待您的审核`,
        actionUrl: `/approvals/${orderId}`,
        actionLabel: '立即审核',
      })
    )
  );

  return { success: true };
}
```

#### 服务端 (审核结果)

```typescript
'use server';

import { publishApprovalResult } from '@/lib/events';

export async function approveOrder(
  orderId: string,
  approverId: string,
  approved: boolean,
  comment?: string
) {
  const order = await prisma.salesOrder.update({
    where: { id: orderId },
    data: { status: approved ? 'approved' : 'rejected' },
  });

  // 发布审核结果（会自动通知请求者）
  await publishApprovalResult({
    approved,
    resourceType: 'order',
    resourceId: orderId,
    resourceNumber: order.orderNumber,
    requesterId: order.createdById,
    requesterName: order.createdBy.name,
    approverId,
    approverName: 'Current Approver',
    comment,
  });

  return { success: true };
}
```

#### 客户端 (审核页面)

```typescript
'use client';

import { useApprovalUpdates, useUserNotifications } from '@/hooks/use-websocket';

export function ApprovalsPage({ userId }: { userId: string }) {
  const queryClient = useQueryClient();

  // 监听审核事件
  useApprovalUpdates((event) => {
    if (event.type === 'approval:request') {
      // 新的审核请求
      queryClient.invalidateQueries(['approvals', 'pending']);
      playSound('notification.mp3');
    } else if (event.type === 'approval:approved' || event.type === 'approval:rejected') {
      // 审核完成
      queryClient.invalidateQueries(['approvals', 'completed']);
    }
  });

  // 监听个人通知（审核结果）
  useUserNotifications(userId, (notification) => {
    if (notification.notificationType === 'success') {
      confetti(); // 审核通过动画
    }

    toast[notification.notificationType](notification.title, {
      description: notification.message,
      action: notification.actionUrl ? {
        label: notification.actionLabel,
        onClick: () => router.push(notification.actionUrl),
      } : undefined,
    });
  });

  return <ApprovalsList />;
}
```

---

## 六、最佳实践

### 1. 错误处理

所有发布函数都不会抛出错误，失败会记录日志但不阻塞业务:

```typescript
// ✅ 正确 - 发布失败不影响业务流程
await createOrder(data);
await publishOrderStatus(/* ... */); // 即使失败也不会抛错
return { success: true };
```

### 2. 事件命名规范

- 使用冒号分隔命名空间: `inventory:change`, `order:status`
- 使用动词描述动作: `approval:request`, `approval:approved`
- 保持一致性: 所有库存相关事件以 `inventory:` 开头

### 3. 频道订阅策略

```typescript
// ✅ 推荐 - 使用专用 hook
useInventoryUpdates((event) => {
  // 类型安全，自动过滤频道
});

// ❌ 不推荐 - 手动订阅需要自己过滤
useWebSocket({
  channels: ['inventory', 'orders'],
  onMessage: (msg) => {
    if (msg.channel === 'inventory') {
      // 需要手动类型转换和频道过滤
    }
  },
});
```

### 4. 性能优化

```typescript
// ✅ 在布局组件中订阅全局事件
// app/layout.tsx
export default function RootLayout({ children, session }) {
  return (
    <>
      <NotificationMonitor userId={session.user.id} />
      <SystemAnnouncementMonitor />
      {children}
    </>
  );
}

// ✅ 在页面组件中订阅页面相关事件
// app/inventory/page.tsx
export default function InventoryPage() {
  useInventoryUpdates((event) => {
    // 只在库存页面监听库存事件
  });

  return <InventoryList />;
}
```

### 5. 与缓存系统集成

```typescript
// 服务端发布事件后清除缓存
await publishInventoryChange(data);
await revalidateInventory(productId); // 清除相关缓存

// 客户端收到事件后刷新查询
useInventoryUpdates((event) => {
  queryClient.invalidateQueries(['inventory', event.productId]);
});
```

---

## 七、调试技巧

### 1. 启用事件日志

```typescript
// 临时添加全局监听器
useWebSocket({
  channels: Object.values(EventChannels),
  onMessage: (msg) => {
    console.log('[WebSocket Event]', msg.channel, msg.data);
  },
});
```

### 2. 检查连接状态

```typescript
function DebugPanel() {
  const inventory = useInventoryUpdates(() => {});
  const orders = useOrderUpdates(() => {});

  return (
    <div>
      <div>Inventory: {inventory.isConnected ? '✓' : '✗'}</div>
      <div>Orders: {orders.isConnected ? '✓' : '✗'}</div>
    </div>
  );
}
```

### 3. Redis 频道监控

```bash
# 在 Redis CLI 中监控所有 WebSocket 频道
redis-cli
PSUBSCRIBE ws:*
```

---

## 八、常见问题

### Q1: 事件会丢失吗？

不会。Redis Pub/Sub 保证所有已连接的订阅者都能收到消息。但如果客户端离线，离线期间的消息无法接收（这是 Pub/Sub 的特性）。

### Q2: 如何确保消息送达？

对于关键业务（如支付确认），应使用数据库记录 + 事件推送的双重保障:

```typescript
// 1. 写入数据库
await prisma.payment.create({ data: paymentData });

// 2. 发送实时通知（尽力而为）
await publishFinanceEvent({ /* ... */ });

// 客户端应该定期轮询数据库作为兜底
```

### Q3: 多个标签页会收到重复事件吗？

会。每个标签页都是独立的 WebSocket 连接，都会收到事件。需要在应用层去重:

```typescript
const processedEvents = useRef(new Set<string>());

useInventoryUpdates((event) => {
  const eventId = `${event.productId}-${event.timestamp}`;
  if (processedEvents.current.has(eventId)) return;

  processedEvents.current.add(eventId);
  // 处理事件...
});
```

### Q4: 如何测试事件系统？

使用 Redis CLI 手动发布测试事件:

```bash
redis-cli
PUBLISH ws:inventory '{"type":"inventory:change","productId":"123","action":"adjust","oldQuantity":10,"newQuantity":15,"changeAmount":5,"timestamp":1699999999999}'
```

---

## 九、迁移指南

### 从旧的 publishWs 迁移

#### 旧代码

```typescript
publishWs('inventory', {
  type: 'adjust',
  productId: '123',
  quantity: 10,
});
```

#### 新代码

```typescript
await publishInventoryChange({
  action: 'adjust',
  productId: '123',
  productName: 'Product Name',
  oldQuantity: 100,
  newQuantity: 110,
});
```

### 迁移步骤

1. ✅ 保留旧的 `publishWs` 调用（向后兼容）
2. ✅ 添加新的事件发布调用
3. ✅ 更新客户端使用新的类型安全 hooks
4. ✅ 测试验证两种方式都工作
5. ✅ 逐步移除旧的 `publishWs` 调用

---

## 十、示例代码位置

- 事件类型定义: `lib/events/types.ts`
- 事件发布器: `lib/events/publisher.ts`
- Server Actions 示例: `lib/actions/event-actions.example.ts`
- WebSocket Hooks: `hooks/use-websocket.ts`
- React 组件示例: `components/examples/WebSocketHooksExample.tsx`

---

## 总结

✅ **完全解耦**: 业务逻辑与 WebSocket 完全分离
✅ **类型安全**: 端到端 TypeScript 类型支持
✅ **易于使用**: 简单的发布/订阅 API
✅ **高性能**: Redis Pub/Sub 支持大规模实时通信
✅ **可扩展**: 支持多进程/多服务器部署

现在你可以在任何 Server Action 或 Route Handler 中发布事件，在任何 React 组件中订阅事件，享受类型安全的实时通信体验！
