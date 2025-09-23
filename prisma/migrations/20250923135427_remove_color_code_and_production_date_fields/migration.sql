/*
  Warnings:

  - You are about to drop the column `color_code` on the `inventory` table. All the data in the column will be lost.
  - You are about to drop the column `production_date` on the `inventory` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "factory_shipment_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_number" TEXT NOT NULL,
    "container_number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "total_amount" REAL NOT NULL DEFAULT 0,
    "receivable_amount" REAL NOT NULL DEFAULT 0,
    "deposit_amount" REAL NOT NULL DEFAULT 0,
    "paid_amount" REAL NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "plan_date" DATETIME,
    "shipment_date" DATETIME,
    "arrival_date" DATETIME,
    "delivery_date" DATETIME,
    "completion_date" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "factory_shipment_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "factory_shipment_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "factory_shipment_order_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "factory_shipment_order_id" TEXT NOT NULL,
    "product_id" TEXT,
    "supplier_id" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit_price" REAL NOT NULL,
    "total_price" REAL NOT NULL,
    "is_manual_product" BOOLEAN,
    "manual_product_name" TEXT,
    "manual_specification" TEXT,
    "manual_weight" REAL,
    "manual_unit" TEXT,
    "display_name" TEXT NOT NULL,
    "specification" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'piece',
    "weight" REAL,
    "remarks" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "factory_shipment_order_items_factory_shipment_order_id_fkey" FOREIGN KEY ("factory_shipment_order_id") REFERENCES "factory_shipment_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "factory_shipment_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "factory_shipment_order_items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "refund_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "refund_number" TEXT NOT NULL,
    "return_order_id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "refund_type" TEXT NOT NULL,
    "refund_method" TEXT NOT NULL,
    "refund_amount" REAL NOT NULL,
    "processed_amount" REAL NOT NULL DEFAULT 0,
    "remaining_amount" REAL NOT NULL DEFAULT 0,
    "refund_date" DATETIME NOT NULL,
    "processed_date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT NOT NULL,
    "remarks" TEXT,
    "bank_info" TEXT,
    "receipt_number" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "refund_records_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "refund_records_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "refund_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "account_statements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_id" TEXT NOT NULL,
    "entity_name" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "total_amount" REAL NOT NULL DEFAULT 0,
    "paid_amount" REAL NOT NULL DEFAULT 0,
    "pending_amount" REAL NOT NULL DEFAULT 0,
    "overdue_amount" REAL NOT NULL DEFAULT 0,
    "credit_limit" REAL NOT NULL DEFAULT 0,
    "payment_terms" TEXT NOT NULL DEFAULT '30天',
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_transaction_date" DATETIME,
    "last_payment_date" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "statement_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "statement_id" TEXT NOT NULL,
    "transaction_type" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "reference_number" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "balance" REAL NOT NULL,
    "description" TEXT NOT NULL,
    "transaction_date" DATETIME NOT NULL,
    "due_date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "statement_transactions_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "account_statements" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_inventory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "batch_number" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved_quantity" INTEGER NOT NULL DEFAULT 0,
    "unit_cost" REAL,
    "location" TEXT,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "inventory_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inventory_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_inventory" ("batch_number", "id", "location", "product_id", "quantity", "reserved_quantity", "unit_cost", "updated_at", "variant_id") SELECT "batch_number", "id", "location", "product_id", "quantity", "reserved_quantity", "unit_cost", "updated_at", "variant_id" FROM "inventory";
DROP TABLE "inventory";
ALTER TABLE "new_inventory" RENAME TO "inventory";
CREATE INDEX "idx_inventory_product" ON "inventory"("product_id");
CREATE INDEX "idx_inventory_variant" ON "inventory"("variant_id");
CREATE INDEX "idx_inventory_quantity" ON "inventory"("quantity");
CREATE INDEX "idx_inventory_batch" ON "inventory"("batch_number");
CREATE UNIQUE INDEX "uk_inventory_variant_batch" ON "inventory"("product_id", "variant_id", "batch_number");
CREATE TABLE "new_sales_order_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sales_order_id" TEXT NOT NULL,
    "product_id" TEXT,
    "color_code" TEXT,
    "production_date" TEXT,
    "quantity" REAL NOT NULL,
    "unit_price" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    "unit_cost" REAL,
    "cost_subtotal" REAL,
    "profit_amount" REAL,
    "is_manual_product" BOOLEAN,
    "manual_product_name" TEXT,
    "manual_specification" TEXT,
    "manual_weight" REAL,
    "manual_unit" TEXT,
    CONSTRAINT "sales_order_items_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sales_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_sales_order_items" ("color_code", "id", "product_id", "production_date", "quantity", "sales_order_id", "subtotal", "unit_price") SELECT "color_code", "id", "product_id", "production_date", "quantity", "sales_order_id", "subtotal", "unit_price" FROM "sales_order_items";
DROP TABLE "sales_order_items";
ALTER TABLE "new_sales_order_items" RENAME TO "sales_order_items";
CREATE INDEX "idx_sales_order_items_order" ON "sales_order_items"("sales_order_id");
CREATE INDEX "idx_sales_order_items_product" ON "sales_order_items"("product_id");
CREATE INDEX "idx_sales_order_items_product_color" ON "sales_order_items"("product_id", "color_code");
CREATE INDEX "idx_sales_order_items_unit_cost" ON "sales_order_items"("unit_cost");
CREATE INDEX "idx_sales_order_items_profit" ON "sales_order_items"("profit_amount");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "factory_shipment_orders_order_number_key" ON "factory_shipment_orders"("order_number");

-- CreateIndex
CREATE INDEX "factory_shipment_orders_order_number_idx" ON "factory_shipment_orders"("order_number");

-- CreateIndex
CREATE INDEX "factory_shipment_orders_container_number_idx" ON "factory_shipment_orders"("container_number");

-- CreateIndex
CREATE INDEX "idx_factory_shipment_orders_customer" ON "factory_shipment_orders"("customer_id");

-- CreateIndex
CREATE INDEX "idx_factory_shipment_orders_user" ON "factory_shipment_orders"("user_id");

-- CreateIndex
CREATE INDEX "factory_shipment_orders_status_idx" ON "factory_shipment_orders"("status");

-- CreateIndex
CREATE INDEX "idx_factory_shipment_orders_created" ON "factory_shipment_orders"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_factory_shipment_order_items_order" ON "factory_shipment_order_items"("factory_shipment_order_id");

-- CreateIndex
CREATE INDEX "idx_factory_shipment_order_items_product" ON "factory_shipment_order_items"("product_id");

-- CreateIndex
CREATE INDEX "idx_factory_shipment_order_items_supplier" ON "factory_shipment_order_items"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "refund_records_refund_number_key" ON "refund_records"("refund_number");

-- CreateIndex
CREATE INDEX "idx_refund_records_order" ON "refund_records"("sales_order_id");

-- CreateIndex
CREATE INDEX "idx_refund_records_customer" ON "refund_records"("customer_id");

-- CreateIndex
CREATE INDEX "idx_refund_records_user" ON "refund_records"("user_id");

-- CreateIndex
CREATE INDEX "idx_refund_records_status" ON "refund_records"("status");

-- CreateIndex
CREATE INDEX "idx_refund_records_date" ON "refund_records"("refund_date" DESC);

-- CreateIndex
CREATE INDEX "idx_refund_records_type" ON "refund_records"("refund_type");

-- CreateIndex
CREATE INDEX "idx_refund_records_method" ON "refund_records"("refund_method");

-- CreateIndex
CREATE INDEX "idx_account_statements_entity" ON "account_statements"("entity_id");

-- CreateIndex
CREATE INDEX "idx_account_statements_type" ON "account_statements"("entity_type");

-- CreateIndex
CREATE INDEX "idx_account_statements_status" ON "account_statements"("status");

-- CreateIndex
CREATE INDEX "idx_account_statements_last_transaction" ON "account_statements"("last_transaction_date" DESC);

-- CreateIndex
CREATE INDEX "idx_account_statements_overdue" ON "account_statements"("overdue_amount");

-- CreateIndex
CREATE INDEX "idx_statement_transactions_statement" ON "statement_transactions"("statement_id");

-- CreateIndex
CREATE INDEX "idx_statement_transactions_type" ON "statement_transactions"("transaction_type");

-- CreateIndex
CREATE INDEX "idx_statement_transactions_reference" ON "statement_transactions"("reference_id");

-- CreateIndex
CREATE INDEX "idx_statement_transactions_date" ON "statement_transactions"("transaction_date" DESC);

-- CreateIndex
CREATE INDEX "idx_statement_transactions_status" ON "statement_transactions"("status");
