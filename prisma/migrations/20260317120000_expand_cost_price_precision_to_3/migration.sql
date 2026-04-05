ALTER TABLE `sales_order_items`
    MODIFY `unit_cost` DECIMAL(18, 3) NULL;

ALTER TABLE `inventory`
    MODIFY `unit_cost` DECIMAL(18, 3) NULL;

ALTER TABLE `inbound_records`
    MODIFY `unit_cost` DECIMAL(18, 3) NULL;

ALTER TABLE `inventory_cost_queue`
    MODIFY `unit_cost` DECIMAL(18, 3) NOT NULL;

ALTER TABLE `outbound_records`
    MODIFY `unit_cost` DECIMAL(18, 3) NULL;

ALTER TABLE `inventory_adjustments`
    MODIFY `unit_cost` DECIMAL(18, 3) NULL;

ALTER TABLE `factory_shipment_order_items`
    MODIFY `unit_cost` DECIMAL(18, 3) NULL;

ALTER TABLE `inventory_count_items`
    MODIFY `unit_cost` DECIMAL(18, 3) NULL;

ALTER TABLE `purchase_order_items`
    MODIFY `unit_cost` DECIMAL(18, 3) NULL,
    MODIFY `unit_cost_with_expense` DECIMAL(18, 3) NULL;

ALTER TABLE `fifo_consumption_ledger`
    MODIFY `average_unit_cost` DECIMAL(18, 3) NOT NULL;
