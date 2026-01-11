# 厂家发货模块拆分 - 快速参考

> 一页纸快速参考指南

## 🎯 核心决策

| 项目       | 决策                                                             |
| ---------- | ---------------------------------------------------------------- |
| **方案**   | 方案 A - 新增独立数据表                                          |
| **数据表** | `PurchaseOrder` + `PurchaseOrderItem`                            |
| **路由**   | `/factory-shipments`（客户直发）+ `/purchase-orders`（仓库进货） |
| **导航**   | 厂家发货（一级菜单）→ 客户直发 + 仓库进货（子菜单）              |
| **图标**   | Truck（一级）、PackageCheck（客户直发）、Warehouse（仓库进货）   |

---

## 📋 导航菜单结构

### 当前结构（已更新 ✅）

```
厂家发货 (Truck)
├── 客户直发 (PackageCheck) → /factory-shipments
└── 仓库进货 (Warehouse) → /purchase-orders
```

### 配置代码

```typescript
// components/common/sidebar-navigation-config.ts
{
  id: 'factory-shipments',
  title: '厂家发货',
  href: '/factory-shipments',
  icon: Truck,
  children: [
    {
      id: 'factory-shipments-customer-direct',
      title: '客户直发',
      href: '/factory-shipments',
      icon: PackageCheck,
    },
    {
      id: 'purchase-orders',
      title: '仓库进货',
      href: '/purchase-orders',
      icon: Warehouse,
    },
  ],
}
```

---

## 🗂️ 数据表对比

| 字段          | FactoryShipmentOrder    | PurchaseOrder        |
| ------------- | ----------------------- | -------------------- |
| **关联对象**  | customerId（客户）      | supplierId（供应商） |
| **货物归属**  | customer + self（混合） | self（全部自有）     |
| **收款/付款** | 应收款                  | 应付款               |
| **利润计算**  | 客户货计算利润          | 无利润（只记录成本） |
| **入库逻辑**  | 只有自有货入库          | 全部入库             |
| **费用分摊**  | 按归属分摊              | 按金额分摊           |

---

## 🔄 业务流程对比

### 客户直发（FactoryShipmentOrder）

```
1. 创建订单 → 选择客户 → 添加产品（标记归属）→ 录入费用
2. 确认订单 → 状态变为 ordered
3. 厂家发货 → 状态变为 shipped
4. 货物到达 → 状态变为 arrived
5. 客户货：交付给客户 → 生成应收款
6. 自有货：入库 → 更新库存
7. 费用分摊 → 计算成本和利润
```

### 仓库进货（PurchaseOrder）

```
1. 创建订单 → 选择供应商 → 添加产品 → 录入费用
2. 确认订单 → 状态变为 ordered
3. 厂家发货 → 状态变为 shipped
4. 货物到达 → 状态变为 arrived
5. 自动入库 → 更新库存
6. 费用分摊 → 计算成本
7. 生成应付款
```

---

## 📂 文件清单

### 需要新增的文件

```
✅ 已完成
- components/common/sidebar-navigation-config.ts（已更新）

⏳ 待创建
数据库：
- prisma/schema.prisma（添加 PurchaseOrder 和 PurchaseOrderItem）
- prisma/migrations/xxx_add_purchase_orders/migration.sql

类型定义：
- lib/types/purchase-order.ts
- lib/validations/purchase-order.ts

服务层：
- lib/services/purchase-order-service.ts
- lib/services/purchase-order-cost-service.ts
- lib/services/purchase-order-inbound-service.ts

API：
- app/api/purchase-orders/route.ts
- app/api/purchase-orders/[id]/route.ts
- app/api/purchase-orders/[id]/status/route.ts

Server Actions：
- app/actions/purchase-orders.ts
- app/actions/purchase-orders.schemas.ts

页面：
- app/(dashboard)/purchase-orders/page.tsx
- app/(dashboard)/purchase-orders/page-client.tsx
- app/(dashboard)/purchase-orders/create/page.tsx
- app/(dashboard)/purchase-orders/[id]/page.tsx

组件：
- components/purchase-orders/purchase-order-form.tsx
- components/purchase-orders/purchase-order-list.tsx
- components/purchase-orders/purchase-order-filters.tsx
- components/purchase-orders/form-sections/...
```

---

## 🔧 可复用的组件和服务

| 组件/服务    | 原路径                                                              | 复用方式           |
| ------------ | ------------------------------------------------------------------- | ------------------ |
| 费用录入组件 | `components/factory-shipments/factory-shipment-fee-items-input.tsx` | 直接复用或稍作调整 |
| 费用分摊服务 | `lib/services/factory-shipment-expense-service.ts`                  | 核心逻辑完全复用   |
| 成本核算逻辑 | `lib/services/factory-shipment-profit-service.ts`                   | 复用成本计算部分   |
| 产品选择器   | `components/factory-shipments/form-sections/items-section.tsx`      | 完全复用           |
| 供应商选择器 | `components/suppliers/supplier-selector.tsx`                        | 完全复用           |
| 订单号生成   | `lib/services/simple-order-number-generator.ts`                     | 新增函数           |

