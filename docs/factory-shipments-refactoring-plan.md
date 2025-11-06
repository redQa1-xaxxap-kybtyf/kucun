# 厂家发货模块拆分实施方案

> 将厂家发货模块拆分为"客户直发"和"仓库进货"两个独立功能

## 📋 方案概述

### 选择方案：**方案 A - 新增独立数据表**

**核心决策**：

- ✅ 新增 `PurchaseOrder` 和 `PurchaseOrderItem` 数据表
- ✅ 保持 `FactoryShipmentOrder` 表不变（客户直发）
- ✅ 路由：`/factory-shipments`（客户直发）+ `/purchase-orders`（仓库进货）
- ✅ 导航：厂家发货作为一级菜单，包含两个子菜单

### 理由

1. **业务逻辑清晰**：两种业务完全独立，避免混淆
2. **符合 SOLID 原则**：单一职责、开放/封闭
3. **财务报表清晰**：应收款和应付款分开统计
4. **可扩展性强**：未来可独立扩展采购计划、供应商评估等功能
5. **数据隔离**：查询和统计更高效

---

## 🎯 实施计划

### Phase 1: 导航菜单重构（已完成 ✅）

#### 1.1 侧边栏配置更新

**文件**：`components/common/sidebar-navigation-config.ts`

**变更内容**：

```typescript
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

**图标说明**：

- 厂家发货（一级菜单）：`Truck`（卡车，代表运输）
- 客户直发：`PackageCheck`（已检查的包裹，代表发货给客户）
- 仓库进货：`Warehouse`（仓库，代表入库）

#### 1.2 面包屑导航更新

**文件**：`components/common/Breadcrumb.tsx`

**需要添加的路径映射**：

```typescript
'/purchase-orders': '仓库进货',
'/purchase-orders/create': '新建采购订单',
'/purchase-orders/[id]': '采购订单详情',
```

---

### Phase 2: 数据库设计（预计 1-2 天）

#### 2.1 数据表设计

**新增表：`PurchaseOrder`（采购订单）**

```prisma
model PurchaseOrder {
  id              String   @id @default(uuid()) @db.Char(36)
  orderNumber     String   @unique @map("order_number")
  supplierId      String   @map("supplier_id") @db.Char(36)
  containerNumber String?  @map("container_number")
  userId          String   @map("user_id") @db.Char(36)
  status          String   @default("draft") @db.VarChar(32)

  // 金额字段
  totalAmount     Float    @default(0) @map("total_amount")
  expenseAmount   Float?   @default(0) @map("expense_amount")
  costAmount      Float?   @default(0) @map("cost_amount")

  // 日期字段
  orderDate       DateTime? @map("order_date")
  shipmentDate    DateTime? @map("shipment_date")
  estimatedArrival DateTime? @map("estimated_arrival")
  arrivalDate     DateTime? @map("arrival_date")

  // 物流信息
  shippingCompany     String?   @map("shipping_company")
  lastShippingQueryAt DateTime? @map("last_shipping_query_at")
  shippingQueryStatus String?   @map("shipping_query_status") @db.VarChar(50)
  shippingQueryError  String?   @map("shipping_query_error") @db.Text

  remarks         String?
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  // 关系
  supplier Supplier           @relation(fields: [supplierId], references: [id], onDelete: Restrict, onUpdate: Cascade)
  user     User               @relation(fields: [userId], references: [id], onDelete: Restrict, onUpdate: Cascade)
  items    PurchaseOrderItem[]

  @@index([orderNumber])
  @@index([supplierId])
  @@index([userId])
  @@index([status])
  @@index([containerNumber])
  @@index([shippingCompany])
  @@map("purchase_orders")
}
```

**新增表：`PurchaseOrderItem`（采购订单明细）**

```prisma
model PurchaseOrderItem {
  id              String  @id @default(uuid()) @db.Char(36)
  purchaseOrderId String  @map("purchase_order_id") @db.Char(36)
  productId       String? @map("product_id") @db.Char(36)
  supplierId      String  @map("supplier_id") @db.Char(36)
  productCode     String  @map("product_code") @db.VarChar(100)

  // 产品信息
  displayName     String
  specification   String? @db.Text
  unit            String  @default("piece")
  weight          Float?

  // 数量和价格
  quantity        Float
  unitPrice       Float   @map("unit_price")
  totalPrice      Float   @map("total_price")

  // 成本字段
  unitCost         Float? @map("unit_cost")
  allocatedExpense Float? @default(0) @map("allocated_expense")

  // 入库状态
  inboundStatus    String? @map("inbound_status")
  inboundReceivedAt DateTime? @map("inbound_received_at")

  // 手动输入产品信息
  isManualProduct     Boolean? @map("is_manual_product")
  manualProductName   String?  @map("manual_product_name")
  manualSpecification String?  @map("manual_specification")
  manualWeight        Float?   @map("manual_weight")
  manualUnit          String?  @map("manual_unit")

  remarks         String?
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  // 关系
  purchaseOrder PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  product       Product?      @relation(fields: [productId], references: [id], onDelete: SetNull, onUpdate: Cascade)
  supplier      Supplier      @relation(fields: [supplierId], references: [id], onDelete: Restrict, onUpdate: Cascade)

  @@index([purchaseOrderId])
  @@index([productId])
  @@index([supplierId])
  @@index([productCode])
  @@map("purchase_order_items")
}
```

#### 2.2 订单状态定义

```typescript
export const PURCHASE_ORDER_STATUS = {
  DRAFT: 'draft', // 草稿
  ORDERED: 'ordered', // 已下单
  SHIPPED: 'shipped', // 已发货
  IN_TRANSIT: 'in_transit', // 运输中
  ARRIVED: 'arrived', // 已到货
  COMPLETED: 'completed', // 已完成
  CANCELLED: 'cancelled', // 已取消
} as const;

