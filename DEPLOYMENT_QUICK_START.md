# 快速部署指南

## 环境变量配置

### 1. 复制环境变量模板

```bash
# 开发环境
cp .env.example .env.local

# 生产环境
cp .env.example .env.production
```

### 2. 最小必需配置

```bash
# .env.local 或 .env.production

# 数据库 (必需)
DATABASE_URL=mysql://user:password@localhost:3306/kucun

# 认证密钥 (必需, 至少32位)
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# 应用URL (生产环境必需)
NEXTAUTH_URL=https://yourdomain.com

# Redis (必需)
REDIS_URL=redis://127.0.0.1:6379

# 存储加密 (必需, 32-64字符)
STORAGE_ENCRYPTION_KEY=$(openssl rand -base64 32)
```

### 3. 端口配置 (可选, 默认值已可用)

```bash
# 应用端口 (默认: 3000)
PORT=3000

# WebSocket 端口 (默认: 3002)
WS_PORT=3002
NEXT_PUBLIC_WS_PORT=3002

# WebSocket 允许的 Origin (生产环境强烈推荐)
WS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

## 部署场景

### 开发环境

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填写必需配置

# 3. 数据库迁移
npx prisma generate
npx prisma db push

# 4. 启动开发服务器
npm run dev
```

### 生产环境 (PM2)

```bash
# 1. 安装依赖
npm ci --production

# 2. 配置环境变量
cp .env.example .env.production
# 编辑 .env.production 填写生产配置

# 3. 构建应用
npm run build

# 4. 数据库迁移
npx prisma generate
npx prisma migrate deploy

# 5. 启动 PM2
pm2 start ecosystem.config.js --env production

# 6. 保存 PM2 配置
pm2 save
pm2 startup
```

### Docker 部署

```bash
# 1. 构建镜像
docker build -t kucun-app .

# 2. 运行容器
docker run -d \
  --name kucun \
  -p 80:3000 \
  -p 3002:3002 \
  -e DATABASE_URL="mysql://user:pass@host:3306/kucun" \
  -e NEXTAUTH_SECRET="your-secret" \
  -e REDIS_URL="redis://redis:6379" \
  kucun-app

# 或使用 docker-compose
docker-compose up -d
```

### Nginx 反向代理

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Next.js 应用
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## 端口自定义示例

### 场景1: 使用非标准端口

```bash
# .env.production
PORT=8080
WS_PORT=8081
NEXT_PUBLIC_WS_PORT=8081

# 启动
PORT=8080 WS_PORT=8081 pm2 start ecosystem.config.js
```

### 场景2: 多实例部署

```bash
# 实例1
PORT=3000 WS_PORT=3002 pm2 start ecosystem.config.js --name instance1

# 实例2
PORT=3001 WS_PORT=3003 pm2 start ecosystem.config.js --name instance2

# Nginx 负载均衡
upstream backend {
    server localhost:3000;
    server localhost:3001;
}
```

### 场景3: Docker 动态端口

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    environment:
      - PORT=${APP_PORT:-3000}
      - WS_PORT=${WS_PORT:-3002}
    ports:
      - '${EXTERNAL_PORT:-80}:${APP_PORT:-3000}'
      - '${WS_EXTERNAL_PORT:-3002}:${WS_PORT:-3002}'
```

## 验证部署

### 1. 检查服务状态

```bash
# PM2
pm2 status
pm2 logs

# Docker
docker ps
docker logs kucun
```

### 2. 测试 HTTP 连接

```bash
curl http://localhost:3000
```

### 3. 测试 WebSocket 连接

```javascript
// 浏览器控制台
const ws = new WebSocket('ws://localhost:3002');
ws.onopen = () => console.log('WebSocket 连接成功');
```

## 故障排查

### 端口被占用

```bash
# Linux/Mac
lsof -i :3000
kill -9 <PID>

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### 环境变量未生效

```bash
# 检查环境变量
printenv | grep PORT
printenv | grep WS_PORT

# PM2 重载环境变量
pm2 reload ecosystem.config.js --update-env
```

### WebSocket 连接失败

1. 检查 `WS_ALLOWED_ORIGINS` 配置
2. 检查防火墙端口开放
3. 检查 Nginx WebSocket 配置

## 安全建议

### 生产环境必需

1. ✅ 设置强密码的 `NEXTAUTH_SECRET`
2. ✅ 配置 `WS_ALLOWED_ORIGINS` 限制来源
3. ✅ 使用 HTTPS/WSS (通过 Nginx)
4. ✅ 设置防火墙规则
5. ✅ 定期更新依赖

### 可选增强

1. 配置 Redis 密码认证
2. 使用 JWT 短期过期时间
3. 启用请求速率限制
4. 配置日志监控告警

## 性能优化

### PM2 集群模式 (仅 API)

```javascript
// ecosystem.config.js
{
  name: 'kucun-api',
  script: 'server.js',
  instances: 'max',  // CPU 核心数
  exec_mode: 'cluster',
}
```

### Redis 连接池

```bash
# .env.production
REDIS_POOL_SIZE=10  # 根据并发调整
```

### Nginx 缓存

```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m;

location / {
    proxy_cache my_cache;
    proxy_cache_valid 200 10m;
}
```

## 监控和日志

### PM2 监控

```bash
# 实时监控
pm2 monit

# 日志查看
pm2 logs --lines 100

# 错误日志
pm2 logs --err
```

### 应用日志

```bash
# 日志文件位置
./logs/app-out.log
./logs/app-err.log
./logs/ws-out.log
./logs/ws-err.log
```

## 支持

如有问题，请查看:

- 完整文档: `REFACTOR_SUMMARY.md`
- 环境变量说明: `.env.example`
- PM2 配置: `ecosystem.config.js`