**复用率**：约 60-70%

---

## ⏱️ 工作量估算

| 阶段     | 任务               | 时间         | 状态        |
| -------- | ------------------ | ------------ | ----------- |
| Phase 1  | 导航菜单重构       | 0.5 天       | ✅ 已完成   |
| Phase 2  | 数据库设计和迁移   | 1-2 天       | ⏳ 待执行   |
| Phase 3  | 后端 API 开发      | 3-4 天       | ⏳ 待执行   |
| Phase 4  | 前端页面开发       | 4-5 天       | ⏳ 待执行   |
| Phase 5  | 费用分摊和成本核算 | 2-3 天       | ⏳ 待执行   |
| Phase 6  | 自动入库逻辑       | 2-3 天       | ⏳ 待执行   |
| Phase 7  | 测试和优化         | 2-3 天       | ⏳ 待执行   |
| **总计** |                    | **14-20 天** | **5% 完成** |

---

## 📝 下一步行动

### 立即执行（Phase 2）

1. **创建 Prisma Schema**：

   ```bash
   # 编辑 prisma/schema.prisma
   # 添加 PurchaseOrder 和 PurchaseOrderItem 模型
   ```

2. **生成迁移脚本**：

   ```bash
   npx prisma migrate dev --name add_purchase_orders
   ```

3. **执行数据库迁移**：

   ```bash
   npx prisma migrate deploy
   ```

4. **生成 Prisma Client**：
   ```bash
   npx prisma generate
   ```

### 验收标准

- [ ] 导航菜单显示"厂家发货"一级菜单
- [ ] 展开后显示"客户直发"和"仓库进货"两个子菜单
- [ ] 点击"客户直发"跳转到 `/factory-shipments`
- [ ] 点击"仓库进货"跳转到 `/purchase-orders`（暂时 404，待创建页面）
- [ ] 数据库中成功创建 `purchase_orders` 和 `purchase_order_items` 表

---

## 🎨 UI 设计参考

### 页面标题和描述

**客户直发**：

- 标题：厂家发货管理
- 描述：管理厂家发货订单，跟踪货物运输状态和到货情况

**仓库进货**：

- 标题：采购订单管理
- 描述：管理采购订单，跟踪货物运输状态和入库情况

### 按钮文案

**客户直发**：

- 新建按钮：新建发货单

**仓库进货**：

- 新建按钮：新建采购订单

---

## 🔐 权限配置（建议）

### 客户直发（现有权限）

- `factory-shipment:view` - 查看厂家发货订单
- `factory-shipment:create` - 创建厂家发货订单
- `factory-shipment:edit` - 编辑厂家发货订单
- `factory-shipment:delete` - 删除厂家发货订单

### 仓库进货（新增权限）

- `purchase:view` - 查看采购订单
- `purchase:create` - 创建采购订单
- `purchase:edit` - 编辑采购订单
- `purchase:delete` - 删除采购订单

---

## 📊 成功指标

### 技术指标

- [ ] 代码复用率 ≥ 60%
- [ ] 单元测试覆盖率 ≥ 80%
- [ ] API 响应时间 < 500ms
- [ ] 页面加载时间 < 2s

### 业务指标

- [ ] 采购订单创建成功率 ≥ 95%
- [ ] 自动入库成功率 ≥ 99%
- [ ] 成本核算准确率 = 100%
- [ ] 用户满意度 ≥ 4.5/5

---

## 🐛 常见问题

### Q1: 现有的厂家发货订单数据会受影响吗？

**A**: 不会。现有的 `FactoryShipmentOrder` 表保持不变，所有数据完整保留。

### Q2: 如果订单中既有客户货又有自有货，应该用哪个模块？

**A**: 使用"客户直发"模块（`/factory-shipments`），它支持混合订单。

### Q3: 纯自有货订单应该用哪个模块？

**A**: 使用"仓库进货"模块（`/purchase-orders`），它专门用于采购进货。

### Q4: 两个模块的费用分摊逻辑有什么不同？

**A**:

- 客户直发：按归属分摊（客户货 vs 自有货）
- 仓库进货：按金额分摊（全部是自有货）

### Q5: 采购订单是否需要生成应付款？

**A**: 建议在订单状态变为 `arrived`（已到货）时自动生成应付款记录。

---

**文档创建时间**：2025-11-04  
**最后更新时间**：2025-11-04  
**当前进度**：5%（Phase 1 已完成）
