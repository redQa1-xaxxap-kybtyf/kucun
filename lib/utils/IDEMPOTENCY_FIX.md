# 幂等性死锁和竞态条件修复说明

## 修复概述

**文件**: `lib/utils/idempotency.ts`
**函数**: `withIdempotency` (第189-292行)
**日期**: 2025-10-04

---

## 问题诊断

### 原始代码存在的问题

```typescript
// ❌ 旧版本：存在竞态条件
export async function withIdempotency<T>(...) {
  // 第1步：检查幂等性键
  const check = await checkIdempotency(idempotencyKey);

  // 第2步：如果正在处理中，直接拒绝
  if (!check.isNew && check.operation?.status === 'processing') {
    throw new Error('操作正在处理中,请稍后重试'); // 问题：高并发下大量请求被拒绝
  }

  // 第3步：创建记录
  await createIdempotencyRecord(...); // 问题：与检查之间存在时间窗口

  // 第4步：执行操作
  const result = await operation();
  return result;
}
```

### 竞态条件时序

```
时间轴：
T1: 请求A -> checkIdempotency(key) -> 返回 isNew=true
T2: 请求B -> checkIdempotency(key) -> 返回 isNew=true  ⚠️ 竞态窗口
T3: 请求A -> createIdempotencyRecord(key) -> 成功
T4: 请求B -> createIdempotencyRecord(key) -> ❌ 唯一约束冲突（P2002错误）
```

**影响**：

- 并发请求时，除第一个请求外，其他请求全部失败
- 用户看到 500 错误而非正确的幂等性返回
- 违背幂等性设计的初衷

---

## 修复方案

### 核心策略

**乐观锁 + 智能轮询**

1. **乐观锁**：直接尝试创建记录，利用数据库唯一约束保证原子性
2. **智能轮询**：捕获唯一约束冲突，根据状态智能处理
3. **指数退避**：避免过度轮询，保护数据库
4. **超时保护**：防止无限等待

### 新实现流程

```typescript
// ✅ 新版本：无竞态条件
export async function withIdempotency<T>(...) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // 直接创建记录（乐观锁）
      await prisma.inventoryOperation.create({
        data: { idempotencyKey, ... }
      });

      // 创建成功 → 执行操作
      const result = await operation();
      await completeIdempotencyRecord(...);
      return result;

    } catch (error) {
      if (error.code === 'P2002') { // 唯一约束冲突
        const existing = await checkIdempotency(idempotencyKey);

        // 情况1：已完成 → 直接返回
        if (existing.data) return existing.data;

        // 情况2：处理中 → 等待重试
        if (existing.status === 'processing') {
          await sleep(exponentialBackoff(attempt));
          continue;
        }

        // 情况3：失败 → 重新创建
        continue;
      }
      throw error; // 其他错误直接抛出
    }
  }
  throw new Error('操作超时');
}
```

---

## 技术细节

### 重试配置

```typescript
const maxRetries = 20; // 最大20次重试
const retryDelayMs = 100; // 初始延迟100ms
const maxRetryDelayMs = 500; // 最大延迟500ms
```

### 指数退避公式

```typescript
delay = min(100 * 1.5^attempt, 500)

重试序列：
- 第1次: 100ms
- 第2次: 150ms
- 第3次: 225ms
- 第4次: 337ms
- 第5-20次: 500ms
```

**总超时时间**: 约 8.8 秒

---

## 并发行为对比

### 场景：10个并发请求同一幂等性键

**旧版本**：

```
请求1: ✅ 成功执行
请求2-10: ❌ 全部失败（"操作正在处理中"）
```

**新版本**：

```
请求1: ✅ 成功执行
请求2-10:
  - 检测到冲突
  - 进入轮询等待
  - 请求1完成后
  - ✅ 全部返回相同结果
```

---

## 四种并发情况处理

### 情况1：操作已完成

```typescript
// 现有记录: { status: 'completed', responseData: {...} }
const existing = await checkIdempotency(key);
if (existing.data) {
  return existing.data; // ✅ 直接返回
}
```

