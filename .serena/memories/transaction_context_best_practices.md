# Prisma 事务上下文最佳实践

## 核心原则

### 1. 事务一致性

- **所有在事务中的操作必须使用同一事务上下文**
- 事务参数应沿调用链向下传递
- 避免在事务内部使用全局 prisma 实例

### 2. 函数设计模式

标准模式：同时支持事务和非事务两种模式

```typescript
async function someOperation(data: SomeData, tx?: Prisma.TransactionClient) {
  const prismaClient = tx || prisma;

  // 使用 prismaClient 而不是直接使用 prisma
  await prismaClient.someModel.create({ data });

  // 调用其他函数时传递事务上下文
  await otherOperation(someId, prismaClient);
}
```

### 3. 类型定义

```typescript
// 使用 Prisma 提供的类型别名（推荐）
tx?: Prisma.TransactionClient

// 或使用完整的 Omit 类型
tx?: Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>
```

## 常见错误模式

### ❌ 错误示例1：不传递事务上下文

```typescript
async function validateProductExists(productId: string) {
  // ❌ 直接使用全局 prisma
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });
}

async function createRecord(data, tx) {
  // ❌ 调用 validateProductExists 时没有传递事务
  await validateProductExists(data.productId);

  // 后续操作使用事务
  await tx.record.create({ data });
}
```

### ❌ 错误示例2：函数不支持事务参数

```typescript
async function helperFunction(id: string) {
  // ❌ 函数设计就不支持事务参数
  return prisma.model.findUnique({ where: { id } });
}

async function mainOperation(data, tx) {
  // ❌ 即使想传递事务也无法传递
  await helperFunction(data.id);
}
```

## ✅ 正确实现

### 修复案例：batch-specification-handlers.ts

**问题**：`validateProductExists` 不支持事务参数

**修复前**：

```typescript
async function validateProductExists(productId: string): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });
  // ...
}

export async function upsertBatchSpecification(
  data: CreateBatchSpecificationRequest,
  tx?: Prisma.TransactionClient
): Promise<BatchSpecification> {
  await validateProductExists(data.productId); // ❌
  const prismaClient = tx || prisma;
  // ...
}
```

**修复后**：

```typescript
async function validateProductExists(
  productId: string,
  tx?: Prisma.TransactionClient // ✅ 添加事务参数
): Promise<void> {
  const prismaClient = tx || prisma; // ✅ 支持两种模式

  const product = await prismaClient.product.findUnique({
    where: { id: productId },
  });
  // ...
}

export async function upsertBatchSpecification(
  data: CreateBatchSpecificationRequest,
  tx?: Prisma.TransactionClient
): Promise<BatchSpecification> {
  const prismaClient = tx || prisma;

  // ✅ 传递事务上下文
  await validateProductExists(data.productId, prismaClient);
  // ...
}
```

## 检查清单

设计或修改涉及数据库操作的函数时：

- [ ] 是否添加了可选事务参数 `tx?: Prisma.TransactionClient`？
- [ ] 是否使用 `const prismaClient = tx || prisma` 模式？
- [ ] 所有 Prisma 操作是否都使用 `prismaClient` 而不是 `prisma`？
- [ ] 调用其他函数时是否传递了事务上下文？
- [ ] 是否在整个调用链中保持事务一致性？

## 事务调用链示例

正确的事务传递链：

```
POST /api/inventory/inbound
  → executeInboundTransaction (开始事务)
    → createInboundRecord(data, userId, tx)
      → validateProductExists(productId, tx)  ✅
      → upsertBatchSpecification(data, tx)
        → validateProductExists(productId, tx)  ✅
        → prisma.batchSpecification.upsert(...)  ✅
      → tx.inboundRecord.create(...)  ✅
    → tx.inventory.update(...)  ✅
```

## 相关文档

- 提交：`00a83e6` - fix(inbound): 修复入库500错误 - 事务上下文一致性问题
- 文档：`claudedocs/inbound-transaction-consistency-fix-2025-01-20.md`
- 相关提交：`a307f33` - fix(inbound): 修复入库功能500错误 - 孤儿记录和缺失导入

## ACID 特性

事务正确性依赖 ACID 四大特性：

- **A (Atomicity 原子性)**：要么全部成功，要么全部失败
- **C (Consistency 一致性)**：事务执行前后数据库保持一致状态
- **I (Isolation 隔离性)**：并发事务之间互不干扰
- **D (Durability 持久性)**：事务提交后的修改永久保存

不正确的事务上下文传递会破坏这四大特性，导致数据不一致。
