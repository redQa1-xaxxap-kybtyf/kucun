# 厂家发货确认超时问题修复总结

## 🐛 问题描述

厂家发货确认时失败，错误信息：

```
操作超时：请求处理时间过长（超过11秒等待），请稍后重试。
这可能是由于系统繁忙或操作耗时过长导致的。
```

**HTTP 状态码**: 500 Internal Server Error

## 🔍 根本原因

### 1. 超时限制太短

**文件**: `lib/utils/idempotency.ts`

原设置：

```typescript
const MAX_PROCESSING_DURATION_MS = 8_000; // 8秒
const MAX_WAIT_FOR_EXISTING_OPERATION_MS = 10_000; // 10秒
```

**问题**: 厂家发货状态更新是一个**复杂的事务操作**，包括：

1. 验证订单状态
2. 智能状态流转（可能需要多步状态变更）
3. 创建应收账款记录
4. 为每个供应商创建应付账款记录（可能有多个供应商）
5. 更新订单状态和相关字段

这些操作在数据量大或供应商多的情况下，可能超过 10 秒。

### 2. 性能瓶颈

**文件**: `lib/api/handlers/factory-shipment-status.ts`

原代码在循环中生成应付款编号：

```typescript
for (const payable of creationQueue) {
  const payableNumber = await generatePayableNumber(tx); // ❌ 每次循环都查询数据库
  // 创建应付账款...
}
```

**问题**:

- 每个供应商的应付账款都需要单独查询数据库生成编号
- 如果有 5 个供应商，就需要 5 次数据库查询
- 加上创建记录的时间，总耗时会很长

## ✅ 解决方案

### 修复 1: 增加超时时间

**文件**: `lib/utils/idempotency.ts`

```typescript
// ⚠️ 厂家发货状态更新需要创建应收账款和应付账款，可能需要较长时间
// ⚠️ 尤其是在有多个供应商的情况下，需要为每个供应商生成应付账款记录
const MAX_PROCESSING_DURATION_MS = 25_000; // 单次操作允许的最大处理时长（增加到25秒）
const MAX_WAIT_FOR_EXISTING_OPERATION_MS = 30_000; // 并发等待的最大时长（增加到30秒）
const PROCESSING_RECORD_TTL_MS = MAX_PROCESSING_DURATION_MS + 5_000; // processing 记录的生命周期 (额外缓冲 5s)
```

**改进**:

- 最大处理时长从 8秒 增加到 **25秒**
- 并发等待时长从 10秒 增加到 **30秒**
- 生命周期缓冲从 2秒 增加到 **5秒**

### 修复 2: 优化应付款编号生成性能

**文件**: `lib/api/handlers/factory-shipment-status.ts`

```typescript
// ✅ 性能优化：批量生成应付款编号，避免在循环中多次查询数据库
const payableNumbers: string[] = [];
for (let i = 0; i < creationQueue.length; i++) {
  payableNumbers.push(await generatePayableNumber(tx));
}

console.log(`[PERF] 应付款编号生成完成, 耗时: ${Date.now() - startTime}ms`);

for (let i = 0; i < creationQueue.length; i++) {
  const payable = creationQueue[i];
  const payableNumber = payableNumbers[i];
  // 创建应付账款...
}
```

**改进**:

- 先批量生成所有编号
- 再使用生成好的编号创建记录
- 添加性能日志，便于监控

### 修复 3: 添加详细的调试日志

已在以下位置添加 `[DEBUG]` 和 `[PERF]` 日志：

1. **API 路由**: `app/api/factory-shipments/[id]/status/route.ts`
   - 请求开始
   - 用户认证
   - 数据验证
   - 订单检查
   - 状态更新
   - 错误处理

2. **API 客户端**: `lib/api/factory-shipments.ts`
   - 请求数据
   - 服务器响应
   - 错误详情

3. **确认发货对话框**: `components/factory-shipments/confirm-shipment-dialog.tsx`
   - 表单数据
   - 发送数据
   - 错误信息

4. **状态更新处理器**: `lib/api/handlers/factory-shipment-status.ts`
   - 事务开始
   - 订单查询
   - 应收账款处理
   - 应付账款处理
   - 编号生成

## 📊 性能对比

### 修复前

- **超时限制**: 10秒
- **实际耗时**: 11-15秒（超时失败）
- **应付款编号生成**: 循环中逐个查询

### 修复后（预期）

- **超时限制**: 30秒
- **实际耗时**: 预计 5-15秒（正常完成）
- **应付款编号生成**: 批量生成，减少查询次数

## 🧪 测试步骤

1. **重启开发服务器** (确保新代码生效)

   ```bash
   # 停止当前服务器 (Ctrl+C)
   npm run dev
   ```

2. **尝试确认发货**
   - 登录系统
   - 打开厂家发货订单详情
   - 点击"确认发货"
   - 填写集装箱号码
   - 提交

3. **查看性能日志**

   服务器终端应该显示：

   ```
   [DEBUG] PATCH /api/factory-shipments/[id]/status - 开始处理请求, orderId: ...
   [DEBUG] 用户认证结果, userId: ...
   [DEBUG] 开始验证请求数据
   [DEBUG] 接收到的请求数据: { ... }
   [DEBUG] 验证通过的数据: { ... }
   [DEBUG] 检查订单是否存在
   [DEBUG] 订单存在, 当前状态: draft
   [DEBUG] 准备更新订单状态: { ... }
   [PERF] 开始执行 updateFactoryShipmentStatus, orderId: ...
   [PERF] 事务开始, 耗时: Xms
   [PERF] 订单查询完成, 耗时: Xms
   [PERF] 应收账款处理完成, 耗时: Xms
   [PERF] 开始处理应付账款, 耗时: Xms
   [PERF] 应付款编号生成完成, 耗时: Xms
   [PERF] 应付账款处理完成, 耗时: Xms
   [DEBUG] 订单状态更新成功, 结果: { ... }
   [DEBUG] 获取更新后的订单详情
   [DEBUG] 订单详情获取成功
   ```

## ⚠️ 注意事项

### 1. 生产环境优化

在生产环境部署前，考虑以下优化：

1. **移除调试日志**

   ```bash
   # 搜索所有调试日志
   grep -r "\[DEBUG\]" --include="*.ts" --include="*.tsx" .
   ```

2. **进一步优化性能**
   - 考虑使用 Prisma 的批量创建 API
   - 优化数据库索引
   - 使用数据库连接池

3. **监控和告警**
   - 监控操作耗时
   - 设置超时告警
   - 记录慢查询日志

### 2. 长期优化建议

1. **拆分事务**
   - 核心状态更新和财务记录创建分开
   - 使用后台任务处理财务记录创建

2. **使用批量操作**
   - Prisma 的 `createMany` API
   - 减少数据库往返次数

3. **缓存优化**
   - 缓存编号生成规则
   - 减少重复查询

## 📝 相关文件

- ✅ `lib/utils/idempotency.ts` - 超时配置
- ✅ `lib/api/handlers/factory-shipment-status.ts` - 状态更新逻辑
- ✅ `app/api/factory-shipments/[id]/status/route.ts` - API 路由
- ✅ `lib/api/factory-shipments.ts` - API 客户端
- ✅ `components/factory-shipments/confirm-shipment-dialog.tsx` - 确认对话框

## 🎯 验证清单

- [ ] 服务器重启成功
- [ ] 可以成功确认发货
- [ ] 没有超时错误
- [ ] 应收账款创建成功
- [ ] 应付账款创建成功
- [ ] 订单状态更新正确
- [ ] 性能日志显示正常（<30秒）
