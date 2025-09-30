# 价格历史记忆功能实现文档

## 功能概述

实现了销售订单和厂家发货订单的价格记忆功能，支持：
1. **客户产品价格历史记录**：记录客户购买每个产品的历史价格
2. **区分发货类型**：销售发货（SALES）和厂家发货（FACTORY）的价格分别记录
3. **供应商产品价格历史**：记录供应商提供产品的历史价格
4. **自动填充价格**：开单时自动填充客户的最后一次购买价格

## 数据库设计

### 1. 客户产品价格历史表 (customer_product_prices)

```sql
CREATE TABLE `customer_product_prices` (
  `id` VARCHAR(191) PRIMARY KEY,
  `customer_id` VARCHAR(191) NOT NULL,
  `product_id` VARCHAR(191) NOT NULL,
  `price_type` VARCHAR(191) NOT NULL,  -- SALES: 销售发货, FACTORY: 厂家发货
  `unit_price` DECIMAL(10,2) NOT NULL,
  `order_id` VARCHAR(191) NULL,        -- 关联的订单ID
  `order_type` VARCHAR(191) NULL,      -- SALES_ORDER, FACTORY_SHIPMENT
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  
  INDEX `idx_customer_product_price_lookup` (`customer_id`, `product_id`, `price_type`),
  INDEX `idx_customer_price_history` (`customer_id`, `price_type`, `created_at` DESC),
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
);
```

### 2. 供应商产品价格历史表 (supplier_product_prices)

```sql
CREATE TABLE `supplier_product_prices` (
  `id` VARCHAR(191) PRIMARY KEY,
  `supplier_id` VARCHAR(191) NOT NULL,
  `product_id` VARCHAR(191) NOT NULL,
  `unit_price` DECIMAL(10,2) NOT NULL,
  `order_id` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  
  INDEX `idx_supplier_product_price_lookup` (`supplier_id`, `product_id`),
  INDEX `idx_supplier_price_history` (`supplier_id`, `created_at` DESC),
  FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
);
```

## API 接口

### 1. 获取客户价格历史

**GET** `/api/price-history/customer`

**Query 参数：**
- `customerId` (必填): 客户ID
- `productId` (可选): 产品ID，不传则返回该客户所有产品的最新价格
- `priceType` (可选): 价格类型 (SALES | FACTORY)

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": "xxx",
      "customerId": "xxx",
      "productId": "xxx",
      "priceType": "SALES",
      "unitPrice": 100.00,
      "createdAt": "2025-09-30T12:00:00.000Z",
      "product": {
        "id": "xxx",
        "code": "P001",
        "name": "产品名称",
        "specification": "规格",
        "unit": "件"
      }
    }
  ]
}
```

### 2. 获取供应商价格历史

**GET** `/api/price-history/supplier`

**Query 参数：**
- `supplierId` (必填): 供应商ID
- `productId` (可选): 产品ID

### 3. 记录客户价格历史

**POST** `/api/price-history/customer`

**请求体：**
```json
{
  "customerId": "xxx",
  "productId": "xxx",
  "priceType": "SALES",
  "unitPrice": 100.00,
  "orderId": "xxx",
  "orderType": "SALES_ORDER"
}
```

### 4. 记录供应商价格历史

**POST** `/api/price-history/supplier`

**请求体：**
```json
{
  "supplierId": "xxx",
  "productId": "xxx",
  "unitPrice": 100.00,
  "orderId": "xxx"
}
```

## 前端使用

### 1. 使用 Hook 获取价格历史

```typescript
import { useCustomerPriceHistory, getLatestPrice } from '@/hooks/use-price-history';

// 在组件中使用
const { data: priceHistoryData } = useCustomerPriceHistory({
  customerId: selectedCustomerId,
  priceType: 'SALES', // 或 'FACTORY'
});

// 获取产品的最新价格
const latestPrice = getLatestPrice(
  priceHistoryData?.data,
  productId,
  'SALES'
);
```

### 2. 自动填充价格

在销售订单表单中，当选择产品后会自动填充该客户对该产品的最后一次购买价格：

```typescript
// 在产品选择回调中
onProductChange={product => {
  if (product && selectedCustomerId && priceHistoryData?.data) {
    const latestPrice = getLatestPrice(
      priceHistoryData.data,
      product.id,
      priceType
    );
    if (latestPrice !== undefined) {
      form.setValue(`items.${index}.unitPrice`, latestPrice);
      toast({
        title: '已自动填充历史价格',
        description: `产品 "${product.name}" 的上次价格：¥${latestPrice}`,
      });
    }
  }
}}
```

## 价格记录时机

### 1. 销售订单创建时

在 `lib/api/handlers/sales-orders.ts` 的 `createSalesOrder` 函数中，订单创建成功后自动记录价格历史：

```typescript
// 记录客户产品价格历史
const priceType = validatedData.orderType === 'NORMAL' ? 'SALES' : 'FACTORY';
for (const item of validatedData.items) {
  if (!item.isManualProduct && item.productId && item.unitPrice) {
    await tx.customerProductPrice.create({
      data: {
        customerId: validatedData.customerId,
        productId: item.productId,
        priceType,
        unitPrice: item.unitPrice,
        orderId: salesOrder.id,
        orderType: 'SALES_ORDER',
      },
    });
  }
}
```

### 2. 厂家发货订单创建时

需要在厂家发货订单创建 API 中添加类似的逻辑，记录：
- 客户产品价格（priceType: 'FACTORY'）
- 供应商产品价格

## 价格类型说明

### SALES (销售发货价格)
- 用于普通销售订单（orderType: 'NORMAL'）
- 记录客户通过销售发货购买产品的价格
- 在创建普通销售订单时自动记录

### FACTORY (厂家发货价格)
- 用于厂家发货订单
- 记录客户通过厂家直接发货购买产品的价格
- 在创建厂家发货订单时自动记录

## 使用场景

### 场景1：创建销售订单
1. 用户选择客户
2. 系统自动加载该客户的历史价格
3. 用户选择产品
4. 系统自动填充该产品的最后一次价格
5. 用户可以修改价格
6. 订单创建成功后，新价格被记录到历史

### 场景2：查看价格历史
1. 在订单表单中选择客户和产品
2. 可以查看该客户购买该产品的历史价格列表
3. 可以选择使用历史价格中的任意一个

### 场景3：供应商价格管理
1. 在厂家发货订单中选择供应商和产品
2. 系统自动填充该供应商提供该产品的最后一次价格
3. 订单创建后记录新的供应商价格

## 数据库迁移

执行以下 SQL 文件创建价格历史表：

```bash
mysql -u root -p your_database < prisma/migrations/add_price_history_tables.sql
```

或者使用 Prisma 迁移：

```bash
npx prisma db push
npx prisma generate
```

## 注意事项

1. **价格记录时机**：只在订单创建成功后记录价格，避免记录未完成的订单价格
2. **手动输入产品**：手动输入的产品不记录价格历史
3. **价格类型区分**：销售发货和厂家发货的价格分别记录，互不影响
4. **历史价格查询**：默认返回最新的10条历史记录，按时间降序排列
5. **缓存策略**：价格历史查询结果缓存5分钟，减少数据库查询

## 后续优化建议

1. **价格趋势分析**：添加价格趋势图表，显示产品价格随时间的变化
2. **价格预警**：当价格变动超过一定比例时提醒用户
3. **批量价格更新**：支持批量更新客户的产品价格
4. **价格模板**：支持创建价格模板，快速应用到多个客户
5. **价格审批**：对于价格变动较大的订单，需要审批后才能创建

