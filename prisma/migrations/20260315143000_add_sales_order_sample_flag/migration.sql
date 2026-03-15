SET @db := DATABASE();

SET @column_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = @db
    AND table_name = 'sales_orders'
    AND column_name = 'is_sample_order'
);

SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE `sales_orders` ADD COLUMN `is_sample_order` TINYINT(1) NOT NULL DEFAULT 0 AFTER `transfer_mode`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = @db
    AND table_name = 'sales_orders'
    AND index_name = 'idx_sales_orders_is_sample_order'
);

SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX `idx_sales_orders_is_sample_order` ON `sales_orders`(`is_sample_order`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
