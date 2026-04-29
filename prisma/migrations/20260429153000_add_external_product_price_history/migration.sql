ALTER TABLE `temporary_products`
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `thumbnail_url` VARCHAR(191) NULL,
    ADD COLUMN `images` LONGTEXT NULL,
    ADD COLUMN `show_in_mini_program` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `latest_cost_price` DECIMAL(18, 3) NULL,
    ADD COLUMN `latest_sale_price` DECIMAL(18, 2) NULL,
    ADD COLUMN `price_updated_at` DATETIME(3) NULL,
    ADD COLUMN `price_remarks` TEXT NULL;

CREATE INDEX `idx_temporary_products_show_mini` ON `temporary_products`(`show_in_mini_program`);
CREATE INDEX `idx_temporary_products_price_updated` ON `temporary_products`(`price_updated_at`);

CREATE TABLE `temporary_product_price_histories` (
    `id` CHAR(36) NOT NULL,
    `temporary_product_id` CHAR(36) NOT NULL,
    `supplier_id` CHAR(36) NOT NULL,
    `cost_price` DECIMAL(18, 3) NULL,
    `sale_price` DECIMAL(18, 2) NULL,
    `source_type` VARCHAR(32) NOT NULL DEFAULT 'manual',
    `source_order_number` VARCHAR(100) NULL,
    `remarks` TEXT NULL,
    `created_by` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_temp_product_prices_product`(`temporary_product_id`),
    INDEX `idx_temp_product_prices_supplier`(`supplier_id`),
    INDEX `idx_temp_product_prices_created`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `temporary_product_price_histories`
    ADD CONSTRAINT `temporary_product_price_histories_product_fkey`
        FOREIGN KEY (`temporary_product_id`) REFERENCES `temporary_products`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `temporary_product_price_histories_supplier_fkey`
        FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `temporary_product_price_histories_creator_fkey`
        FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE;
