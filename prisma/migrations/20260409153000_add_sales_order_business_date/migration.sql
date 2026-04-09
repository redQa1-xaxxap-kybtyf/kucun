ALTER TABLE `sales_orders`
  ADD COLUMN `order_date` DATETIME(3) NULL AFTER `transfer_mode`;

UPDATE `sales_orders`
SET `order_date` = `created_at`
WHERE `order_date` IS NULL;

ALTER TABLE `sales_orders`
  MODIFY `order_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

CREATE INDEX `idx_sales_orders_order_date` ON `sales_orders`(`order_date`);
CREATE INDEX `idx_sales_orders_customer_order_date` ON `sales_orders`(`customer_id`, `order_date`);
CREATE INDEX `idx_sales_orders_status_order_date` ON `sales_orders`(`status`, `order_date`);
CREATE INDEX `idx_sales_orders_status_customer_order_date` ON `sales_orders`(`status`, `customer_id`, `order_date`);