export const PURCHASE_ORDER_STATUS_LABELS = {
  draft: '草稿',
  ordered: '已下单',
  shipped: '已发货',
  in_transit: '运输中',
  arrived: '已到货',
  completed: '已完成',
  cancelled: '已取消',
} as const;
```

#### 2.3 数据库迁移脚本

**文件**：`prisma/migrations/YYYYMMDDHHMMSS_add_purchase_orders/migration.sql`

```sql
-- CreateTable: purchase_orders
CREATE TABLE `purchase_orders` (
  `id` CHAR(36) NOT NULL,
  `order_number` VARCHAR(191) NOT NULL,
  `supplier_id` CHAR(36) NOT NULL,
  `container_number` VARCHAR(191) NULL,
  `user_id` CHAR(36) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'draft',
  `total_amount` DOUBLE NOT NULL DEFAULT 0,
  `expense_amount` DOUBLE NULL DEFAULT 0,
  `cost_amount` DOUBLE NULL DEFAULT 0,
  `order_date` DATETIME(3) NULL,
  `shipment_date` DATETIME(3) NULL,
  `estimated_arrival` DATETIME(0) NULL,
  `arrival_date` DATETIME(3) NULL,
  `shipping_company` VARCHAR(191) NULL,
  `last_shipping_query_at` DATETIME(3) NULL,
  `shipping_query_status` VARCHAR(50) NULL,
  `shipping_query_error` TEXT NULL,
  `remarks` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `purchase_orders_order_number_key`(`order_number`),
  INDEX `purchase_orders_supplier_id_idx`(`supplier_id`),
  INDEX `purchase_orders_user_id_idx`(`user_id`),
  INDEX `purchase_orders_status_idx`(`status`),
  INDEX `purchase_orders_container_number_idx`(`container_number`),
  INDEX `purchase_orders_shipping_company_idx`(`shipping_company`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: purchase_order_items
CREATE TABLE `purchase_order_items` (
  `id` CHAR(36) NOT NULL,
  `purchase_order_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NULL,
  `supplier_id` CHAR(36) NOT NULL,
  `product_code` VARCHAR(100) NOT NULL,
  `display_name` VARCHAR(191) NOT NULL,
  `specification` TEXT NULL,
  `unit` VARCHAR(191) NOT NULL DEFAULT 'piece',
  `weight` DOUBLE NULL,
  `quantity` DOUBLE NOT NULL,
  `unit_price` DOUBLE NOT NULL,
  `total_price` DOUBLE NOT NULL,
  `unit_cost` DOUBLE NULL,
  `allocated_expense` DOUBLE NULL DEFAULT 0,
  `inbound_status` VARCHAR(191) NULL,
  `inbound_received_at` DATETIME(3) NULL,
  `is_manual_product` BOOLEAN NULL,
  `manual_product_name` VARCHAR(191) NULL,
  `manual_specification` VARCHAR(191) NULL,
  `manual_weight` DOUBLE NULL,
  `manual_unit` VARCHAR(191) NULL,
  `remarks` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `purchase_order_items_purchase_order_id_idx`(`purchase_order_id`),
  INDEX `purchase_order_items_product_id_idx`(`product_id`),
  INDEX `purchase_order_items_supplier_id_idx`(`supplier_id`),
  INDEX `purchase_order_items_product_code_idx`(`product_code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_supplier_id_fkey`
  FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `purchase_order_items` ADD CONSTRAINT `purchase_order_items_purchase_order_id_fkey`
  FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `purchase_order_items` ADD CONSTRAINT `purchase_order_items_product_id_fkey`
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `purchase_order_items` ADD CONSTRAINT `purchase_order_items_supplier_id_fkey`
  FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
```

---

## 📂 文件结构

### 新增文件清单

```
app/
├── (dashboard)/
│   └── purchase-orders/
│       ├── page.tsx                    # 采购订单列表页面
│       ├── page-client.tsx             # 客户端组件
│       ├── loading.tsx                 # 加载状态
│       ├── error.tsx                   # 错误处理
│       ├── create/
│       │   └── page.tsx                # 创建采购订单
│       └── [id]/
│           ├── page.tsx                # 采购订单详情
│           └── components/
│               ├── purchase-order-detail.tsx
│               └── ...
├── api/
│   └── purchase-orders/
│       ├── route.ts                    # GET, POST
│       ├── [id]/
│       │   └── route.ts                # GET, PUT, DELETE
│       └── [id]/
│           └── status/
│               └── route.ts            # 状态更新
└── actions/
    ├── purchase-orders.ts              # Server Actions
    └── purchase-orders.schemas.ts      # Zod Schemas

components/
└── purchase-orders/
    ├── purchase-order-form.tsx         # 订单表单（复用厂家发货的组件）
    ├── purchase-order-list.tsx         # 订单列表
    ├── purchase-order-filters.tsx      # 筛选器
    └── form-sections/
        ├── basic-info-section.tsx      # 基本信息（供应商选择）
        ├── items-section.tsx           # 产品明细
        └── fee-section.tsx             # 费用录入

lib/
├── services/
│   ├── purchase-order-service.ts       # 采购订单服务
│   ├── purchase-order-cost-service.ts  # 成本核算服务
│   └── purchase-order-inbound-service.ts # 自动入库服务
├── types/
│   └── purchase-order.ts               # 类型定义
└── validations/
    └── purchase-order.ts               # Zod 验证规则
```

---

## 🔄 复用策略

### 可复用的组件和服务

1. **费用录入组件**：
   - `components/factory-shipments/factory-shipment-fee-items-input.tsx`
   - 直接复用或稍作调整

2. **费用分摊服务**：
   - `lib/services/factory-shipment-expense-service.ts`
   - 核心逻辑完全复用，只需调整参数类型

3. **成本核算逻辑**：
   - `lib/services/factory-shipment-profit-service.ts`
   - 复用成本计算逻辑（采购订单无需计算利润）

4. **表单组件**：
   - 产品选择器、供应商选择器、日期选择器等
   - 完全复用现有组件

5. **订单号生成服务**：
   - `lib/services/simple-order-number-generator.ts`
   - 新增 `generatePurchaseOrderNumber()` 函数

---

## ⏱️ 工作量估算

| 阶段     | 任务               | 预计时间               |
| -------- | ------------------ | ---------------------- |
| Phase 1  | 导航菜单重构       | ✅ 已完成              |
| Phase 2  | 数据库设计和迁移   | 1-2 天                 |
| Phase 3  | 后端 API 开发      | 3-4 天                 |
| Phase 4  | 前端页面开发       | 4-5 天                 |
| Phase 5  | 费用分摊和成本核算 | 2-3 天                 |
| Phase 6  | 自动入库逻辑       | 2-3 天                 |
| Phase 7  | 测试和优化         | 2-3 天                 |
| **总计** |                    | **14-20 天（3-4 周）** |

**复用率**：约 60-70%（大量复用厂家发货订单的逻辑和组件）

---

## 📝 下一步行动

### 立即执行

1. ✅ **导航菜单重构**（已完成）
2. ⏳ **数据库设计**：
   - 创建 Prisma schema
   - 生成迁移脚本
   - 执行数据库迁移

### 待确认

1. **权限配置**：
   - 采购订单是否需要独立的权限？
   - 建议：`purchase:view`, `purchase:create`, `purchase:edit`, `purchase:delete`

2. **财务集成**：
   - 采购订单是否需要生成应付款记录？
   - 建议：到货后自动生成应付款

3. **通知功能**：
   - 采购订单状态变更是否需要通知？
   - 建议：到货时通知相关人员

---

**文档创建时间**：2025-11-04  
**预计完成时间**：2025-11-25（3-4 周后）  
**复用现有代码比例**：60-70%
