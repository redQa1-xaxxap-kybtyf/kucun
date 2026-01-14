-- Add ConsistencyAlert table for deduplication and tracking
-- Migration: add_consistency_alerts

-- Create ConsistencyAlert table
CREATE TABLE IF NOT EXISTS `consistency_alerts` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `rule_name` VARCHAR(100) NOT NULL,
  `severity` VARCHAR(10) NOT NULL,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` CHAR(36) NOT NULL,
  `dedupe_key` VARCHAR(255) NOT NULL UNIQUE,
  `status` VARCHAR(20) NOT NULL DEFAULT 'open',
  `first_seen_at` DATETIME(3) NOT NULL,
  `last_seen_at` DATETIME(3) NOT NULL,
  `occurrences` INT NOT NULL DEFAULT 1,
  `details` JSON,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  
  UNIQUE KEY `uk_consistency_alerts_dedupe` (`dedupe_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create indexes
CREATE INDEX `idx_consistency_alerts_rule_name` ON `consistency_alerts` (`rule_name`);
CREATE INDEX `idx_consistency_alerts_severity` ON `consistency_alerts` (`severity`);
CREATE INDEX `idx_consistency_alerts_entity_type` ON `consistency_alerts` (`entity_type`);
CREATE INDEX `idx_consistency_alerts_status` ON `consistency_alerts` (`status`);
CREATE INDEX `idx_consistency_alerts_first_seen_at` ON `consistency_alerts` (`first_seen_at`);
CREATE INDEX `idx_consistency_alerts_last_seen_at` ON `consistency_alerts` (`last_seen_at`);
