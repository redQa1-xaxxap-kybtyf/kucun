CREATE TABLE `manual_damage_ledgers` (
    `id` CHAR(36) NOT NULL,
    `ledger_number` VARCHAR(40) NOT NULL,
    `adjustment_id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `variant_id` CHAR(36) NULL,
    `supplier_id` CHAR(36) NULL,
    `batch_number` VARCHAR(100) NULL,
    `damaged_quantity` INTEGER NOT NULL,
    `damage_category` VARCHAR(32) NOT NULL DEFAULT 'damage',
    `damage_handling` VARCHAR(32) NOT NULL DEFAULT 'pending_confirm',
    `reference_amount` DECIMAL(18, 2) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'pending_review',
    `remarks` TEXT NULL,
    `created_by_id` CHAR(36) NOT NULL,
    `last_handled_by_id` CHAR(36) NULL,
    `claimed_at` DATETIME(3) NULL,
    `resolved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `manual_damage_ledgers_ledger_number_key`(`ledger_number`),
    UNIQUE INDEX `manual_damage_ledgers_adjustment_id_key`(`adjustment_id`),
    INDEX `idx_manual_damage_ledgers_status`(`status`),
    INDEX `idx_manual_damage_ledgers_handling`(`damage_handling`),
    INDEX `idx_manual_damage_ledgers_category`(`damage_category`),
    INDEX `idx_manual_damage_ledgers_supplier`(`supplier_id`),
    INDEX `idx_manual_damage_ledgers_product`(`product_id`),
    INDEX `idx_manual_damage_ledgers_variant`(`variant_id`),
    INDEX `idx_manual_damage_ledgers_batch`(`batch_number`),
    INDEX `idx_manual_damage_ledgers_created_at`(`created_at`),
    INDEX `idx_manual_damage_ledgers_created_by`(`created_by_id`),
    INDEX `idx_manual_damage_ledgers_handled_by`(`last_handled_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `manual_damage_ledgers`
    ADD CONSTRAINT `manual_damage_ledgers_adjustment_id_fkey`
        FOREIGN KEY (`adjustment_id`) REFERENCES `inventory_adjustments`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `manual_damage_ledgers_product_id_fkey`
        FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `manual_damage_ledgers_variant_id_fkey`
        FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `manual_damage_ledgers_supplier_id_fkey`
        FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `manual_damage_ledgers_created_by_id_fkey`
        FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `manual_damage_ledgers_last_handled_by_id_fkey`
        FOREIGN KEY (`last_handled_by_id`) REFERENCES `users`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE;
