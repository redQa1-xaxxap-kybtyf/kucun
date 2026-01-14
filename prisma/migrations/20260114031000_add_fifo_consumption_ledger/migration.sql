-- CreateTable
CREATE TABLE `fifo_consumption_ledger` (
    `id` CHAR(36) NOT NULL,
    `business_key` VARCHAR(191) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `variant_id` CHAR(36) NULL,
    `batch_number` VARCHAR(100) NULL,
    `total_qty` INT NOT NULL,
    `total_cost` DECIMAL(18,2) NOT NULL,
    `average_unit_cost` DECIMAL(18,2) NOT NULL,
    `cost_breakdown` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_fifo_ledger_business_key`(`business_key`),
    INDEX `idx_fifo_ledger_product_variant`(`product_id`, `variant_id`),
    INDEX `idx_fifo_ledger_created`(`created_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `fifo_consumption_ledger` ADD CONSTRAINT `fk_fifo_ledger_product`
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fifo_consumption_ledger` ADD CONSTRAINT `fk_fifo_ledger_variant`
    FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

