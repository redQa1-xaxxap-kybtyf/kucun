# 生产部署指南

## 部署架构选择

### 推荐方案：单实例 + 负载均衡器

```
    [Nginx/HAProxy]
          |
    [Next.js App]  (单实例 PM2)
          |
    [Redis] [PostgreSQL]
```

**优点：**

- 支持所有 Next.js 功能（包括 ISR、Server Actions、WebSocket）
- 无状态竞争问题
- 易于调试和监控
- 横向扩展通过多服务器实现

**使用方法：**

```bash
# 使用标准配置文件
pm2 start ecosystem.config.js --env production
```

### 备选方案：集群模式（需谨慎）

```
    [Nginx/HAProxy]
          |
    [PM2 Cluster Manager]
      /    |    \
  [App1] [App2] [App3]  (多实例)
          |
    [Redis] [PostgreSQL]
```

**限制：**

- 某些 Next.js 功能可能失效
- 需要 sticky sessions 支持 WebSocket
- 可能有状态竞争问题

**使用方法：**

```bash
# 使用集群配置文件
pm2 start ecosystem.cluster.config.js --env production
```

## 部署步骤

### 1. 环境准备

```bash
# 安装依赖
npm ci --production

# 构建应用
npm run build

# 准备环境变量
cp .env.example .env.production
# 编辑 .env.production 填入生产环境配置
```

### 2. 数据库准备

```bash
# 同步数据库结构
npx prisma migrate deploy

# 生成 Prisma Client
npx prisma generate
```

### 3. 启动服务

#### 单实例模式（推荐）

```bash
# 启动应用
pm2 start ecosystem.config.js --env production

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup
```

#### 集群模式（如需要）

```bash
# 启动集群
pm2 start ecosystem.cluster.config.js --env production

# 保存配置
pm2 save
```

### 4. Nginx 配置示例

```nginx
# /etc/nginx/sites-available/kucun
upstream nextjs_app {
    server localhost:3000;
    # 如果使用多服务器
    # server server2:3000;
    # server server3:3000;
}

upstream websocket_app {
    server localhost:3002;
}

server {
    listen 80;
    server_name your-domain.com;

    # 强制 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 配置
    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;

    # 主应用
    location / {
        proxy_pass http://nextjs_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws {
        proxy_pass http://websocket_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }

    # 静态资源缓存
    location /_next/static {
        proxy_pass http://nextjs_app;
        proxy_cache_valid 60m;
        add_header Cache-Control "public, immutable";
    }
}
```

## 监控和维护

### PM2 监控命令

```bash
# 查看进程状态
pm2 status

# 查看日志
pm2 logs kucun-app
pm2 logs kucun-ws

# 查看详细信息
pm2 info kucun-app

# 监控面板
pm2 monit

# 重启服务
pm2 restart kucun-app
pm2 reload kucun-app  # 零停机重载
```

### 日志管理

```bash
# 日志轮转配置
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

### 性能优化

1. **内存优化**
   - 调整 `max_memory_restart` 参数
   - 使用 `NODE_OPTIONS="--max-old-space-size=2048"`

2. **并发优化**
   - 单实例模式下使用 Nginx 负载均衡
   - 合理配置 worker_connections

3. **缓存策略**
   - 使用 Redis 缓存热点数据
   - 配置 CDN 加速静态资源

## 故障排查

### 常见问题

1. **内存泄漏**

   ```bash
   # 查看内存使用
   pm2 describe kucun-app | grep memory

   # 生成堆快照
   pm2 trigger kucun-app heapdump
   ```

2. **端口占用**

   ```bash
   # 查看端口占用
   lsof -i :3000
   netstat -tulpn | grep 3000
   ```

3. **进程频繁重启**

   ```bash
   # 查看错误日志
   pm2 logs kucun-app --err

   # 增加重启延迟
   pm2 set kucun-app:restart_delay 10000
   ```

## 安全建议

1. 使用 HTTPS 和 SSL 证书
2. 配置防火墙规则
3. 定期更新依赖
4. 使用环境变量管理敏感信息
5. 启用 CORS 和 CSP 策略
6. 实施速率限制

## 备份策略

```bash
# 数据库备份
pg_dump kucun_production > backup-$(date +%Y%m%d).sql

# 应用备份
tar -czf kucun-backup-$(date +%Y%m%d).tar.gz \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=logs \
  .
```

## 回滚流程

```bash
# 保存当前版本
pm2 save

# 回滚到上一版本
git checkout previous-tag
npm ci --production
npm run build
pm2 reload ecosystem.config.js --env production
```
