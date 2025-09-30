-- 添加客户产品价格历史表和供应商产品价格历史表
-- Migration: add_price_history_tables

-- 创建客户产品价格历史表
CREATE TABLE `customer_product_prices` (
  `id` VARCHAR(191) NOT NULL,
  `customer_id` VARCHAR(191) NOT NULL,
  `product_id` VARCHAR(191) NOT NULL,
  `price_type` VARCHAR(191) NOT NULL COMMENT 'SALES: 销售发货价格, FACTORY: 厂家发货价格',
  `unit_price` DECIMAL(10,2) NOT NULL,
  `order_id` VARCHAR(191) NULL COMMENT '关联的订单ID',
  `order_type` VARCHAR(191) NULL COMMENT 'SALES_ORDER, FACTORY_SHIPMENT',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  
  PRIMARY KEY (`id`),
  INDEX `idx_customer_product_price_lookup` (`customer_id`, `product_id`, `price_type`),
  INDEX `idx_customer_price_history` (`customer_id`, `price_type`, `created_at` DESC),
  INDEX `idx_customer_product_price_product` (`product_id`),
  
  CONSTRAINT `customer_product_prices_customer_id_fkey` 
    FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `customer_product_prices_product_id_fkey` 
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建供应商产品价格历史表
CREATE TABLE `supplier_product_prices` (
  `id` VARCHAR(191) NOT NULL,
  `supplier_id` VARCHAR(191) NOT NULL,
  `product_id` VARCHAR(191) NOT NULL,
  `unit_price` DECIMAL(10,2) NOT NULL,
  `order_id` VARCHAR(191) NULL COMMENT '关联的厂家发货订单ID',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  
  PRIMARY KEY (`id`),
  INDEX `idx_supplier_product_price_lookup` (`supplier_id`, `product_id`),
  INDEX `idx_supplier_price_history` (`supplier_id`, `created_at` DESC),
  INDEX `idx_supplier_product_price_product` (`product_id`),
  
  CONSTRAINT `supplier_product_prices_supplier_id_fkey` 
    FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `supplier_product_prices_product_id_fkey` 
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

