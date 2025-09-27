-- 创建订单序列表，用于生成唯一的订单号
-- 这个表使用数据库级别的原子操作来保证并发安全

CREATE TABLE IF NOT EXISTS `order_sequences` (
  `id` VARCHAR(191) NOT NULL,
  `sequence_type` VARCHAR(50) NOT NULL COMMENT '序列类型：sales_order, purchase_order等',
  `date_key` VARCHAR(8) NOT NULL COMMENT '日期键：YYYYMMDD',
  `current_sequence` INT NOT NULL DEFAULT 0 COMMENT '当前序列号',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_order_sequences_type_date` (`sequence_type`, `date_key`),
  INDEX `idx_order_sequences_type` (`sequence_type`),
  INDEX `idx_order_sequences_date` (`date_key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 插入销售订单的初始序列记录（如果不存在）
INSERT IGNORE INTO `order_sequences` (`id`, `sequence_type`, `date_key`, `current_sequence`)
VALUES (UUID(), 'sales_order', DATE_FORMAT(NOW(), '%Y%m%d'), 0);
