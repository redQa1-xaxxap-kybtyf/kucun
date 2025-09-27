-- 批次规格参数管理数据迁移脚本
-- 创建批次规格参数表并迁移现有数据

-- 1. 创建批次规格参数表
CREATE TABLE `batch_specifications` (
  `id` VARCHAR(36) NOT NULL,
  `product_id` VARCHAR(36) NOT NULL,
  `batch_number` VARCHAR(50) NOT NULL,
  `pieces_per_unit` INT NOT NULL DEFAULT 1,
  `weight` DOUBLE NULL,
  `thickness` DOUBLE NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_batch_spec_product_batch` (`product_id`, `batch_number`),
  INDEX `idx_batch_spec_product` (`product_id`),
  INDEX `idx_batch_spec_batch` (`batch_number`),
  INDEX `idx_batch_spec_pieces` (`pieces_per_unit`),
  
  CONSTRAINT `batch_specifications_product_id_fkey` 
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. 为入库记录表添加批次规格参数关联字段
ALTER TABLE `inbound_records` 
ADD COLUMN `batch_specification_id` VARCHAR(36) NULL AFTER `batch_number`;

-- 3. 添加索引
ALTER TABLE `inbound_records` 
ADD INDEX `idx_inbound_records_batch_spec` (`batch_specification_id`);

-- 4. 添加外键约束
ALTER TABLE `inbound_records` 
ADD CONSTRAINT `inbound_records_batch_specification_id_fkey` 
  FOREIGN KEY (`batch_specification_id`) REFERENCES `batch_specifications` (`id`) 
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. 数据迁移：为现有的入库记录创建批次规格参数
-- 注意：这个脚本会为每个唯一的产品+批次组合创建规格参数记录
INSERT INTO `batch_specifications` (
  `id`,
  `product_id`,
  `batch_number`,
  `pieces_per_unit`,
  `weight`,
  `thickness`,
  `created_at`,
  `updated_at`
)
SELECT 
  UUID() as `id`,
  `p`.`id` as `product_id`,
  COALESCE(`ir`.`batch_number`, CONCAT(`p`.`code`, '-DEFAULT-001')) as `batch_number`,
  `p`.`pieces_per_unit`,
  `p`.`weight`,
  `p`.`thickness`,
  MIN(`ir`.`created_at`) as `created_at`,
  MAX(`ir`.`updated_at`) as `updated_at`
FROM `products` `p`
LEFT JOIN `inbound_records` `ir` ON `p`.`id` = `ir`.`product_id`
WHERE `p`.`status` = 'active'
GROUP BY `p`.`id`, COALESCE(`ir`.`batch_number`, CONCAT(`p`.`code`, '-DEFAULT-001'))
ON DUPLICATE KEY UPDATE
  `pieces_per_unit` = VALUES(`pieces_per_unit`),
  `weight` = VALUES(`weight`),
  `thickness` = VALUES(`thickness`),
  `updated_at` = VALUES(`updated_at`);

-- 6. 更新入库记录表，关联到对应的批次规格参数
UPDATE `inbound_records` `ir`
JOIN `batch_specifications` `bs` ON (
  `ir`.`product_id` = `bs`.`product_id` 
  AND COALESCE(`ir`.`batch_number`, CONCAT(
    (SELECT `code` FROM `products` WHERE `id` = `ir`.`product_id`), 
    '-DEFAULT-001'
  )) = `bs`.`batch_number`
)
SET `ir`.`batch_specification_id` = `bs`.`id`;

-- 7. 验证数据迁移结果
-- 检查是否所有入库记录都已关联到批次规格参数
SELECT 
  COUNT(*) as total_inbound_records,
  COUNT(`batch_specification_id`) as linked_records,
  COUNT(*) - COUNT(`batch_specification_id`) as unlinked_records
FROM `inbound_records`;

-- 8. 创建视图用于兼容性查询（可选）
CREATE VIEW `inbound_records_with_specs` AS
SELECT 
  `ir`.*,
  `bs`.`pieces_per_unit` as `batch_pieces_per_unit`,
  `bs`.`weight` as `batch_weight`,
  `bs`.`thickness` as `batch_thickness`
FROM `inbound_records` `ir`
LEFT JOIN `batch_specifications` `bs` ON `ir`.`batch_specification_id` = `bs`.`id`;
