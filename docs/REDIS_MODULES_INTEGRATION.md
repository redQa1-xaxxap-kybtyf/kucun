# Redis 新特性模块集成完成总结

> 已为项目的核心模块集成 Redis Pub/Sub 和事务功能

## ✅ 已完成的集成模块

### 1. 库存实时服务 (`lib/services/inventory-realtime-service.ts`)

**功能**:

- ✅ 实时库存更新（使用事务确保原子性）
- ✅ 库存变更通知（Pub/Sub）
- ✅ 批量库存更新（事务）
- ✅ 库存预留/释放（订单场景）
- ✅ 入库/出库/调整操作
- ✅ 实时库存查询（优先从 Redis 读取）
- ✅ 库存预警通知

**核心函数**:

```typescript
// 更新库存并发布通知
updateInventoryWithNotification(productId, variantId, quantity, type, metadata);

// 批量更新库存
batchUpdateInventory(updates);

// 预留库存（订单创建）
reserveInventory(productId, variantId, quantity, orderId);

// 释放库存（订单取消）
releaseInventory(productId, variantId, quantity, orderId);

// 获取实时库存
getRealtimeInventory(productId, variantId);
```

**Pub/Sub 频道**:

- `inventory:{productId}:updated` - 产品级别库存更新
- `inventory:updated` - 全局库存更新
- `inventory:low-stock` - 库存预警
- `inventory:batch:updated` - 批量更新通知

---

### 2. 订单实时服务 (`lib/services/order-realtime-service.ts`)

**功能**:

- ✅ 订单状态更新（使用事务）
- ✅ 订单支付处理（事务 + 统计）
- ✅ 订单取消（包含库存释放）
- ✅ 实时订单查询（优先从 Redis 读取）
- ✅ 多维度通知（订单、客户、用户）

**核心函数**:

```typescript
// 更新订单状态
updateOrderStatus(orderId, newStatus, metadata);

// 处理订单支付
processOrderPayment(orderId, paymentAmount, paymentMethod, metadata);

// 取消订单
cancelOrder(orderId, reason, userId);

// 获取实时订单
getRealtimeOrder(orderId);
```

**Pub/Sub 频道**:

- `order:{orderId}:status` - 订单状态变更
- `order:{orderId}:payment` - 订单支付
- `customer:{customerId}:orders` - 客户订单通知
- `order:status:changed` - 全局订单状态变更
- `payment:received` - 全局支付通知

**Redis 事务应用**:

- 订单支付时同时更新：订单信息、每日统计、支付方式统计、客户统计
- 确保所有更新的原子性

---

### 3. 通知服务 (`lib/services/notification-service.ts`)

**功能**:

- ✅ 统一的通知发送接口
- ✅ 用户通知管理
- ✅ 系统广播消息
- ✅ 订单/支付/库存通知
- ✅ 通知订阅管理
- ✅ 模式订阅（监听所有相关事件）

**核心函数**:

```typescript
// 发送用户通知
sendUserNotification(userId, notification);

// 发送系统广播
broadcastSystemMessage(message, priority, data);

// 订阅用户通知
subscribeUserNotifications(userId, callback);

// 订阅订单更新（模式订阅）
subscribeOrderUpdates(callback);

// 订阅库存更新（模式订阅）
subscribeInventoryUpdates(callback);
```

**通知类型**:

- `order_created` - 订单创建
- `order_status_changed` - 订单状态变更
- `payment_received` - 支付成功
- `inventory_low_stock` - 库存预警
- `inventory_updated` - 库存更新
- `system_message` - 系统消息

---

## 📊 集成架构

### 数据流

```
用户操作
  ↓
API 端点
  ↓
业务服务层（使用 Redis 事务）
  ├─→ 更新数据库
  ├─→ 更新 Redis 缓存
  ├─→ 发布 Pub/Sub 通知
  └─→ 失效相关缓存
       ↓
WebSocket 服务器（订阅 Pub/Sub）
  ↓
推送到客户端
  ↓
前端更新界面
```

### 事务使用场景

1. **库存扣减**
   - 减少可用库存
   - 增加预留数量
   - 更新最后修改时间

2. **订单支付**
   - 更新订单支付信息
   - 更新每日统计
   - 更新支付方式统计
   - 更新客户统计

