# Redis缓存和WebSocket实时通信集成文档

## 概述

本文档描述了在Next.js 15.4库存管理项目中集成Redis缓存和WebSocket实时通信功能的完整实现方案。

## 技术栈

- **Redis客户端**: ioredis v5
- **WebSocket**: ws库
- **缓存策略**: 分层缓存，TTL管理
- **实时通信**: 基于频道的消息推送
- **身份验证**: Next-Auth会话验证

## 架构设计

### 缓存层架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   前端组件      │    │   API路由       │    │   Redis缓存     │
│                 │    │                 │    │                 │
│ TanStack Query  │◄──►│ 缓存中间件      │◄──►│ 连接池管理      │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### WebSocket通信架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   前端客户端    │    │  WebSocket服务  │    │   API路由       │
│                 │    │                 │    │                 │
│ useWebSocket    │◄──►│ 频道管理        │◄──►│ 事件推送        │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 核心功能

### 1. Redis缓存

#### 缓存策略

- **产品列表**: 60秒TTL，支持查询参数哈希
- **库存数据**: 10秒TTL，频繁更新
- **用户会话**: 基于Next-Auth的身份验证

#### 缓存键命名规范

```
kucun:products:list:{hash}     # 产品列表
kucun:inventory:list:{hash}    # 库存列表
kucun:products:detail:{id}     # 产品详情
kucun:inventory:summary:{id}   # 库存汇总
```

### 2. WebSocket实时通信

#### 支持的频道

- `products`: 产品变更通知
- `inventory`: 库存变更通知
- `orders`: 订单状态更新

#### 消息格式

```typescript
interface WsMessage<T = unknown> {
  channel: string;
  data: T;
  ts: number;
}
```

## 使用示例

### 1. 在API路由中使用缓存

```typescript
import {
  buildCacheKey,
  getOrSetJSON,
  invalidateNamespace,
} from '@/lib/cache/cache';
import { publishWs } from '@/lib/ws/ws-server';

export async function GET(request: NextRequest) {
  const cacheKey = buildCacheKey('products:list', queryParams);

  const cached = await getOrSetJSON(
    cacheKey,
    async () => {
      // 数据库查询逻辑
      return await fetchFromDatabase();
    },
    60 // TTL秒
  );

  return NextResponse.json(cached);
}

export async function POST(request: NextRequest) {
  // 创建产品逻辑
  const product = await createProduct(data);

  // 缓存失效
  await invalidateNamespace('products:list:*');

  // WebSocket推送
  publishWs('products', {
    type: 'created',
    id: product.id,
    code: product.code,
  });

  return NextResponse.json(product);
}
```

### 2. 在前端组件中使用WebSocket

```typescript
import { useWebSocket } from '@/hooks/use-websocket';
import { useQueryClient } from '@tanstack/react-query';

function ProductList() {
  const queryClient = useQueryClient();

  useWebSocket({
    channels: ['products'],
    onMessage: message => {
      if (message.channel === 'products') {
        // 实时更新产品列表
        queryClient.invalidateQueries({ queryKey: ['products'] });
      }
    },
  });

  // 组件逻辑...
}
```

## 环境配置

### .env.local 配置

```bash
# Redis 配置
REDIS_URL="redis://127.0.0.1:6379"
REDIS_POOL_SIZE="3"
REDIS_NAMESPACE="kucun"

# WebSocket 配置
WS_PORT="3002"
WS_ALLOWED_ORIGINS="http://localhost:3001,https://yourdomain.com"
```

## 性能优化

### 缓存优化

1. **分层TTL**: 不同数据类型使用不同的缓存时间
2. **智能失效**: 基于数据变更的精确缓存失效
3. **连接池**: Redis连接池管理，避免连接泄漏

### WebSocket优化

1. **心跳检测**: 25秒间隔的ping/pong机制
2. **自动重连**: 指数退避重连策略
3. **频道管理**: 按需订阅/取消订阅

## 监控和调试

### 开发环境

- Redis连接状态日志
- WebSocket连接状态显示
- 缓存命中率统计

### 生产环境

- Redis性能监控
- WebSocket连接数监控
- 错误日志收集

## 部署注意事项

1. **Redis服务**: 确保Redis服务正常运行
2. **端口配置**: WebSocket端口需要在防火墙中开放
3. **Origin验证**: 生产环境需要配置允许的Origin
4. **内存管理**: 监控Redis内存使用情况

## 故障排除

### 常见问题

1. **Redis连接失败**: 检查REDIS_URL配置
2. **WebSocket连接被拒绝**: 检查WS_ALLOWED_ORIGINS配置
3. **缓存不生效**: 检查TTL设置和键命名
4. **实时更新延迟**: 检查WebSocket连接状态

### 调试工具

- Redis CLI: 查看缓存数据
- 浏览器开发者工具: 检查WebSocket连接
- TanStack Query DevTools: 查看查询缓存状态
