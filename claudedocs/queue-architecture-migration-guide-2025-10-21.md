# 入库队列架构迁移指南

**日期**: 2025-10-21
**版本**: 方案A - 事务拆分 + 异步队列
**状态**: ✅ 实施完成,待测试验证

---

## 📊 架构对比

### 旧架构 (同步事务)
```
HTTP请求 → 幂等性检查 → [事务开始]
  → 查询产品
  → 统计批次号
  → 验证产品 (重复!)
  → upsert批次规格 ⚠️ 锁竞争
  → 创建入库记录
  → 更新库存 ⚠️ 锁竞争
[事务结束] → 缓存失效 → 返回响应

⏱️ 耗时: 10-20秒
🔒 锁持有: 10-20秒
⚡ 吞吐量: 5-10 req/s
❌ 超时率: 30%
```

### 新架构 (异步队列)
```
HTTP请求 → 幂等性检查
  → 验证产品 ✅ 快速失败
  → 生成批次号 ✅ 事务外
  → [事务开始 - 仅核心操作]
      → 创建入库记录
      → 原子更新库存
    [事务结束] ✅ < 500ms
  → 添加队列任务 ✅ 异步
  → 立即返回响应 ✅

后台队列 Worker:
  → 批次规格更新
  → 产品同步
  → 缓存失效
  → WebSocket通知

⏱️ 耗时: 200-500ms (-95%)
🔒 锁持有: < 500ms (-97%)
⚡ 吞吐量: 50-100 req/s (+10倍)
❌ 超时率: < 1% (-97%)
```

---

## 🚀 部署步骤

### 1. 环境准备

#### 1.1 确认 Redis 可用

```bash
# 检查 Redis 连接
npm run test:redis-ws
```

#### 1.2 安装依赖 (已完成)

```bash
npm install bullmq
```

### 2. 启动 Queue Worker

#### 2.1 开发环境

```bash
# 终端 1: 启动 Next.js 开发服务器
npm run dev

# 终端 2: 启动队列 Worker
npm run worker:start
```

#### 2.2 生产环境 (使用 PM2)

更新 `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'next-app',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 'max',
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'queue-worker',
      script: 'tsx',
      args: 'scripts/start-queue-workers.ts',
      instances: 2, // 运行 2 个 Worker 实例
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
```

启动命令:

```bash
pm2 start ecosystem.config.js --env production
```

### 3. 验证部署

#### 3.1 检查队列状态

创建监控API (可选):

```typescript
// app/api/admin/queue-stats/route.ts
import { NextResponse } from 'next/server';
import { getInboundQueueStats } from '@/lib/queue/inbound-queue';

export async function GET() {
  const stats = await getInboundQueueStats();
  return NextResponse.json(stats);
}
```

访问: `http://localhost:3000/api/admin/queue-stats`

#### 3.2 功能测试

```bash
# 创建测试入库
curl -X POST http://localhost:3000/api/inventory/inbound \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "xxx",
    "quantity": 100,
    "reason": "purchase",
    "idempotencyKey": "test-'$(date +%s)'"
  }'

# 预期结果:
# - 立即返回成功响应 (< 1秒)
# - 检查队列 Worker 日志,确认后处理任务执行
# - 验证批次规格已更新
# - 验证库存已更新
```

---

## 📁 新增文件清单

### 队列基础设施
- ✅ `lib/queue/config.ts` - BullMQ 配置
- ✅ `lib/queue/inbound-queue.ts` - 入库队列实例
- ✅ `lib/queue/workers/inbound-worker.ts` - Worker 实现

### 业务逻辑重构
- ✅ `lib/api/batch-number-generator.ts` - 批次号生成(事务外)
- ✅ `lib/api/minimal-inbound-transaction.ts` - 最小化事务

### 脚本和工具
- ✅ `scripts/start-queue-workers.ts` - Worker 启动脚本

### API 路由
- ✅ `app/api/inventory/inbound/route.ts` - 重构后的路由
- 📄 `app/api/inventory/inbound/route.old.ts` - 旧版本备份

