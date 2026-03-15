-- Create inventory_cost_queue table for FIFO costing
-- This table existed in Prisma schema but was missing a migration, causing production to crash.

-- CreateTable (safe if already exists)
CREATE TABLE IF NOT EXISTS `inventory_cost_queue` (
    `id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `variant_id` CHAR(36) NULL,
    `batch_number` VARCHAR(100) NULL,
    `inbound_record_id` CHAR(36) NOT NULL,
    `remaining_qty` INT NOT NULL,
    `unit_cost` DECIMAL(18,2) NOT NULL,
    `inbound_date` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Ensure indexes exist (MySQL 5.7 compatible)
SET @db := DATABASE();

SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = @db
    AND table_name = 'inventory_cost_queue'
    AND index_name = 'idx_cost_queue_fifo'
);
SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX `idx_cost_queue_fifo` ON `inventory_cost_queue`(`product_id`, `variant_id`, `inbound_date`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = @db
    AND table_name = 'inventory_cost_queue'
    AND index_name = 'idx_cost_queue_available'
);
SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX `idx_cost_queue_available` ON `inventory_cost_queue`(`product_id`, `variant_id`, `remaining_qty`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = @db
    AND table_name = 'inventory_cost_queue'
    AND index_name = 'idx_cost_queue_batch'
);
SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX `idx_cost_queue_batch` ON `inventory_cost_queue`(`batch_number`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = @db
    AND table_name = 'inventory_cost_queue'
    AND index_name = 'idx_cost_queue_inbound'
);
SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX `idx_cost_queue_inbound` ON `inventory_cost_queue`(`inbound_record_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ensure foreign keys exist (idempotent, and avoid failing when legacy data has orphans)
SET @fk_exists := (
  SELECT COUNT(1)
  FROM information_schema.key_column_usage
  WHERE table_schema = @db
    AND table_name = 'inventory_cost_queue'
    AND column_name = 'product_id'
    AND referenced_table_name = 'products'
    AND referenced_column_name = 'id'
);
SET @fk_orphans := (
  SELECT COUNT(1)
  FROM inventory_cost_queue q
  LEFT JOIN products p ON p.id = q.product_id
  WHERE p.id IS NULL
);
SET @sql := IF(
  @fk_exists = 0 AND @fk_orphans = 0,
  'ALTER TABLE `inventory_cost_queue` ADD CONSTRAINT `fk_inventory_cost_queue_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(1)
  FROM information_schema.key_column_usage
  WHERE table_schema = @db
    AND table_name = 'inventory_cost_queue'
    AND column_name = 'variant_id'
    AND referenced_table_name = 'product_variants'
    AND referenced_column_name = 'id'
);
SET @fk_orphans := (
  SELECT COUNT(1)
  FROM inventory_cost_queue q
  LEFT JOIN product_variants v ON v.id = q.variant_id
  WHERE q.variant_id IS NOT NULL AND v.id IS NULL
);
SET @sql := IF(
  @fk_exists = 0 AND @fk_orphans = 0,
  'ALTER TABLE `inventory_cost_queue` ADD CONSTRAINT `fk_inventory_cost_queue_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(1)
  FROM information_schema.key_column_usage
  WHERE table_schema = @db
    AND table_name = 'inventory_cost_queue'
    AND column_name = 'inbound_record_id'
    AND referenced_table_name = 'inbound_records'
    AND referenced_column_name = 'id'
);
SET @fk_orphans := (
  SELECT COUNT(1)
  FROM inventory_cost_queue q
  LEFT JOIN inbound_records r ON r.id = q.inbound_record_id
  WHERE r.id IS NULL
);
SET @sql := IF(
  @fk_exists = 0 AND @fk_orphans = 0,
  'ALTER TABLE `inventory_cost_queue` ADD CONSTRAINT `fk_inventory_cost_queue_inbound_record` FOREIGN KEY (`inbound_record_id`) REFERENCES `inbound_records`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
