ALTER TABLE `inbound_records`
  ADD COLUMN `opening_import_batch_id` VARCHAR(40) NULL AFTER `batch_number`;

CREATE INDEX `idx_inbound_records_opening_import_batch`
  ON `inbound_records`(`opening_import_batch_id`);

CREATE INDEX `idx_inbound_records_reason_opening_batch`
  ON `inbound_records`(`reason`, `opening_import_batch_id`);
