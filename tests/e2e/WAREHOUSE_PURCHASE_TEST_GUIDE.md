# 仓库进货功能端到端测试指南

> 完整的仓库进货流程测试，包括采购订单创建、审核、入库、库存更新和应付款验证

## 📋 测试范围

### 1. 采购订单创建流程
- ✅ 创建供应商和产品测试数据
- ✅ 创建采购订单（包含多个产品）
- ✅ 验证订单号生成规则
- ✅ 验证订单状态为草稿

### 2. 采购订单审核流程
- ✅ 状态流转：草稿 → 已下单
- ✅ 状态流转：已下单 → 已发货
- ✅ 状态流转：已发货 → 运输中
- ✅ 状态流转：运输中 → 已到货

### 3. 入库单生成
- ✅ 基于采购订单生成入库单
- ✅ 批量创建入库记录
- ✅ 验证入库记录编号生成
- ✅ 验证入库数量和成本

### 4. 库存更新验证
- ✅ 验证库存数量正确更新
- ✅ 验证单位成本正确计算
- ✅ 验证加权平均成本（如有多次入库）

### 5. 财务记录验证
- ✅ 验证应付款记录是否生成
- ✅ 验证应付款金额是否正确
- ✅ 验证应付款状态

### 6. 异常场景测试
- ✅ 重复入库检测（幂等性保护）
- ✅ 库存不足验证
- ✅ 表单验证错误处理

## 🚀 运行测试

### 前置条件

1. **启动开发服务器**
   ```bash
   npm run dev
   ```
   确保服务运行在 `http://localhost:3001`

2. **确保数据库可用**
   ```bash
   # 检查数据库连接
   npx prisma db push
   ```

3. **创建测试管理员账户**
   ```bash
   # 如果没有 admin 账户，运行：
   npm run db:seed
   ```

### 运行所有测试

```bash
# 运行仓库进货测试
npm run test:e2e -- warehouse-purchase.spec.ts

# 或者运行所有 E2E 测试
npm run test:e2e
```

### 运行特定测试

```bash
# 只运行采购订单创建测试
npm run test:e2e -- warehouse-purchase.spec.ts -g "步骤2：创建采购订单"

# 只运行库存验证测试
npm run test:e2e -- warehouse-purchase.spec.ts -g "步骤5：验证库存更新"
```

### 调试模式

```bash
# 使用 UI 模式运行（推荐）
npm run test:e2e:ui

# 使用调试模式
npm run test:e2e:debug -- warehouse-purchase.spec.ts
```

### 查看测试报告

```bash
# 生成并查看 HTML 报告
npm run test:e2e:report
```

## 📊 测试数据

### 自动生成的测试数据

测试会自动创建以下数据：

1. **供应商**
   - 名称：`E2E测试供应商-{timestamp}`
   - 联系人：测试联系人
   - 电话：13800138000

2. **产品**（3个）
   - 产品1：`E2E-PROD-{timestamp}-1`，数量100，单价50
   - 产品2：`E2E-PROD-{timestamp}-2`，数量200，单价60
   - 产品3：`E2E-PROD-{timestamp}-3`（备用）

3. **采购订单**
   - 订单号：`PO-{YYYYMMDD}-{序号}`
   - 集装箱号：`E2E-CONTAINER-{timestamp}`
   - 总金额：17000（100×50 + 200×60）

### 数据清理

测试完成后会自动清理所有测试数据：
- ✅ 删除采购订单
- ✅ 删除产品
- ✅ 删除供应商
- ✅ 清理入库记录（通过级联删除）

## 🔍 测试步骤详解

### 步骤1：准备测试数据

```typescript
// 通过 API 创建供应商
POST /api/suppliers
{
  "name": "E2E测试供应商-{timestamp}",
  "contactPerson": "测试联系人",
  "phone": "13800138000",
  "status": "active"
}

// 通过 API 创建产品
POST /api/products
{
  "code": "E2E-PROD-{timestamp}-1",
  "name": "E2E测试产品1",
  "unit": "box",
  "piecesPerUnit": 3,
  "status": "active"
}
```

### 步骤2：创建采购订单

```typescript
// 访问创建页面
GET /purchase-orders/create

// 填写表单
- 选择供应商
- 输入集装箱号
- 添加产品明细（产品、数量、单价）
- 保存草稿

// 验证
- 订单号格式：PO-YYYYMMDD-XXXX
- 状态：草稿
```

