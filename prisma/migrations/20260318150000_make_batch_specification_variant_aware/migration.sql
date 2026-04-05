ALTER TABLE `batch_specifications`
    ADD COLUMN `variant_id` CHAR(36) NULL AFTER `product_id`,
    ADD COLUMN `variant_key` VARCHAR(36) NOT NULL DEFAULT '' AFTER `variant_id`;

UPDATE `batch_specifications`
SET `variant_key` = ''
WHERE `variant_key` IS NULL;

ALTER TABLE `batch_specifications`
    DROP INDEX `uk_batch_spec_product_batch`,
    ADD INDEX `idx_batch_spec_variant`(`variant_id`),
    ADD INDEX `idx_batch_spec_product_variant`(`product_id`, `variant_id`),
    ADD UNIQUE INDEX `uk_batch_spec_product_variant_batch`(`product_id`, `variant_key`, `batch_number`);

ALTER TABLE `batch_specifications`
    ADD CONSTRAINT `batch_specifications_variant_id_fkey`
        FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`)
        ON DELETE SET NULL
        ON UPDATE CASCADE;