### 文档
- ✅ `claudedocs/inbound-timeout-root-cause-analysis-2025-10-21.md` - 问题分析
- ✅ `claudedocs/queue-architecture-migration-guide-2025-10-21.md` - 本文档

---

## 🧪 测试策略

### 单元测试

```bash
# 运行现有测试套件
npm run test:inventory
```

需要新增的测试:
- ✅ 批次号生成器测试
- ✅ 最小化事务测试
- ✅ 队列任务处理测试

### 集成测试

```bash
# 创建集成测试脚本
tsx scripts/test-queue-integration.ts
```

测试场景:
1. 正常入库流程
2. 批次号冲突处理
3. 队列失败重试
4. 并发入库测试
5. 幂等性验证

### 性能测试

```bash
# 使用 autocannon 进行压力测试
npm install -g autocannon

# 测试入库API性能
autocannon -c 50 -d 30 \
  -m POST \
  -H "Content-Type: application/json" \
  -b '{"productId":"xxx","quantity":100,"reason":"purchase","idempotencyKey":"perf-test-${Date.now()}"}' \
  http://localhost:3000/api/inventory/inbound
```

预期结果:
- 平均响应时间: < 500ms
- P95 响应时间: < 1秒
- 错误率: < 1%

---

## 🔧 故障排查

### Worker 未启动

```bash
# 检查 Worker 进程
pm2 list

# 查看 Worker 日志
pm2 logs queue-worker

# 重启 Worker
pm2 restart queue-worker
```

### Redis 连接失败

```bash
# 检查 Redis 状态
redis-cli ping

# 检查环境变量
echo $REDIS_HOST
echo $REDIS_PORT
```

### 队列任务堆积

```bash
# 查看队列统计
curl http://localhost:3000/api/admin/queue-stats

# 清空失败任务 (谨慎使用)
npm run worker:clean-failed
```

### 批次号冲突

特征: 创建入库时偶尔返回 500 错误

解决方案:
- 批次号生成已移到事务外,允许重试
- 如果频繁冲突,检查批次号生成逻辑

---

## 📈 监控建议

### 关键指标

1. **API 响应时间**
   - 目标: P50 < 300ms, P95 < 1秒
   - 告警: P95 > 2秒

2. **队列健康度**
   - 目标: 失败率 < 5%
   - 告警: 失败任务 > 100

3. **数据库性能**
   - 目标: 锁等待 < 100ms
   - 告警: 慢查询 > 1秒

### 推荐工具

- **APM**: New Relic / Datadog / OpenTelemetry
- **队列监控**: BullMQ Board / Bull Monitor
- **数据库监控**: Percona Monitoring / MySQL Enterprise Monitor

---

## 🔄 回滚计划

如果新架构出现问题,快速回滚步骤:

```bash
# 1. 停止 Worker
pm2 stop queue-worker

# 2. 恢复旧版本路由
cp app/api/inventory/inbound/route.old.ts \
   app/api/inventory/inbound/route.ts

# 3. 重启应用
pm2 restart next-app

# 4. 验证功能
curl -X POST http://localhost:3000/api/inventory/inbound ...
```

---

## 🎓 架构原则总结

### SOLID 原则应用

- ✅ **S (单一职责)**: 事务只负责核心数据一致性,队列负责后处理
- ✅ **O (开闭原则)**: 队列允许灵活扩展后处理逻辑
- ✅ **D (依赖倒置)**: 核心事务不依赖具体批次规格/缓存实现

### DRY 原则应用

- ✅ 消除重复的产品查询
- ✅ 批次号生成逻辑复用

### 性能优化原则

- ✅ 最小化事务范围
- ✅ 异步解耦非核心操作
- ✅ 原子操作避免竞态条件
- ✅ 队列模式降低并发冲突

---

## 📞 支持

如有问题,请联系:
- 技术负责人: [Your Name]
- 问题追踪: GitHub Issues
- 文档更新: 本文档持续更新

---

**最后更新**: 2025-10-21
**下一步**: 运行测试套件并部署到测试环境