### 步骤3：审核采购订单

```typescript
// 状态流转
PUT /api/purchase-orders/{id}/status
{
  "status": "ordered"  // 草稿 → 已下单
}

PUT /api/purchase-orders/{id}/status
{
  "status": "shipped"  // 已下单 → 已发货
}

PUT /api/purchase-orders/{id}/status
{
  "status": "in_transit"  // 已发货 → 运输中
}

PUT /api/purchase-orders/{id}/status
{
  "status": "arrived"  // 运输中 → 已到货
}
```

### 步骤4：生成入库单

```typescript
// 获取订单明细
GET /api/purchase-orders/{id}

// 为每个明细创建入库记录
POST /api/inventory/inbound
{
  "productId": "{productId}",
  "quantity": 100,
  "unitCost": 50,
  "reason": "purchase",
  "remarks": "采购订单 PO-XXXXXXXX-XXXX 入库",
  "idempotencyKey": "e2e-test-{orderId}-{itemId}-{timestamp}"
}
```

### 步骤5：验证库存更新

```typescript
// 查询产品库存
GET /api/inventory?productId={productId}

// 验证
- 库存数量 = 采购数量
- 单位成本 = 采购单价
- 批次号已生成
```

### 步骤6：验证应付款记录

```typescript
// 查询应付款
GET /api/finance/payables?supplierId={supplierId}

// 验证
- 应付款金额 = 订单总金额
- 状态 = pending
- 来源 = 采购订单
```

## ⚠️ 注意事项

### 1. 测试环境要求

- ✅ Node.js >= 18
- ✅ MySQL/PostgreSQL 数据库
- ✅ Redis（用于幂等性保护）
- ✅ 开发服务器运行在 3001 端口

### 2. 常见问题

**Q: 测试失败：无法连接到服务器**
```bash
# 确保开发服务器正在运行
npm run dev

# 检查端口是否被占用
netstat -ano | findstr :3001
```

**Q: 测试失败：登录失败**
```bash
# 确保有 admin 账户
npm run db:seed

# 或手动创建管理员
npm run db:verify-admin
```

**Q: 测试失败：数据库错误**
```bash
# 重置数据库
npm run db:reset

# 重新生成 Prisma Client
npm run db:generate
```

**Q: 测试数据未清理**
```bash
# 手动清理测试数据
npm run db:clear

# 或清理所有数据
npm run db:clear-all
```

### 3. 性能优化建议

- 使用 `test.describe.serial()` 确保测试按顺序执行
- 使用 `test.beforeAll()` 一次性创建测试数据
- 使用 `test.afterAll()` 统一清理数据
- 避免在测试中使用 `waitForTimeout()`，优先使用 `waitForSelector()`

### 4. 调试技巧

```bash
# 保存失败截图
npm run test:e2e -- warehouse-purchase.spec.ts --screenshot=on

# 录制视频
npm run test:e2e -- warehouse-purchase.spec.ts --video=on

# 查看详细日志
npm run test:e2e -- warehouse-purchase.spec.ts --reporter=list
```

## 📈 测试覆盖率

当前测试覆盖的功能点：

- ✅ 采购订单 CRUD
- ✅ 订单状态流转
- ✅ 入库记录创建
- ✅ 库存更新
- ✅ 成本计算
- ✅ 应付款生成
- ✅ 幂等性保护
- ✅ 库存可用性检查

未覆盖的功能点（可扩展）：

- ⏳ 采购订单编辑
- ⏳ 采购订单删除
- ⏳ 部分入库
- ⏳ 入库退货
- ⏳ 费用分摊
- ⏳ 多批次入库

## 🔗 相关文档

- [Playwright 官方文档](https://playwright.dev/)
- [项目测试规范](../../docs/quality/testing-guide.md)
- [API 文档](../../docs/api/README.md)
- [数据库 Schema](../../prisma/schema.prisma)

## 📝 更新日志

### 2025-01-04
- ✅ 创建仓库进货端到端测试
- ✅ 实现完整的测试流程
- ✅ 添加异常场景测试
- ✅ 添加测试文档

---

**维护者**: AI Assistant  
**最后更新**: 2025-01-04


