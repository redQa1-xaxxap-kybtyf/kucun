# 端口/协议依赖重构总结报告

## 执行日期

2025-10-04

## 重构目标

消除验证码、WebSocket 鉴权、PM2 启动方式中的硬编码端口/协议依赖，实现灵活的部署配置。

## 重构成果

### 1. ✅ 验证码服务

**当前状态:** 已基于 Redis 实现，无 HTTP 调用依赖

**架构特点:**

- ✅ 完全基于 Redis 存储验证码会话
- ✅ 无硬编码 URL 或端口依赖
- ✅ 支持分布式部署环境
- ✅ 使用随机 TTL 防止缓存雪崩

### 2. ✅ WebSocket 鉴权重构

**修改文件:** `lib/ws/ws-auth.ts`

**重构方案:**

```typescript
// ✅ 直接解析 JWT Token，无 HTTP 调用
import { decode } from 'next-auth/jwt';

export async function verifyWebSocketAuth(cookieHeader: string) {
  const token = getSessionTokenFromCookies(cookieHeader);
  const decoded = await decode({ token, secret: JWT_SECRET });

  return {
    authenticated: true,
    userId: decoded.id,
    username: decoded.username,
    role: decoded.role,
  };
}
```

**优势:**

- 无 HTTP 调用，避免端口依赖
- 性能更优，减少网络往返
- 支持任意端口部署

### 3. ✅ WebSocket 客户端重构

**修改文件:** `lib/ws/ws-client.ts`

**重构后:**

```typescript
// ✅ 自动检测协议和主机，端口从环境变量读取
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const host = window.location.hostname;
const port = wsConfig.clientPort; // 从 NEXT_PUBLIC_WS_PORT 读取

ws = new WebSocket(`${protocol}//${host}:${port}`);
```

### 4. ✅ PM2 配置重构

**修改文件:** `ecosystem.config.js`

**重构后:**

```javascript
// ✅ 从环境变量读取，支持灵活配置
module.exports = {
  apps: [
    {
      name: 'kucun-app',
      env: {
        PORT: process.env.PORT || 3000,
      },
    },
    {
      name: 'kucun-ws',
      env: {
        WS_PORT: process.env.WS_PORT || 3002,
        WS_ALLOWED_ORIGINS: process.env.WS_ALLOWED_ORIGINS || '',
      },
    },
  ],
};
```

### 5. ✅ 环境变量配置

**新增文件:** `.env.example`

**关键配置:**

```bash
# 应用端口 (灵活配置)
PORT=3000

# WebSocket 端口
WS_PORT=3002
NEXT_PUBLIC_WS_PORT=3002

# 允许的 Origin
WS_ALLOWED_ORIGINS=https://yourdomain.com
```

## 架构改进对比

### 重构前

```
❌ 验证码: 可能有 HTTP 调用
❌ WebSocket: 硬编码端口 3002
❌ PM2: 硬编码端口配置
❌ 客户端: ws://localhost:3002
```

### 重构后

```
✅ 验证码: Redis 存储，无 HTTP
✅ WebSocket: JWT 直接解析
✅ PM2: 环境变量配置端口
✅ 客户端: 自动检测协议和主机
✅ 支持任意端口和域名
✅ 支持反向代理和容器化
```

## 部署场景支持

### 1. 本地开发

```bash
PORT=3000 WS_PORT=3002 npm run dev
```

### 2. 生产环境 (Nginx)

```bash
PORT=8080 WS_PORT=8081 pm2 start ecosystem.config.js
```

### 3. Docker 部署

```dockerfile
ENV PORT=3000
ENV WS_PORT=3002
EXPOSE 3000 3002
```

### 4. Kubernetes

```yaml
env:
  - name: PORT
    value: '3000'
  - name: WS_PORT
    value: '3002'
```

## 性能改进

### 减少网络往返

- 验证码: 直接 Redis 存储 (无 HTTP 往返)
- WebSocket 鉴权: JWT 本地解析 (无 HTTP 调用)

## 遵循规范

✅ 移除所有硬编码端口依赖
✅ 环境变量驱动配置
✅ 支持灵活部署场景
✅ 保持向后兼容性
✅ 严格遵循全局约定规范

## 关键文件清单

- ✅ `lib/services/captcha-service.ts` - 验证码服务
- ✅ `lib/ws/ws-auth.ts` - WebSocket 鉴权
- ✅ `lib/ws/ws-client.ts` - WebSocket 客户端
- ✅ `ecosystem.config.js` - PM2 配置
- ✅ `.env.example` - 环境变量模板
