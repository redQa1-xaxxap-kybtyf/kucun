-- CreateTable
CREATE TABLE `audit_run` (
    `run_id` CHAR(36) NOT NULL,
    `audit_key` VARCHAR(64) NOT NULL,
    `range_start` DATETIME(3) NULL,
    `range_end` DATETIME(3) NULL,
    `status` VARCHAR(32) NOT NULL,
    `shard_json` JSON NULL,
    `started_at` DATETIME(3) NULL,
    `finished_at` DATETIME(3) NULL,
    `scanned_count` INT NULL,
    `issue_count` INT NULL,
    `config_json` JSON NULL,

    PRIMARY KEY (`run_id`),
    INDEX `idx_audit_run_key`(`audit_key`),
    INDEX `idx_audit_run_status`(`status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_finding` (
    `run_id` CHAR(36) NOT NULL,
    `domain` VARCHAR(64) NOT NULL,
    `reason_code` VARCHAR(64) NOT NULL,
    `severity` VARCHAR(16) NOT NULL,
    `entity_type` VARCHAR(64) NOT NULL,
    `entity_id` VARCHAR(64) NOT NULL,
    `entity_number` VARCHAR(128) NULL,
    `expected` JSON NULL,
    `actual` JSON NULL,
    `delta` DECIMAL(18,4) NULL,
    `message` TEXT NOT NULL,
    `evidence_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`run_id`, `domain`, `reason_code`, `entity_type`, `entity_id`),
    INDEX `idx_audit_finding_run_domain`(`run_id`, `domain`),
    INDEX `idx_audit_finding_reason`(`reason_code`),
    INDEX `idx_audit_finding_entity`(`entity_type`, `entity_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_metric` (
    `run_id` CHAR(36) NOT NULL,
    `metric_key` VARCHAR(64) NOT NULL,
    `metric_value_json` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`run_id`, `metric_key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `audit_finding` ADD CONSTRAINT `fk_audit_finding_run`
    FOREIGN KEY (`run_id`) REFERENCES `audit_run`(`run_id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_metric` ADD CONSTRAINT `fk_audit_metric_run`
    FOREIGN KEY (`run_id`) REFERENCES `audit_run`(`run_id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

