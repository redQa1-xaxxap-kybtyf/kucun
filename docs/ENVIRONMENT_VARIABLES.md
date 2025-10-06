# 环境变量配置指南

> 本文档详细说明了库存管理系统的所有环境变量配置

## 📋 目录

- [快速开始](#快速开始)
- [必需变量](#必需变量)
- [可选变量](#可选变量)
- [环境变量分类](#环境变量分类)
- [验证机制](#验证机制)
- [常见问题](#常见问题)
- [故障排除](#故障排除)

## 🚀 快速开始

### 1. 复制环境变量模板

```bash
# 开发环境
cp .env.example .env.local

# 生产环境
cp .env.example .env.production
```

### 2. 配置必需变量

以下变量是**必须配置**的，否则应用无法启动：

```bash
# 数据库连接字符串
DATABASE_URL="mysql://user:password@localhost:3306/kucun"

# NextAuth.js 加密密钥（至少32字符）
NEXTAUTH_SECRET="your-secret-key-min-32-characters"

# 存储加密密钥（32-64字符）
STORAGE_ENCRYPTION_KEY="your-32-char-or-longer-encryption-key"
```

### 3. 生成密钥

```bash
# 生成 NEXTAUTH_SECRET
openssl rand -base64 32

# 生成 STORAGE_ENCRYPTION_KEY
openssl rand -hex 32
```

### 4. 启动应用

```bash
npm run dev
```

## 🔑 必需变量

### DATABASE_URL

**用途**: MySQL 数据库连接字符串

**格式**: `mysql://用户名:密码@主机:端口/数据库名?参数`

**示例**:

```bash
# 开发环境（SQLite）
DATABASE_URL="file:./prisma/dev.db"

# 生产环境（MySQL）
DATABASE_URL="mysql://root:password@localhost:3306/kucun?connection_limit=10&pool_timeout=30&connect_timeout=10"

# 生产环境（PostgreSQL）
DATABASE_URL="postgresql://user:password@localhost:5432/kucun?connection_limit=10&pool_timeout=30&connect_timeout=10"
```

**验证规则**:

- 必须以 `file:`、`mysql:`、`postgresql:` 或 `sqlite:` 开头
- 不能为空

**获取方式**:

- 本地开发：使用 SQLite（无需安装数据库）
- 生产环境：安装 MySQL 8.0+ 或 PostgreSQL

---

### NEXTAUTH_SECRET

**用途**: Next-Auth.js 加密密钥，用于加密会话和 JWT

**格式**: 至少32字符的随机字符串

**示例**:

```bash
NEXTAUTH_SECRET="your-secret-key-change-this-in-production-min-32-chars"
```

**验证规则**:

- 最小长度：32字符
- 必须配置

**生成命令**:

```bash
openssl rand -base64 32
```

**安全提示**:

- ⚠️ 生产环境必须使用强随机密钥
- ⚠️ 不要在版本控制中提交真实密钥
- ⚠️ 定期更换密钥（会导致所有用户重新登录）

---

### STORAGE_ENCRYPTION_KEY

**用途**: 用于加密敏感数据（如七牛云密钥）

**格式**: 32-64字符的十六进制字符串

**示例**:

```bash
STORAGE_ENCRYPTION_KEY="your-32-char-or-longer-encryption-key-change-this"
```

**验证规则**:

- 最小长度：32字符
- 最大长度：64字符
- 必须配置

**生成命令**:

```bash
openssl rand -hex 32
```

**用途说明**:

- 加密七牛云 Access Key 和 Secret Key
- 加密其他敏感配置信息
- 使用 AES-256-CBC 加密算法

---

## ⚙️ 可选变量

### 核心配置

#### NODE_ENV

**用途**: 应用运行环境

**可选值**: `development` | `production` | `test`

**默认值**: `development`

**示例**:

```bash
NODE_ENV=production
```

---

#### PORT

**用途**: 应用服务器端口

**默认值**: `3000`

**示例**:

```bash
PORT=3000
```

---

#### NEXTAUTH_URL

**用途**: Next-Auth.js 回调 URL

**格式**: 完整的 URL（包含协议和域名）

**默认值**: 开发环境自动使用 `http://localhost:PORT`

**示例**:

```bash
# 开发环境
NEXTAUTH_URL=http://localhost:3000

# 生产环境（必需）
NEXTAUTH_URL=https://your-domain.com
```

**注意事项**:

- ⚠️ 生产环境必须配置
- ⚠️ 必须与实际访问域名一致
- ⚠️ 使用 HTTPS 时必须配置 SSL 证书

---

### 数据库配置

#### BCRYPT_SALT_ROUNDS

**用途**: bcrypt 加密强度

**默认值**: `12`

**推荐值**: `10-12`（更高更安全但更慢）

**示例**:

```bash
BCRYPT_SALT_ROUNDS=12
```

---

### Redis 缓存配置

#### REDIS_URL

**用途**: Redis 连接地址

**默认值**: `redis://127.0.0.1:6379`

**示例**:

```bash
# 本地 Redis
REDIS_URL=redis://127.0.0.1:6379

# 远程 Redis（带密码）
REDIS_URL=redis://:password@remote-host:6379

# Redis Sentinel
REDIS_URL=redis://sentinel-host:26379?sentinelPassword=password&sentinelMasterId=mymaster
```

---

#### REDIS_POOL_SIZE

**用途**: Redis 连接池大小

**默认值**: `3`

**推荐值**: `3-10`（根据并发量调整）

**示例**:

```bash
REDIS_POOL_SIZE=5
```

---

#### REDIS_NAMESPACE

**用途**: Redis 缓存命名空间前缀

**默认值**: `kucun`

**示例**:

```bash
REDIS_NAMESPACE=kucun
```

**用途说明**:

- 避免多个应用共用 Redis 时的键冲突
- 便于批量清理缓存

---

### WebSocket 配置

#### WS_PORT

**用途**: WebSocket 服务端口

**默认值**: `3002`

**示例**:

```bash
WS_PORT=3002
```

---

#### NEXT_PUBLIC_WS_PORT

**用途**: 客户端 WebSocket 端口（必须以 `NEXT_PUBLIC_` 开头）

**默认值**: `3002`

**示例**:

```bash
NEXT_PUBLIC_WS_PORT=3002
```

**注意事项**:

- ⚠️ 必须与 `WS_PORT` 保持一致
- ⚠️ 客户端可访问的环境变量

---

#### WS_ALLOWED_ORIGINS

**用途**: 允许的 WebSocket Origin（逗号分隔）

**默认值**: 空（允许所有）

**示例**:

```bash
# 生产环境必需配置
WS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

---

### 文件上传配置

#### UPLOAD_DIR

**用途**: 文件上传目录

**默认值**: `./public/uploads`

**示例**:

```bash
UPLOAD_DIR=./public/uploads
```

---

#### UPLOAD_MAX_SIZE

**用途**: 文件上传最大大小（字节）

**默认值**: `10485760`（10MB）

**示例**:

```bash
UPLOAD_MAX_SIZE=10485760
```

---

### 速率限制配置

#### RATE_LIMIT_ENABLED

**用途**: 是否启用速率限制

**默认值**: `true`

**示例**:

```bash
RATE_LIMIT_ENABLED=true
```

---

#### RATE_LIMIT_GLOBAL

**用途**: 全局速率限制（请求数/分钟）

**默认值**: `100`

**示例**:

```bash
RATE_LIMIT_GLOBAL=100
```

---

#### RATE_LIMIT_AUTH

**用途**: 认证 API 速率限制（请求数/分钟）

**默认值**: `5`

**示例**:

```bash
RATE_LIMIT_AUTH=5
```

---

#### RATE_LIMIT_LOGIN

**用途**: 登录速率限制（请求数/分钟）

**默认值**: `5`

**示例**:

```bash
RATE_LIMIT_LOGIN=5
```

**用途说明**:

- 防止暴力破解攻击
- 保护登录接口安全

---

### 性能监控配置

#### ENABLE_MEMORY_MONITOR

**用途**: 是否启用内存监控

**默认值**: `false`

**示例**:

```bash
ENABLE_MEMORY_MONITOR=true
```

---

#### MONITORING_TOKEN

**用途**: 内存监控 API 访问令牌

**默认值**: `dev-token-change-in-production`

**示例**:

```bash
MONITORING_TOKEN=your-secure-monitoring-token
```

**访问方式**:

```bash
curl -H "Authorization: Bearer your-secure-monitoring-token" \
  http://localhost:3000/api/monitoring/memory
```

---

## 📂 环境变量分类

### 按功能分类

| 分类      | 变量数量 | 主要变量                                                     |
| --------- | -------- | ------------------------------------------------------------ |
| 核心配置  | 3        | `NODE_ENV`, `PORT`, `NEXTAUTH_URL`                           |
| 数据库    | 2        | `DATABASE_URL`, `BCRYPT_SALT_ROUNDS`                         |
| 认证      | 2        | `NEXTAUTH_SECRET`, `NEXTAUTH_URL`                            |
| 缓存      | 3        | `REDIS_URL`, `REDIS_POOL_SIZE`, `REDIS_NAMESPACE`            |
| WebSocket | 3        | `WS_PORT`, `NEXT_PUBLIC_WS_PORT`, `WS_ALLOWED_ORIGINS`       |
| 文件上传  | 5        | `UPLOAD_DIR`, `UPLOAD_MAX_SIZE`, `STORAGE_ENCRYPTION_KEY`    |
| 速率限制  | 7        | `RATE_LIMIT_ENABLED`, `RATE_LIMIT_GLOBAL`, `RATE_LIMIT_AUTH` |
| 性能监控  | 2        | `ENABLE_MEMORY_MONITOR`, `MONITORING_TOKEN`                  |
| 业务配置  | 40+      | 库存、订单、财务等模块配置                                   |

---

## ✅ 验证机制

### Zod 验证

项目使用 Zod 对所有环境变量进行严格验证（`lib/env.ts`）：

1. **类型验证**: URL、数字、枚举等都有严格的类型检查
2. **长度验证**: 密钥类型的变量有最小长度要求
3. **格式验证**: 数据库连接字符串、URL 等有格式验证
4. **默认值**: 大部分配置都有合理的默认值

### 验证失败处理

如果环境变量验证失败，应用启动时会显示详细的错误信息：

```bash
❌ 环境变量验证失败:
  - NEXTAUTH_SECRET: NEXTAUTH_SECRET 长度至少为32位
  - DATABASE_URL: 数据库连接字符串不能为空
  - STORAGE_ENCRYPTION_KEY: STORAGE_ENCRYPTION_KEY 必须至少32个字符
```

---

## ❓ 常见问题

### Q1: 七牛云配置在哪里？

**A**: 七牛云配置不通过环境变量设置，而是通过系统设置页面配置：

1. 登录系统
2. 进入 **系统设置 → 存储配置**
3. 填写以下信息：
   - Access Key: 七牛云访问密钥
   - Secret Key: 七牛云私钥
   - Bucket: 存储空间名称
   - Domain: 访问域名（CDN加速域名）
   - Region: 存储区域（z0=华东, z1=华北, z2=华南）

**获取七牛云密钥**: https://portal.qiniu.com/user/key

---

### Q2: 如何切换数据库？

**A**: 修改 `DATABASE_URL` 环境变量：

```bash
# SQLite（开发）
DATABASE_URL="file:./prisma/dev.db"

# MySQL（生产）
DATABASE_URL="mysql://user:password@localhost:3306/kucun"

# PostgreSQL（生产）
DATABASE_URL="postgresql://user:password@localhost:5432/kucun"
```

然后运行数据库迁移：

```bash
npx prisma migrate deploy
```

---

### Q3: 如何配置 HTTPS？

**A**:

1. 配置 `NEXTAUTH_URL` 为 HTTPS 地址：

   ```bash
   NEXTAUTH_URL=https://your-domain.com
   ```

2. 使用 Nginx 或 Caddy 作为反向代理，配置 SSL 证书

3. 配置 WebSocket 允许的 Origin：
   ```bash
   WS_ALLOWED_ORIGINS=https://your-domain.com
   ```

---

## 🔧 故障排除

### 问题 1: 应用启动失败

**症状**: 应用启动时报错 "环境变量验证失败"

**解决方案**:

1. 检查 `.env.local` 文件是否存在
2. 确认所有必需变量已配置
3. 检查变量格式是否正确
4. 查看详细错误信息，逐个修复

---

### 问题 2: 数据库连接失败

**症状**: 应用启动时报错 "数据库连接失败"

**解决方案**:

1. 检查 `DATABASE_URL` 格式是否正确
2. 确认数据库服务已启动
3. 检查用户名、密码、主机、端口是否正确
4. 测试数据库连接：
   ```bash
   npx prisma db pull
   ```

---

### 问题 3: Redis 连接失败

**症状**: 应用启动时报错 "Redis 连接失败"

**解决方案**:

1. 检查 `REDIS_URL` 格式是否正确
2. 确认 Redis 服务已启动
3. 检查 Redis 密码是否正确
4. 测试 Redis 连接：
   ```bash
   redis-cli -h 127.0.0.1 -p 6379 ping
   ```

---

### 问题 4: 文件上传失败

**症状**: 上传文件时报错 "加密失败"

**解决方案**:

1. 检查 `STORAGE_ENCRYPTION_KEY` 是否配置
2. 确认密钥长度至少32字符
3. 重新生成密钥：
   ```bash
   openssl rand -hex 32
   ```

---

## 📚 相关文档

- [Next.js 环境变量文档](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [Prisma 数据库连接](https://www.prisma.io/docs/concepts/database-connectors)
- [Next-Auth.js 配置](https://next-auth.js.org/configuration/options)
- [Redis 配置](https://redis.io/docs/manual/config/)

---

## 🔐 安全最佳实践

1. ✅ 使用强随机密钥（至少32字符）
2. ✅ 不要在版本控制中提交 `.env.local` 文件
3. ✅ 生产环境使用 HTTPS
4. ✅ 定期更换密钥
5. ✅ 使用环境变量管理工具（如 Vault、AWS Secrets Manager）
6. ✅ 限制环境变量访问权限
7. ✅ 监控环境变量使用情况

---

**最后更新**: 2025-01-XX

**维护者**: 库存管理系统开发团队
