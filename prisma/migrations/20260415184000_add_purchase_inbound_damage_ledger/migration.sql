CREATE TABLE `purchase_inbound_damage_ledgers` (
    `id` CHAR(36) NOT NULL,
    `ledger_number` VARCHAR(40) NOT NULL,
    `inbound_record_id` CHAR(36) NOT NULL,
    `purchase_order_id` CHAR(36) NULL,
    `purchase_order_item_id` CHAR(36) NULL,
    `product_id` CHAR(36) NOT NULL,
    `supplier_id` CHAR(36) NULL,
    `batch_number` VARCHAR(100) NULL,
    `damaged_quantity` INTEGER NOT NULL,
    `damage_handling` VARCHAR(32) NOT NULL,
    `reference_amount` DECIMAL(18, 2) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'pending_claim',
    `remarks` TEXT NULL,
    `created_by_id` CHAR(36) NOT NULL,
    `last_handled_by_id` CHAR(36) NULL,
    `claimed_at` DATETIME(3) NULL,
    `resolved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `purchase_inbound_damage_ledgers_ledger_number_key`(`ledger_number`),
    UNIQUE INDEX `purchase_inbound_damage_ledgers_inbound_record_id_key`(`inbound_record_id`),
    INDEX `idx_purchase_damage_ledgers_status`(`status`),
    INDEX `idx_purchase_damage_ledgers_handling`(`damage_handling`),
    INDEX `idx_purchase_damage_ledgers_supplier`(`supplier_id`),
    INDEX `idx_purchase_damage_ledgers_product`(`product_id`),
    INDEX `idx_purchase_damage_ledgers_batch`(`batch_number`),
    INDEX `idx_purchase_damage_ledgers_purchase_order`(`purchase_order_id`),
    INDEX `idx_purchase_damage_ledgers_purchase_order_item`(`purchase_order_item_id`),
    INDEX `idx_purchase_damage_ledgers_created_at`(`created_at`),
    INDEX `idx_purchase_damage_ledgers_created_by`(`created_by_id`),
    INDEX `idx_purchase_damage_ledgers_handled_by`(`last_handled_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `purchase_inbound_damage_ledgers`
    ADD CONSTRAINT `purchase_inbound_damage_ledgers_inbound_record_id_fkey`
        FOREIGN KEY (`inbound_record_id`) REFERENCES `inbound_records`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `purchase_inbound_damage_ledgers_purchase_order_id_fkey`
        FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `purchase_inbound_damage_ledgers_purchase_order_item_id_fkey`
        FOREIGN KEY (`purchase_order_item_id`) REFERENCES `purchase_order_items`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `purchase_inbound_damage_ledgers_product_id_fkey`
        FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `purchase_inbound_damage_ledgers_supplier_id_fkey`
        FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `purchase_inbound_damage_ledgers_created_by_id_fkey`
        FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `purchase_inbound_damage_ledgers_last_handled_by_id_fkey`
        FOREIGN KEY (`last_handled_by_id`) REFERENCES `users`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE;
