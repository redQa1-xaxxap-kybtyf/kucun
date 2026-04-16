-- CreateTable
CREATE TABLE IF NOT EXISTS `print_templates` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `template_type` VARCHAR(50) NOT NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `content` JSON NOT NULL,
    `thumbnail` TEXT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `is_system` BOOLEAN NOT NULL DEFAULT false,
    `created_by` CHAR(36) NOT NULL,
    `updated_by` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Some environments already created this table manually or via db push.
-- Guard the follow-up DDL so prisma migrate deploy can still converge cleanly.
SET @schema_name = DATABASE();

SET @idx_type_status_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = @schema_name
    AND table_name = 'print_templates'
    AND index_name = 'idx_print_template_type_status'
);
SET @ddl = IF(
  @idx_type_status_exists = 0,
  'CREATE INDEX `idx_print_template_type_status` ON `print_templates` (`template_type`, `status`)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_default_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = @schema_name
    AND table_name = 'print_templates'
    AND index_name = 'idx_print_template_default'
);
SET @ddl = IF(
  @idx_default_exists = 0,
  'CREATE INDEX `idx_print_template_default` ON `print_templates` (`is_default`)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_creator_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = @schema_name
    AND table_name = 'print_templates'
    AND index_name = 'idx_print_template_creator'
);
SET @ddl = IF(
  @idx_creator_exists = 0,
  'CREATE INDEX `idx_print_template_creator` ON `print_templates` (`created_by`)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_status_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = @schema_name
    AND table_name = 'print_templates'
    AND index_name = 'idx_print_template_status'
);
SET @ddl = IF(
  @idx_status_exists = 0,
  'CREATE INDEX `idx_print_template_status` ON `print_templates` (`status`)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_created_by_exists = (
  SELECT COUNT(*)
  FROM information_schema.referential_constraints
  WHERE constraint_schema = @schema_name
    AND table_name = 'print_templates'
    AND constraint_name = 'print_templates_created_by_fkey'
);
SET @ddl = IF(
  @fk_created_by_exists = 0,
  'ALTER TABLE `print_templates` ADD CONSTRAINT `print_templates_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_updated_by_exists = (
  SELECT COUNT(*)
  FROM information_schema.referential_constraints
  WHERE constraint_schema = @schema_name
    AND table_name = 'print_templates'
    AND constraint_name = 'print_templates_updated_by_fkey'
);
SET @ddl = IF(
  @fk_updated_by_exists = 0,
  'ALTER TABLE `print_templates` ADD CONSTRAINT `print_templates_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
