-- Data management: add dataTag/void fields + task table

ALTER TABLE `sales_orders`
  ADD COLUMN `data_tag` VARCHAR(16) NOT NULL DEFAULT 'prod',
  ADD COLUMN `voided_at` DATETIME NULL,
  ADD COLUMN `voided_by` CHAR(36) NULL,
  ADD COLUMN `void_reason` VARCHAR(64) NULL;

CREATE INDEX `idx_sales_orders_data_tag` ON `sales_orders`(`data_tag`);
CREATE INDEX `idx_sales_orders_voided_at` ON `sales_orders`(`voided_at`);

ALTER TABLE `payment_records`
  ADD COLUMN `data_tag` VARCHAR(16) NOT NULL DEFAULT 'prod',
  ADD COLUMN `voided_at` DATETIME NULL,
  ADD COLUMN `voided_by` CHAR(36) NULL,
  ADD COLUMN `void_reason` VARCHAR(64) NULL;

CREATE INDEX `idx_payment_records_data_tag` ON `payment_records`(`data_tag`);
CREATE INDEX `idx_payment_records_voided_at` ON `payment_records`(`voided_at`);

ALTER TABLE `factory_shipment_orders`
  ADD COLUMN `data_tag` VARCHAR(16) NOT NULL DEFAULT 'prod',
  ADD COLUMN `voided_at` DATETIME NULL,
  ADD COLUMN `voided_by` CHAR(36) NULL,
  ADD COLUMN `void_reason` VARCHAR(64) NULL;

CREATE INDEX `idx_factory_shipment_orders_data_tag` ON `factory_shipment_orders`(`data_tag`);
CREATE INDEX `idx_factory_shipment_orders_voided_at` ON `factory_shipment_orders`(`voided_at`);

ALTER TABLE `return_orders`
  ADD COLUMN `data_tag` VARCHAR(16) NOT NULL DEFAULT 'prod',
  ADD COLUMN `voided_at` DATETIME NULL,
  ADD COLUMN `voided_by` CHAR(36) NULL,
  ADD COLUMN `void_reason` VARCHAR(64) NULL;

CREATE INDEX `idx_return_orders_data_tag` ON `return_orders`(`data_tag`);
CREATE INDEX `idx_return_orders_voided_at` ON `return_orders`(`voided_at`);

ALTER TABLE `refund_records`
  ADD COLUMN `data_tag` VARCHAR(16) NOT NULL DEFAULT 'prod',
  ADD COLUMN `voided_at` DATETIME NULL,
  ADD COLUMN `voided_by` CHAR(36) NULL,
  ADD COLUMN `void_reason` VARCHAR(64) NULL;

CREATE INDEX `idx_refund_records_data_tag` ON `refund_records`(`data_tag`);
CREATE INDEX `idx_refund_records_voided_at` ON `refund_records`(`voided_at`);

ALTER TABLE `purchase_orders`
  ADD COLUMN `data_tag` VARCHAR(16) NOT NULL DEFAULT 'prod',
  ADD COLUMN `voided_at` DATETIME NULL,
  ADD COLUMN `voided_by` CHAR(36) NULL,
  ADD COLUMN `void_reason` VARCHAR(64) NULL;

CREATE INDEX `idx_purchase_orders_data_tag` ON `purchase_orders`(`data_tag`);
CREATE INDEX `idx_purchase_orders_voided_at` ON `purchase_orders`(`voided_at`);

ALTER TABLE `expense_records`
  ADD COLUMN `data_tag` VARCHAR(16) NOT NULL DEFAULT 'prod',
  ADD COLUMN `voided_at` DATETIME NULL,
  ADD COLUMN `voided_by` CHAR(36) NULL,
  ADD COLUMN `void_reason` VARCHAR(64) NULL;

CREATE INDEX `idx_expense_records_data_tag` ON `expense_records`(`data_tag`);
CREATE INDEX `idx_expense_records_voided_at` ON `expense_records`(`voided_at`);

ALTER TABLE `payable_records`
  ADD COLUMN `data_tag` VARCHAR(16) NOT NULL DEFAULT 'prod',
  ADD COLUMN `voided_at` DATETIME NULL,
  ADD COLUMN `voided_by` CHAR(36) NULL,
  ADD COLUMN `void_reason` VARCHAR(64) NULL;

CREATE INDEX `idx_payable_records_data_tag` ON `payable_records`(`data_tag`);
CREATE INDEX `idx_payable_records_voided_at` ON `payable_records`(`voided_at`);

ALTER TABLE `payment_out_records`
  ADD COLUMN `data_tag` VARCHAR(16) NOT NULL DEFAULT 'prod',
  ADD COLUMN `voided_at` DATETIME NULL,
  ADD COLUMN `voided_by` CHAR(36) NULL,
  ADD COLUMN `void_reason` VARCHAR(64) NULL;

CREATE INDEX `idx_payment_out_records_data_tag` ON `payment_out_records`(`data_tag`);
CREATE INDEX `idx_payment_out_records_voided_at` ON `payment_out_records`(`voided_at`);

CREATE TABLE `data_management_tasks` (
  `id` CHAR(36) NOT NULL,
  `action` VARCHAR(32) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'queued',
  `stage` VARCHAR(8) NULL,
  `requested_by` CHAR(36) NOT NULL,
  `idempotency_key` VARCHAR(191) NULL,
  `scope` TEXT NULL,
  `preview` TEXT NULL,
  `result` TEXT NULL,
  `error_message` TEXT NULL,
  `started_at` DATETIME NULL,
  `finished_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE UNIQUE INDEX `uk_data_management_tasks_idempotency_key`
  ON `data_management_tasks`(`idempotency_key`);

CREATE INDEX `idx_data_management_tasks_action` ON `data_management_tasks`(`action`);
CREATE INDEX `idx_data_management_tasks_status` ON `data_management_tasks`(`status`);
CREATE INDEX `idx_data_management_tasks_created_at` ON `data_management_tasks`(`created_at`);

