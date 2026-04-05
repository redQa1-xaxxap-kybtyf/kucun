ALTER TABLE `inbound_records`
    ADD COLUMN `damaged_quantity` INTEGER NOT NULL DEFAULT 0 AFTER `quantity`,
    ADD COLUMN `damage_handling` VARCHAR(32) NULL AFTER `damaged_quantity`,
    ADD COLUMN `damage_total_cost` DECIMAL(18, 2) NULL AFTER `damage_handling`,
    ADD COLUMN `damage_remarks` TEXT NULL AFTER `damage_total_cost`;