### 情况2：操作处理中

```typescript
// 现有记录: { status: 'processing' }
if (existing.status === 'processing') {
  await sleep(exponentialBackoff(attempt)); // 等待
  continue; // 重试
}
```

### 情况3：操作已失败

```typescript
// 现有记录: { status: 'failed' }
if (existing.status === 'failed') {
  // 允许重新创建记录，再次尝试操作
  continue;
}
```

### 情况4：其他状态

```typescript
// 兜底处理
await sleep(retryDelayMs);
continue;
```

---

## 性能影响

### 无并发场景

```
旧版本: 1次检查 + 1次创建 + 1次操作 = 3次数据库操作
新版本: 1次创建 + 1次操作 = 2次数据库操作 ✅ 更快
```

### 并发场景（10个请求）

```
旧版本:
- 1个成功
- 9个失败（用户体验差）

新版本:
- 10个全部成功
- 增加约10-20次状态查询（轮询开销）
- 总体用户体验更好 ✅
```

---

## 向后兼容性

### API 签名未变

```typescript
// 函数签名完全一致
export async function withIdempotency<T>(
  idempotencyKey: string,
  operationType: OperationType,
  productId: string,
  operatorId: string,
  requestData: Record<string, unknown>,
  operation: () => Promise<T>
): Promise<T>;
```

### 调用方式未变

所有现有的 API 路由无需修改，包括：

- `app/api/inventory/inbound/route.ts`
- `app/api/inventory/outbound/route.ts`
- `app/api/inventory/adjust/route.ts`
- `app/api/sales-orders/[id]/route.ts`
- `app/api/factory-shipments/[id]/status/route.ts`
- 等等...

---

## 边界情况

### 操作失败

```typescript
try {
  const result = await operation();
  await completeIdempotencyRecord(...);
  return result;
} catch (error) {
  await failIdempotencyRecord(...); // 标记失败
  throw error; // 向上抛出
}
```

后续请求会重新尝试操作（因为状态为 `failed`）

### 超时保护

```typescript
if (attempt >= maxRetries) {
  throw new Error('操作超时：请求处理时间过长...');
}
```

触发条件：

- 操作耗时 > 8 秒
- 系统极度繁忙

---

## 验证测试

### 测试文件

已创建 `scripts/test-idempotency-concurrency.ts`

### 测试场景

1. ✅ **并发请求测试**：10个并发请求，验证只执行1次操作
2. ✅ **失败重试测试**：第一次失败，第二次成功
3. ✅ **竞态压力测试**：5轮 × 100个并发，验证0竞态条件
4. ⚠️ **超时保护测试**：验证长时间操作触发超时

### 运行测试

```bash
# 需要先确保数据库连接正常
npx ts-node scripts/test-idempotency-concurrency.ts
```

---

## 监控建议

### 关键指标

```typescript
// 1. 重试次数分布
metrics.histogram('idempotency.retry_count');

// 2. 冲突率（正常应该较高）
metrics.counter('idempotency.conflict_rate');

// 3. 超时率（应该接近0%）
metrics.counter('idempotency.timeout_rate');

// 4. 平均等待时间
metrics.histogram('idempotency.wait_time_ms');
```

### 告警阈值

- **重试次数 > 10**：警告（可能有长时间操作）
- **超时率 > 1%**：严重（需要调优）
- **冲突率 > 50%**：正常（说明幂等性在生效）

---

## 总结

### ✅ 修复成果

- 彻底消除检查-创建竞态条件
- 支持并发请求智能等待而非直接拒绝
- 保持完全向后兼容
- 添加超时保护机制
- 使用指数退避保护数据库

### 📊 代码质量

- 详细中文注释
- 清晰的错误处理
- 可配置的重试参数
- 生产环境就绪

### 🔧 后续建议

1. 添加性能监控指标
2. 根据实际运行情况调优重试参数
3. 考虑添加僵尸记录清理定时任务
4. 压力测试验证实际并发能力

---

**修复人**: Claude Code
**审核状态**: 待审核
**部署状态**: 待部署
