# 客户管理模块潜在问题分析

## 概述

本文档分析客户管理模块的潜在问题,包括数据安全、并发控制、业务逻辑、性能优化等方面。

**分析范围**:
- 客户创建 (POST /api/customers)
- 客户更新 (PUT /api/customers/[id])
- 客户删除 (DELETE /api/customers/[id])
- 客户列表查询 (GET /api/customers)
- 客户详情查询 (GET /api/customers/[id])
- 客户层级查询 (GET /api/customers/hierarchy)

**分析日期**: 2025-09-30

---

## 问题1: 缺少删除前关联检查 ⚠️ 严重

### 问题描述

客户删除前没有检查是否存在关联的订单、付款记录、退货记录等,可能导致:
- 数据完整性破坏
- 外键约束错误
- 历史数据丢失

### 当前实现

```typescript
// lib/api/customer-handlers.ts
export async function deleteCustomer(id: string): Promise<void> {
  const existingCustomer = await prisma.customer.findUnique({
    where: { id },
  });

  if (!existingCustomer) {
    throw new Error('客户不存在');
  }

  // 直接删除,没有检查关联数据
  await prisma.customer.delete({
    where: { id },
  });
}
```

### 风险评估

- **严重程度**: 严重
- **影响范围**: 数据完整性
- **发生概率**: 高(有订单的客户很常见)

### 推荐修复方案

```typescript
// lib/api/customer-handlers.ts
export async function deleteCustomer(id: string): Promise<void> {
  const existingCustomer = await prisma.customer.findUnique({
    where: { id },
  });

  if (!existingCustomer) {
    throw new Error('客户不存在');
  }

  // 检查是否有关联的销售订单
  const salesOrderCount = await prisma.salesOrder.count({
    where: { customerId: id },
  });

  if (salesOrderCount > 0) {
    throw new Error(
      `无法删除客户,该客户有 ${salesOrderCount} 个关联的销售订单`
    );
  }

  // 检查是否有关联的退货订单
  const returnOrderCount = await prisma.returnOrder.count({
    where: { customerId: id },
  });

  if (returnOrderCount > 0) {
    throw new Error(
      `无法删除客户,该客户有 ${returnOrderCount} 个关联的退货订单`
    );
  }

  // 检查是否有关联的厂家发货订单
  const factoryShipmentCount = await prisma.factoryShipmentOrder.count({
    where: { customerId: id },
  });

  if (factoryShipmentCount > 0) {
    throw new Error(
      `无法删除客户,该客户有 ${factoryShipmentCount} 个关联的厂家发货订单`
    );
  }

  // 检查是否有关联的付款记录
  const paymentCount = await prisma.paymentRecord.count({
    where: { customerId: id },
  });

  if (paymentCount > 0) {
    throw new Error(
      `无法删除客户,该客户有 ${paymentCount} 个关联的付款记录`
    );
  }

  // 检查是否有关联的退款记录
  const refundCount = await prisma.refundRecord.count({
    where: { customerId: id },
  });

  if (refundCount > 0) {
    throw new Error(
      `无法删除客户,该客户有 ${refundCount} 个关联的退款记录`
    );
  }

  // 检查是否有关联的出库记录
  const outboundCount = await prisma.outboundRecord.count({
    where: { customerId: id },
  });

  if (outboundCount > 0) {
    throw new Error(
      `无法删除客户,该客户有 ${outboundCount} 个关联的出库记录`
    );
  }

  // 检查是否有子客户
  const childCustomerCount = await prisma.customer.count({
    where: { parentCustomerId: id },
  });

  if (childCustomerCount > 0) {
    throw new Error(
      `无法删除客户,该客户有 ${childCustomerCount} 个子客户`
    );
  }

  // 所有检查通过,可以安全删除
  await prisma.customer.delete({
    where: { id },
  });
}
```

---

## 问题2: 缺少层级循环检查 ⚠️ 高

### 问题描述

客户层级关系更新时,没有检查是否会形成循环引用,可能导致:
- 无限循环
- 查询死锁
- 数据结构混乱

### 当前实现

