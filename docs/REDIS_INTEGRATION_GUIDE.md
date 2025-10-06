# Redis 新特性集成指南

> 如何在项目的其他模块中使用 Redis Pub/Sub 和事务功能

## 📋 目录

1. [Pub/Sub 集成场景](#pubsub-集成场景)
2. [事务集成场景](#事务集成场景)
3. [实时通知系统](#实时通知系统)
4. [库存管理](#库存管理)
5. [订单处理](#订单处理)
6. [财务管理](#财务管理)
7. [用户会话管理](#用户会话管理)

---

## Pub/Sub 集成场景

### 1. 实时库存更新通知

**场景**: 当库存发生变化时，通知所有连接的客户端更新界面

**实现位置**: `lib/services/inventory-service.ts`

```typescript
import { publish } from '@/lib/redis/redis-pubsub';

// 库存更新后发布通知
export async function updateInventory(productId: string, quantity: number) {
  // 1. 更新数据库
  await prisma.inventory.update({
    where: { productId },
    data: { quantity },
  });

  // 2. 发布 Pub/Sub 通知
  await publish('inventory:updated', {
    productId,
    quantity,
    timestamp: new Date().toISOString(),
  });

  // 3. 失效缓存
  await revalidateInventory(productId);
}
```

**前端订阅** (`components/providers/websocket-provider.tsx`):

```typescript
import { subscribe } from '@/lib/redis/redis-pubsub';

useEffect(() => {
  // 订阅库存更新
  subscribe('inventory:updated', message => {
    const data = JSON.parse(message);
    // 更新本地状态或重新获取数据
    queryClient.invalidateQueries(['inventory', data.productId]);
  });
}, []);
```

---

### 2. 订单状态变更通知

**场景**: 订单状态变更时通知相关用户

**实现位置**: `lib/services/order-service.ts`

```typescript
import { publish } from '@/lib/redis/redis-pubsub';

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  // 1. 更新订单状态
  const order = await prisma.salesOrder.update({
    where: { id: orderId },
    data: { status },
  });

  // 2. 发布状态变更通知
  await publish(`order:${orderId}:status`, {
    orderId,
    status,
    customerId: order.customerId,
    timestamp: new Date().toISOString(),
  });

  // 3. 发布用户级别通知
  await publish(`user:${order.customerId}:notifications`, {
    type: 'order_status_changed',
    orderId,
    status,
    message: `订单 ${order.orderNumber} 状态已更新为 ${status}`,
  });
}
```

---

### 3. 系统广播消息

**场景**: 系统维护通知、公告等

**实现位置**: `lib/services/notification-service.ts`

```typescript
import { publish } from '@/lib/redis/redis-pubsub';

export async function broadcastSystemMessage(
  message: string,
  type: 'info' | 'warning' | 'error'
) {
  await publish('system:broadcast', {
    type,
    message,
    timestamp: new Date().toISOString(),
  });
}

// 使用示例
await broadcastSystemMessage('系统将于今晚 22:00 进行维护', 'warning');
```

---

## 事务集成场景

### 1. 库存扣减（已实现）

**位置**: `lib/redis/redis-transaction-example.ts`

**使用场景**:

- 创建销售订单时扣减库存
- 取消订单时恢复库存
- 退货时增加库存

**集成到订单创建**:

```typescript
// app/api/sales-orders/route.ts
import { deductInventoryAtomic } from '@/lib/redis/redis-transaction-example';

export async function POST(request: Request) {
  const data = await request.json();

  // 1. 验证库存
  for (const item of data.items) {
    const success = await deductInventoryAtomic(
      item.productId,
      item.variantId,
      item.quantity
    );

    if (!success) {
      return NextResponse.json({ error: '库存不足' }, { status: 400 });
    }
  }

  // 2. 创建订单
  const order = await prisma.salesOrder.create({
    data: {
      ...data,
      status: 'pending',
    },
  });

  return NextResponse.json({ success: true, data: order });
}
```

---

### 2. 订单支付处理

**场景**: 处理订单支付时，需要原子性地更新多个相关记录

**实现位置**: `lib/services/payment-service.ts`

```typescript
import { redis } from '@/lib/redis/redis-client';

export async function processOrderPayment(
  orderId: string,
  paymentAmount: number,
  paymentMethod: string
) {
  // 使用事务确保原子性
  const results = await redis.transaction(async pipeline => {
    const orderKey = `order:${orderId}`;
    const statsKey = `stats:daily:${new Date().toISOString().split('T')[0]}`;

    // 1. 更新订单支付状态
    pipeline.hset(orderKey, 'paymentStatus', 'paid');
    pipeline.hset(orderKey, 'paidAmount', paymentAmount);
    pipeline.hset(orderKey, 'paidAt', new Date().toISOString());

    // 2. 更新每日统计
    pipeline.hincrby(statsKey, 'totalRevenue', paymentAmount);
    pipeline.hincrby(statsKey, 'paidOrders', 1);

    // 3. 更新支付方式统计
    pipeline.hincrby(`stats:payment:${paymentMethod}`, 'count', 1);
    pipeline.hincrby(`stats:payment:${paymentMethod}`, 'amount', paymentAmount);

    return pipeline.exec();
  });

  if (!results) {
    throw new Error('支付处理失败');
  }

  // 发布支付成功通知
  await publish(`order:${orderId}:payment`, {
    orderId,
    amount: paymentAmount,
    method: paymentMethod,
    timestamp: new Date().toISOString(),
  });

  return true;
}
```

---

### 3. 客户余额管理

**场景**: 客户充值、消费时的余额变更

**实现位置**: `lib/services/customer-balance-service.ts`

```typescript
import { redis } from '@/lib/redis/redis-client';

export async function updateCustomerBalance(
  customerId: string,
  amount: number,
  type: 'recharge' | 'consume',
  orderId?: string
) {
  const results = await redis.transaction(async pipeline => {
    const balanceKey = `customer:${customerId}:balance`;
    const historyKey = `customer:${customerId}:balance:history`;

    // 1. 更新余额
    const delta = type === 'recharge' ? amount : -amount;
    pipeline.hincrby(balanceKey, 'amount', delta);

    // 2. 记录历史
    const record = JSON.stringify({
      type,
      amount,
      orderId,
      timestamp: new Date().toISOString(),
    });
    pipeline.lpush(historyKey, record);
    pipeline.ltrim(historyKey, 0, 99); // 只保留最近100条

    // 3. 更新统计
    if (type === 'recharge') {
      pipeline.hincrby(balanceKey, 'totalRecharge', amount);
    } else {
      pipeline.hincrby(balanceKey, 'totalConsume', amount);
    }

    return pipeline.exec();
  });

  if (!results) {
    throw new Error('余额更新失败');
  }

  return true;
}
```

---

## 实时通知系统

### 集成到 WebSocket 服务器

**位置**: `lib/ws/ws-server.ts`

```typescript
import { subscribe, psubscribe } from '@/lib/redis/redis-pubsub';

// 订阅用户级别通知
export function subscribeUserNotifications(userId: string, ws: WebSocket) {
  subscribe(`user:${userId}:notifications`, message => {
    const data = JSON.parse(message);
    ws.send(
      JSON.stringify({
        type: 'notification',
        data,
      })
    );
  });
}

// 订阅所有订单状态变更（使用模式订阅）
export function subscribeOrderUpdates(ws: WebSocket) {
  psubscribe('order:*:status', (message, channel) => {
    const orderId = channel.split(':')[1];
    const data = JSON.parse(message);
    ws.send(
      JSON.stringify({
        type: 'order_update',
        orderId,
        data,
      })
    );
  });
}

// 订阅系统广播
export function subscribeSystemBroadcast(ws: WebSocket) {
  subscribe('system:broadcast', message => {
    const data = JSON.parse(message);
    ws.send(
      JSON.stringify({
        type: 'system_message',
        data,
      })
    );
  });
}
```

---

## 库存管理

### 批量库存更新

**位置**: `lib/services/inventory-batch-service.ts`

```typescript
import { redis } from '@/lib/redis/redis-client';
import { publish } from '@/lib/redis/redis-pubsub';

export async function batchUpdateInventory(
  updates: Array<{ productId: string; variantId?: string; quantity: number }>
) {
  // 使用事务批量更新
  const results = await redis.transaction(async pipeline => {
    for (const update of updates) {
      const key = update.variantId
        ? `inventory:${update.productId}:${update.variantId}`
        : `inventory:${update.productId}`;

      pipeline.hset(key, 'quantity', update.quantity);
      pipeline.hset(key, 'updatedAt', new Date().toISOString());
    }

    return pipeline.exec();
  });

  if (!results) {
    throw new Error('批量更新失败');
  }

  // 发布批量更新通知
  await publish('inventory:batch:updated', {
    count: updates.length,
    timestamp: new Date().toISOString(),
  });

  return true;
}
```

---

## 订单处理

### 订单创建流程（完整示例）

**位置**: `app/api/sales-orders/route.ts`

```typescript
import { redis } from '@/lib/redis/redis-client';
import { publish } from '@/lib/redis/redis-pubsub';
import { deductInventoryAtomic } from '@/lib/redis/redis-transaction-example';

export async function POST(request: Request) {
  const data = await request.json();

  try {
    // 1. 验证并扣减库存（使用事务）
    for (const item of data.items) {
      const success = await deductInventoryAtomic(
        item.productId,
        item.variantId,
        item.quantity
      );

      if (!success) {
        return NextResponse.json(
          { error: `产品 ${item.productId} 库存不足` },
          { status: 400 }
        );
      }
    }

    // 2. 创建订单（数据库事务）
    const order = await prisma.$transaction(async tx => {
      const newOrder = await tx.salesOrder.create({
        data: {
          ...data,
          status: 'pending',
        },
      });

      // 创建订单项
      await tx.salesOrderItem.createMany({
        data: data.items.map((item: any) => ({
          orderId: newOrder.id,
          ...item,
        })),
      });

      return newOrder;
    });

    // 3. 缓存订单信息（Redis）
    await redis.setJson(`order:${order.id}`, order, 3600);

    // 4. 发布订单创建通知
    await publish('order:created', {
      orderId: order.id,
      customerId: order.customerId,
      totalAmount: order.totalAmount,
      timestamp: new Date().toISOString(),
    });

    // 5. 发布用户通知
    await publish(`user:${order.customerId}:notifications`, {
      type: 'order_created',
      orderId: order.id,
      message: `订单 ${order.orderNumber} 创建成功`,
    });

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error('订单创建失败:', error);
    return NextResponse.json({ error: '订单创建失败' }, { status: 500 });
  }
}
```

---

## 使用建议

### 1. 何时使用 Pub/Sub

- ✅ 实时通知（订单状态、库存变更）
- ✅ 缓存失效通知（跨进程同步）
- ✅ 系统广播消息
- ✅ 事件驱动架构
- ❌ 不适合：需要持久化的消息（使用消息队列）

### 2. 何时使用事务

- ✅ 需要原子性操作（库存扣减、支付处理）
- ✅ 需要保证数据一致性
- ✅ 高并发场景（配合 WATCH 使用）
- ❌ 不适合：长时间运行的操作（会阻塞其他命令）

### 3. 性能优化

- 使用批量操作减少网络往返
- 合理设置 TTL 避免内存溢出
- 使用管道（Pipeline）提升性能
- 监控 Redis 性能指标

---

**下一步**: 根据实际业务需求，逐步将这些模式应用到项目的其他模块中。
