-- 为销售订单明细表添加调货销售相关字段
-- Migration: add_transfer_sales_item_cost

-- 添加单品成本价字段
ALTER TABLE `sales_order_items` 
ADD COLUMN `unit_cost` DECIMAL(10,2) NULL COMMENT '单位成本价（调货销售时使用）' AFTER `unit_price`,
ADD COLUMN `cost_subtotal` DECIMAL(10,2) NULL COMMENT '成本小计（调货销售时使用）' AFTER `subtotal`,
ADD COLUMN `profit_amount` DECIMAL(10,2) NULL COMMENT '毛利金额（调货销售时使用）' AFTER `cost_subtotal`;

-- 添加索引以提高查询性能
CREATE INDEX `idx_sales_order_items_unit_cost` ON `sales_order_items` (`unit_cost`);
CREATE INDEX `idx_sales_order_items_profit` ON `sales_order_items` (`profit_amount`);

-- 添加约束：调货销售订单的明细必须有成本价
-- 注意：这个约束将在应用层实现，而不是数据库层，以保持灵活性
