ALTER TABLE `sales_orders`
    ADD COLUMN `sample_settlement_type` VARCHAR(32) NOT NULL DEFAULT 'FREE' AFTER `is_sample_order`;

CREATE INDEX `idx_sales_orders_sample_settlement_type`
    ON `sales_orders`(`sample_settlement_type`);
