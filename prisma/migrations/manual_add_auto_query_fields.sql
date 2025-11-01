-- 手动迁移脚本：添加自动查询字段
-- 执行时间：2025-01-XX
-- 说明：为 factory_shipment_orders 和 shipping_queries 表添加自动查询相关字段

-- 1. 为 factory_shipment_orders 表添加新字段
ALTER TABLE `factory_shipment_orders`
ADD COLUMN `last_shipping_query_at` DATETIME(3) NULL COMMENT '最后一次运输查询时间',
ADD COLUMN `shipping_query_status` VARCHAR(50) NULL COMMENT '查询状态: pending, success, failed',
ADD COLUMN `shipping_query_error` TEXT NULL COMMENT '查询错误信息',
ADD COLUMN `preferred_site_id` VARCHAR(191) NULL COMMENT '首选查询站点ID';

-- 2. 为 factory_shipment_orders 表添加索引
CREATE INDEX `idx_factory_shipment_orders_shipping_company` ON `factory_shipment_orders`(`shipping_company`);
CREATE INDEX `idx_factory_shipment_orders_query_status` ON `factory_shipment_orders`(`shipping_query_status`);
CREATE INDEX `idx_factory_shipment_orders_last_query` ON `factory_shipment_orders`(`last_shipping_query_at`);
CREATE INDEX `idx_factory_shipment_orders_preferred_site` ON `factory_shipment_orders`(`preferred_site_id`);

-- 3. 为 factory_shipment_orders 表添加外键约束
ALTER TABLE `factory_shipment_orders`
ADD CONSTRAINT `factory_shipment_orders_preferred_site_id_fkey` 
FOREIGN KEY (`preferred_site_id`) REFERENCES `shipping_sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. 为 shipping_queries 表添加新字段
ALTER TABLE `shipping_queries`
ADD COLUMN `factory_shipment_order_id` VARCHAR(191) NULL COMMENT '关联的厂家发货订单ID';

-- 5. 为 shipping_queries 表添加索引
CREATE INDEX `idx_shipping_queries_factory_shipment_order_id` ON `shipping_queries`(`factory_shipment_order_id`);

-- 6. 为 shipping_queries 表添加外键约束
ALTER TABLE `shipping_queries`
ADD CONSTRAINT `shipping_queries_factory_shipment_order_id_fkey` 
FOREIGN KEY (`factory_shipment_order_id`) REFERENCES `factory_shipment_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 7. 修改 shipping_queries 表的字段类型（从 TEXT 改为 VARCHAR）
ALTER TABLE `shipping_queries`
MODIFY COLUMN `status` VARCHAR(500) NULL COMMENT '当前状态',
MODIFY COLUMN `destination` VARCHAR(500) NULL COMMENT '目的地';

