/*
  Warnings:

  - You are about to drop the column `bank_account` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `bank_name` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `contact_person` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `credit_limit` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `normalized_name` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `payment_terms` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `tax_number` on the `suppliers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "categories" ADD COLUMN "description" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN "description" TEXT;
ALTER TABLE "products" ADD COLUMN "images" TEXT;
ALTER TABLE "products" ADD COLUMN "thumbnail_url" TEXT;

-- CreateTable
CREATE TABLE "outbound_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "record_number" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "batch_number" TEXT,
    "inventory_id" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit_cost" REAL,
    "total_cost" REAL,
    "reason" TEXT NOT NULL DEFAULT 'manual_outbound',
    "notes" TEXT,
    "customer_id" TEXT,
    "sales_order_id" TEXT,
    "operator_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "outbound_records_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "outbound_records_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "outbound_records_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "inventory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "outbound_records_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "outbound_records_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "outbound_records_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "return_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "return_number" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "process_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reason" TEXT NOT NULL,
    "total_amount" REAL NOT NULL,
    "refund_amount" REAL NOT NULL,
    "remarks" TEXT,
    "submitted_at" DATETIME,
    "approved_at" DATETIME,
    "processed_at" DATETIME,
    "completed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "return_orders_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "return_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "return_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "return_order_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "return_order_id" TEXT NOT NULL,
    "sales_order_item_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "color_code" TEXT,
    "production_date" TEXT,
    "return_quantity" REAL NOT NULL,
    "original_quantity" REAL NOT NULL,
    "unit_price" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    "reason" TEXT,
    "condition" TEXT NOT NULL DEFAULT 'good',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "return_order_items_return_order_id_fkey" FOREIGN KEY ("return_order_id") REFERENCES "return_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "return_order_items_sales_order_item_id_fkey" FOREIGN KEY ("sales_order_item_id") REFERENCES "sales_order_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "return_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payable_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payable_number" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT,
    "source_number" TEXT,
    "payable_amount" REAL NOT NULL,
    "paid_amount" REAL NOT NULL DEFAULT 0,
    "remaining_amount" REAL NOT NULL,
    "due_date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payment_terms" TEXT NOT NULL DEFAULT '30天',
    "description" TEXT,
    "remarks" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "payable_records_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payable_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payment_out_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payment_number" TEXT NOT NULL,
    "payable_record_id" TEXT,
    "supplier_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'bank_transfer',
    "payment_amount" REAL NOT NULL,
    "payment_date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "remarks" TEXT,
    "voucher_number" TEXT,
    "bank_info" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "payment_out_records_payable_record_id_fkey" FOREIGN KEY ("payable_record_id") REFERENCES "payable_records" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "payment_out_records_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payment_out_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_refund_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "refund_number" TEXT NOT NULL,
    "return_order_id" TEXT,
    "return_order_number" TEXT,
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
    CONSTRAINT "refund_records_return_order_id_fkey" FOREIGN KEY ("return_order_id") REFERENCES "return_orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "refund_records_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "refund_records_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "refund_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_refund_records" ("bank_info", "created_at", "customer_id", "id", "processed_amount", "processed_date", "reason", "receipt_number", "refund_amount", "refund_date", "refund_method", "refund_number", "refund_type", "remaining_amount", "remarks", "return_order_id", "return_order_number", "sales_order_id", "status", "updated_at", "user_id") SELECT "bank_info", "created_at", "customer_id", "id", "processed_amount", "processed_date", "reason", "receipt_number", "refund_amount", "refund_date", "refund_method", "refund_number", "refund_type", "remaining_amount", "remarks", "return_order_id", "return_order_number", "sales_order_id", "status", "updated_at", "user_id" FROM "refund_records";
DROP TABLE "refund_records";
ALTER TABLE "new_refund_records" RENAME TO "refund_records";
CREATE UNIQUE INDEX "refund_records_refund_number_key" ON "refund_records"("refund_number");
CREATE INDEX "idx_refund_records_order" ON "refund_records"("sales_order_id");
CREATE INDEX "idx_refund_records_customer" ON "refund_records"("customer_id");
CREATE INDEX "idx_refund_records_user" ON "refund_records"("user_id");
CREATE INDEX "idx_refund_records_status" ON "refund_records"("status");
CREATE INDEX "idx_refund_records_date" ON "refund_records"("refund_date" DESC);
CREATE INDEX "idx_refund_records_type" ON "refund_records"("refund_type");
CREATE INDEX "idx_refund_records_method" ON "refund_records"("refund_method");
CREATE TABLE "new_suppliers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "supplier_code" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_suppliers" ("address", "created_at", "id", "name", "phone", "status", "supplier_code", "updated_at") SELECT "address", "created_at", "id", "name", "phone", "status", "supplier_code", "updated_at" FROM "suppliers";
DROP TABLE "suppliers";
ALTER TABLE "new_suppliers" RENAME TO "suppliers";
CREATE UNIQUE INDEX "suppliers_supplier_code_key" ON "suppliers"("supplier_code");
CREATE INDEX "suppliers_name_idx" ON "suppliers"("name");
CREATE INDEX "suppliers_phone_idx" ON "suppliers"("phone");
CREATE INDEX "suppliers_status_idx" ON "suppliers"("status");
CREATE INDEX "idx_suppliers_code" ON "suppliers"("supplier_code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "outbound_records_record_number_key" ON "outbound_records"("record_number");

-- CreateIndex
CREATE INDEX "idx_outbound_records_product" ON "outbound_records"("product_id");

-- CreateIndex
CREATE INDEX "idx_outbound_records_variant" ON "outbound_records"("variant_id");

-- CreateIndex
CREATE INDEX "idx_outbound_records_batch" ON "outbound_records"("batch_number");

-- CreateIndex
CREATE INDEX "idx_outbound_records_inventory" ON "outbound_records"("inventory_id");

-- CreateIndex
CREATE INDEX "idx_outbound_records_customer" ON "outbound_records"("customer_id");

-- CreateIndex
CREATE INDEX "idx_outbound_records_sales_order" ON "outbound_records"("sales_order_id");

-- CreateIndex
CREATE INDEX "idx_outbound_records_operator" ON "outbound_records"("operator_id");

-- CreateIndex
CREATE INDEX "idx_outbound_records_reason" ON "outbound_records"("reason");

-- CreateIndex
CREATE INDEX "idx_outbound_records_date" ON "outbound_records"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "return_orders_return_number_key" ON "return_orders"("return_number");

-- CreateIndex
CREATE INDEX "idx_return_orders_sales_order" ON "return_orders"("sales_order_id");

-- CreateIndex
CREATE INDEX "idx_return_orders_customer" ON "return_orders"("customer_id");

-- CreateIndex
CREATE INDEX "idx_return_orders_user" ON "return_orders"("user_id");

-- CreateIndex
CREATE INDEX "idx_return_orders_status" ON "return_orders"("status");

-- CreateIndex
CREATE INDEX "idx_return_orders_type" ON "return_orders"("type");

-- CreateIndex
CREATE INDEX "idx_return_orders_created" ON "return_orders"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_return_order_items_return_order" ON "return_order_items"("return_order_id");

-- CreateIndex
CREATE INDEX "idx_return_order_items_sales_order_item" ON "return_order_items"("sales_order_item_id");

-- CreateIndex
CREATE INDEX "idx_return_order_items_product" ON "return_order_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "payable_records_payable_number_key" ON "payable_records"("payable_number");

-- CreateIndex
CREATE INDEX "idx_payable_records_supplier" ON "payable_records"("supplier_id");

-- CreateIndex
CREATE INDEX "idx_payable_records_user" ON "payable_records"("user_id");

-- CreateIndex
CREATE INDEX "idx_payable_records_status" ON "payable_records"("status");

-- CreateIndex
CREATE INDEX "idx_payable_records_due_date" ON "payable_records"("due_date");

-- CreateIndex
CREATE INDEX "idx_payable_records_source_type" ON "payable_records"("source_type");

-- CreateIndex
CREATE INDEX "idx_payable_records_date" ON "payable_records"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "payment_out_records_payment_number_key" ON "payment_out_records"("payment_number");

-- CreateIndex
CREATE INDEX "idx_payment_out_records_payable" ON "payment_out_records"("payable_record_id");

-- CreateIndex
CREATE INDEX "idx_payment_out_records_supplier" ON "payment_out_records"("supplier_id");

-- CreateIndex
CREATE INDEX "idx_payment_out_records_user" ON "payment_out_records"("user_id");

-- CreateIndex
CREATE INDEX "idx_payment_out_records_status" ON "payment_out_records"("status");

-- CreateIndex
CREATE INDEX "idx_payment_out_records_date" ON "payment_out_records"("payment_date" DESC);

-- CreateIndex
CREATE INDEX "idx_payment_out_records_method" ON "payment_out_records"("paymentMethod");

-- CreateIndex
CREATE INDEX "idx_inventory_location" ON "inventory"("location");

-- CreateIndex
CREATE INDEX "idx_inventory_updated_at" ON "inventory"("updated_at");