3. **批量操作**
   - 批量更新库存
   - 批量更新订单状态

### Pub/Sub 使用场景

1. **实时通知**
   - 订单状态变更
   - 支付成功
   - 库存预警

2. **缓存同步**
   - 跨进程缓存失效
   - 多实例数据同步

3. **事件驱动**
   - 订单创建触发库存扣减
   - 支付成功触发订单状态更新

---

## 🔧 如何在其他模块中使用

### 1. 在 API 路由中使用

```typescript
// app/api/sales-orders/route.ts
import { reserveInventory } from '@/lib/services/inventory-realtime-service';
import { notifyOrderCreated } from '@/lib/services/notification-service';

export async function POST(request: Request) {
  const data = await request.json();

  // 1. 预留库存
  for (const item of data.items) {
    const success = await reserveInventory(
      item.productId,
      item.variantId,
      item.quantity,
      'temp-order-id'
    );

    if (!success) {
      return NextResponse.json({ error: '库存不足' }, { status: 400 });
    }
  }

  // 2. 创建订单
  const order = await prisma.salesOrder.create({ data });

  // 3. 发送通知
  await notifyOrderCreated(
    order.customerId,
    order.id,
    order.orderNumber,
    order.totalAmount
  );

  return NextResponse.json({ success: true, data: order });
}
```

### 2. 在 WebSocket 服务器中使用

```typescript
// lib/ws/ws-server.ts
import {
  subscribeUserNotifications,
  subscribeOrderUpdates,
  subscribeInventoryUpdates,
} from '@/lib/services/notification-service';

export function setupWebSocketSubscriptions(ws: WebSocket, userId: string) {
  // 订阅用户通知
  subscribeUserNotifications(userId, notification => {
    ws.send(
      JSON.stringify({
        type: 'notification',
        data: notification,
      })
    );
  });

  // 订阅订单更新
  subscribeOrderUpdates((orderId, event) => {
    ws.send(
      JSON.stringify({
        type: 'order_update',
        orderId,
        data: event,
      })
    );
  });

  // 订阅库存更新
  subscribeInventoryUpdates((productId, event) => {
    ws.send(
      JSON.stringify({
        type: 'inventory_update',
        productId,
        data: event,
      })
    );
  });
}
```

### 3. 在前端组件中使用

```typescript
// components/providers/websocket-provider.tsx
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3002');

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'notification':
          // 显示通知
          toast.info(message.data.message);
          break;

        case 'order_update':
          // 失效订单查询
          queryClient.invalidateQueries(['orders', message.orderId]);
          break;

        case 'inventory_update':
          // 失效库存查询
          queryClient.invalidateQueries(['inventory', message.productId]);
          break;
      }
    };

    return () => ws.close();
  }, [queryClient]);

  return <>{children}</>;
}
```

---

## 📝 最佳实践

### 1. 事务使用

- ✅ **DO**: 用于需要原子性的操作
- ✅ **DO**: 保持事务简短，避免长时间阻塞
- ✅ **DO**: 在事务中只执行必要的命令
- ❌ **DON'T**: 在事务中执行耗时操作
- ❌ **DON'T**: 在事务中调用外部 API

### 2. Pub/Sub 使用

- ✅ **DO**: 用于实时通知和事件驱动
- ✅ **DO**: 使用模式订阅监听多个频道
- ✅ **DO**: 在订阅回调中处理错误
- ❌ **DON'T**: 用于需要持久化的消息（使用消息队列）
- ❌ **DON'T**: 在订阅回调中执行耗时操作

### 3. 性能优化

- 使用批量操作减少网络往返
- 合理设置 TTL 避免内存溢出
- 使用 Redis 缓存减少数据库查询
- 监控 Redis 性能指标

---

## 🚀 下一步

### 立即可用

1. ✅ 在订单创建 API 中使用库存预留
2. ✅ 在订单支付 API 中使用支付处理
3. ✅ 在 WebSocket 服务器中订阅通知

### 待实施

1. ⏳ 添加更多业务场景的事务支持
2. ⏳ 完善前端实时通知组件
3. ⏳ 添加性能监控和告警

---

**总结**: 已为项目的核心模块（库存、订单、通知）集成 Redis 新特性，提供了完整的实时更新和通知能力！
