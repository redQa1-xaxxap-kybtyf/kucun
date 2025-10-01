-- CreateIndex
CREATE INDEX "idx_factory_shipment_orders_customer_status_date" ON "factory_shipment_orders"("customer_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_factory_shipment_orders_status_plan" ON "factory_shipment_orders"("status", "plan_date");

-- CreateIndex
CREATE INDEX "idx_factory_shipment_orders_status_shipment" ON "factory_shipment_orders"("status", "shipment_date");

-- CreateIndex
CREATE INDEX "idx_inbound_records_product_batch_date" ON "inbound_records"("product_id", "batch_number", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_inbound_records_reason_date" ON "inbound_records"("reason", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_inbound_records_user_date" ON "inbound_records"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_inventory_adjustments_status_date" ON "inventory_adjustments"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_inventory_adjustments_operator_status" ON "inventory_adjustments"("operator_id", "status");

-- CreateIndex
CREATE INDEX "idx_inventory_adjustments_product_status" ON "inventory_adjustments"("product_id", "status");

-- CreateIndex
CREATE INDEX "idx_outbound_records_product_batch_date" ON "outbound_records"("product_id", "batch_number", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_outbound_records_customer_date" ON "outbound_records"("customer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_outbound_records_order_reason" ON "outbound_records"("sales_order_id", "reason");

-- CreateIndex
CREATE INDEX "idx_outbound_records_reason_date" ON "outbound_records"("reason", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_payable_records_supplier_status_date" ON "payable_records"("supplier_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_payable_records_status_due" ON "payable_records"("status", "due_date");

-- CreateIndex
CREATE INDEX "idx_payable_records_source" ON "payable_records"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "idx_payment_out_records_supplier_status_date" ON "payment_out_records"("supplier_id", "status", "payment_date" DESC);

-- CreateIndex
CREATE INDEX "idx_payment_out_records_payable_status" ON "payment_out_records"("payable_record_id", "status");

-- CreateIndex
CREATE INDEX "idx_payment_records_customer_status_date" ON "payment_records"("customer_id", "status", "payment_date" DESC);

-- CreateIndex
CREATE INDEX "idx_payment_records_order_status" ON "payment_records"("sales_order_id", "status");

-- CreateIndex
CREATE INDEX "idx_refund_records_customer_status_date" ON "refund_records"("customer_id", "status", "refund_date" DESC);

-- CreateIndex
CREATE INDEX "idx_refund_records_order_status" ON "refund_records"("sales_order_id", "status");

-- CreateIndex
CREATE INDEX "idx_refund_records_return_status" ON "refund_records"("return_order_id", "status");

-- CreateIndex
CREATE INDEX "idx_return_orders_customer_status_date" ON "return_orders"("customer_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_return_orders_order_status" ON "return_orders"("sales_order_id", "status");

-- CreateIndex
CREATE INDEX "idx_return_orders_status_type" ON "return_orders"("status", "type");

-- CreateIndex
CREATE INDEX "idx_sales_orders_customer_status_date" ON "sales_orders"("customer_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_sales_orders_status_date" ON "sales_orders"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_sales_orders_user_status_date" ON "sales_orders"("user_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_system_logs_type_level_date" ON "system_logs"("type", "level", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_system_logs_user_type_date" ON "system_logs"("user_id", "type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_system_logs_level_date" ON "system_logs"("level", "created_at" DESC);