```typescript
// lib/api/customer-handlers.ts
export async function updateCustomer(
  id: string,
  data: CustomerUpdateInput
): Promise<Customer> {
  // 没有检查层级循环
  const customer = await prisma.customer.update({
    where: { id },
    data: {
      ...(data.parentCustomerId !== undefined && {
        parentCustomerId: data.parentCustomerId || null,
      }),
    },
  });
  
  return customer;
}
```

### 风险评估

- **严重程度**: 高
- **影响范围**: 层级关系
- **发生概率**: 中(用户误操作)

### 推荐修复方案

```typescript
// lib/api/customer-handlers.ts
async function checkHierarchyLoop(
  customerId: string,
  newParentId: string
): Promise<boolean> {
  // 不能将自己设为父级
  if (customerId === newParentId) {
    return true;
  }

  // 检查新父级的所有祖先
  let currentParentId: string | null = newParentId;
  const visited = new Set<string>();

  while (currentParentId) {
    // 检测循环
    if (visited.has(currentParentId)) {
      return true;
    }

    // 如果新父级的祖先中包含当前客户,则形成循环
    if (currentParentId === customerId) {
      return true;
    }

    visited.add(currentParentId);

    // 查找父级的父级
    const parent = await prisma.customer.findUnique({
      where: { id: currentParentId },
      select: { parentCustomerId: true },
    });

    currentParentId = parent?.parentCustomerId || null;
  }

  return false;
}

export async function updateCustomer(
  id: string,
  data: CustomerUpdateInput
): Promise<Customer> {
  // 如果更新了父级客户,检查是否会形成循环
  if (data.parentCustomerId) {
    const hasLoop = await checkHierarchyLoop(id, data.parentCustomerId);
    if (hasLoop) {
      throw new Error('无法设置父级客户,会形成循环引用');
    }
  }

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.phone !== undefined && { phone: data.phone || null }),
      ...(data.address !== undefined && { address: data.address || null }),
      ...(data.parentCustomerId !== undefined && {
        parentCustomerId: data.parentCustomerId || null,
      }),
    },
  });

  return customer;
}
```

---

## 问题3: 缺少名称唯一性检查 ⚠️ 中等

### 问题描述

客户名称没有唯一性约束,可能导致:
- 重复客户记录
- 数据混乱
- 查询困难

### 推荐修复方案

在创建和更新时检查名称是否已存在。

---

## 问题4: 缺少缓存策略 ⚠️ 中等

### 问题描述

客户列表查询没有缓存,每次都查询数据库,高并发时性能差。

### 推荐修复方案

参考库存模块的缓存实现,使用Redis缓存客户列表。

---

## 问题5: 查询性能问题 ⚠️ 中等

### 问题描述

列表查询可能包含大量关联数据,数据传输量大。

### 推荐修复方案

列表页使用`select`代替`include`,只返回必要字段。

---

## 问题6: 缺少审计日志 ⚠️ 低

### 问题描述

客户的创建、更新、删除操作没有审计日志,无法追溯操作历史。

### 推荐修复方案

创建`CustomerLog`表,记录所有操作。

---

## 问题7: 扩展信息验证不完整 ⚠️ 低

### 问题描述

扩展信息的JSON格式没有严格验证,可能导致数据格式不一致。

### 推荐修复方案

使用Zod schema严格验证扩展信息的每个字段。

---

## 问题8: 缺少批量操作 ⚠️ 低

### 问题描述

没有批量导入、批量更新、批量删除功能。

### 推荐修复方案

添加批量操作API。

---

## 改进优先级和时间表

### 立即修复(1周内) - 严重/高优先级

1. ✅ **问题1**: 删除前关联检查
2. ✅ **问题2**: 层级循环检查

### 短期改进(1个月内) - 中优先级

3. **问题3**: 名称唯一性检查
4. **问题4**: 缓存策略
5. **问题5**: 查询性能优化

### 中期改进(3个月内) - 低优先级

6. **问题6**: 审计日志
7. **问题7**: 扩展信息验证
8. **问题8**: 批量操作

---

## 总结

客户管理模块存在8个潜在问题,其中:
- **严重问题**: 1个(删除前检查)
- **高优先级问题**: 1个(层级循环)
- **中等优先级问题**: 3个(名称唯一性、缓存、查询性能)
- **低优先级问题**: 3个(审计日志、扩展信息验证、批量操作)

建议优先修复严重和高优先级问题,确保数据完整性和业务流程正确性。

