-- CreateTable
CREATE TABLE `mini_program_goods_requests` (
    `id` CHAR(36) NOT NULL,
    `request_number` VARCHAR(64) NOT NULL,
    `lookup_token` VARCHAR(96) NOT NULL,
    `customer_name` VARCHAR(100) NULL,
    `customer_phone` VARCHAR(50) NOT NULL,
    `contact_address` VARCHAR(255) NULL,
    `remarks` TEXT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `mini_program_goods_requests_request_number_key`(`request_number`),
    UNIQUE INDEX `mini_program_goods_requests_lookup_token_key`(`lookup_token`),
    INDEX `idx_mini_goods_customer_created`(`customer_phone`, `created_at`),
    INDEX `idx_mini_goods_status_created`(`status`, `created_at`),
    INDEX `idx_mini_goods_created`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mini_program_goods_request_items` (
    `id` CHAR(36) NOT NULL,
    `request_id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NULL,
    `temporary_product_id` CHAR(36) NULL,
    `product_source` VARCHAR(32) NOT NULL DEFAULT 'own',
    `product_code` VARCHAR(120) NOT NULL,
    `product_name` VARCHAR(150) NOT NULL,
    `specification` TEXT NULL,
    `unit` VARCHAR(32) NOT NULL DEFAULT '片',
    `thumbnail_url` VARCHAR(2048) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `remarks` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_mini_goods_items_request`(`request_id`),
    INDEX `idx_mini_goods_items_product`(`product_id`),
    INDEX `idx_mini_goods_items_temp_product`(`temporary_product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `mini_program_goods_request_items` ADD CONSTRAINT `mini_program_goods_request_items_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `mini_program_goods_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mini_program_goods_request_items` ADD CONSTRAINT `mini_program_goods_request_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mini_program_goods_request_items` ADD CONSTRAINT `mini_program_goods_request_items_temporary_product_id_fkey` FOREIGN KEY (`temporary_product_id`) REFERENCES `temporary_products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
