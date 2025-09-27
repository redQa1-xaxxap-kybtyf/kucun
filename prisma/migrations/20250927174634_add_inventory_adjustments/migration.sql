/*
  Warnings:

  - You are about to drop the column `specifications` on the `products` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "batch_specifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "product_id" TEXT NOT NULL,
    "batch_number" TEXT NOT NULL,
    "pieces_per_unit" INTEGER NOT NULL DEFAULT 1,
    "weight" REAL,
    "thickness" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "batch_specifications_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inventory_adjustments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adjustment_number" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "batch_number" TEXT,
    "location" TEXT NOT NULL DEFAULT 'default',
    "before_quantity" INTEGER NOT NULL,
    "adjust_quantity" INTEGER NOT NULL,
    "after_quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "operator_id" TEXT NOT NULL,
    "approver_id" TEXT,
    "approved_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "inventory_adjustments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inventory_adjustments_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inventory_adjustments_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inventory_adjustments_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_sequences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sequence_type" TEXT NOT NULL,
    "date_key" TEXT NOT NULL,
    "current_sequence" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_inbound_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "record_number" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "batch_number" TEXT,
    "batch_specification_id" TEXT,
    "quantity" REAL NOT NULL,
    "unit_cost" REAL,
    "total_cost" REAL,
    "location" TEXT,
    "reason" TEXT NOT NULL DEFAULT 'purchase',
    "remarks" TEXT,
    "user_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "inbound_records_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inbound_records_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inbound_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inbound_records_batch_specification_id_fkey" FOREIGN KEY ("batch_specification_id") REFERENCES "batch_specifications" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_inbound_records" ("batch_number", "created_at", "id", "location", "product_id", "quantity", "reason", "record_number", "remarks", "total_cost", "unit_cost", "updated_at", "user_id", "variant_id") SELECT "batch_number", "created_at", "id", "location", "product_id", "quantity", "reason", "record_number", "remarks", "total_cost", "unit_cost", "updated_at", "user_id", "variant_id" FROM "inbound_records";
DROP TABLE "inbound_records";
ALTER TABLE "new_inbound_records" RENAME TO "inbound_records";
CREATE UNIQUE INDEX "inbound_records_record_number_key" ON "inbound_records"("record_number");
CREATE INDEX "idx_inbound_records_product" ON "inbound_records"("product_id");
CREATE INDEX "idx_inbound_records_variant" ON "inbound_records"("variant_id");
CREATE INDEX "idx_inbound_records_batch" ON "inbound_records"("batch_number");
CREATE INDEX "idx_inbound_records_batch_spec" ON "inbound_records"("batch_specification_id");
CREATE INDEX "idx_inbound_records_user" ON "inbound_records"("user_id");
CREATE INDEX "idx_inbound_records_reason" ON "inbound_records"("reason");
CREATE INDEX "idx_inbound_records_date" ON "inbound_records"("created_at" DESC);
CREATE TABLE "new_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specification" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'piece',
    "pieces_per_unit" INTEGER NOT NULL DEFAULT 1,
    "weight" REAL,
    "thickness" REAL,
    "category_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_products" ("category_id", "code", "created_at", "id", "name", "pieces_per_unit", "specification", "status", "thickness", "unit", "updated_at", "weight") SELECT "category_id", "code", "created_at", "id", "name", "pieces_per_unit", "specification", "status", "thickness", "unit", "updated_at", "weight" FROM "products";
DROP TABLE "products";
ALTER TABLE "new_products" RENAME TO "products";
CREATE UNIQUE INDEX "products_code_key" ON "products"("code");
CREATE INDEX "products_code_idx" ON "products"("code");
CREATE INDEX "products_name_idx" ON "products"("name");
CREATE INDEX "idx_products_category" ON "products"("category_id");
CREATE INDEX "products_status_idx" ON "products"("status");
CREATE INDEX "idx_products_status_category" ON "products"("status", "category_id");
CREATE INDEX "products_created_at_idx" ON "products"("created_at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "idx_batch_spec_product" ON "batch_specifications"("product_id");

-- CreateIndex
CREATE INDEX "idx_batch_spec_batch" ON "batch_specifications"("batch_number");

-- CreateIndex
CREATE INDEX "idx_batch_spec_pieces" ON "batch_specifications"("pieces_per_unit");

-- CreateIndex
CREATE UNIQUE INDEX "uk_batch_spec_product_batch" ON "batch_specifications"("product_id", "batch_number");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_adjustments_adjustment_number_key" ON "inventory_adjustments"("adjustment_number");

-- CreateIndex
CREATE INDEX "idx_inventory_adjustments_product" ON "inventory_adjustments"("product_id");

-- CreateIndex
CREATE INDEX "idx_inventory_adjustments_variant" ON "inventory_adjustments"("variant_id");

-- CreateIndex
CREATE INDEX "idx_inventory_adjustments_batch" ON "inventory_adjustments"("batch_number");

-- CreateIndex
CREATE INDEX "idx_inventory_adjustments_location" ON "inventory_adjustments"("location");

-- CreateIndex
CREATE INDEX "idx_inventory_adjustments_reason" ON "inventory_adjustments"("reason");

-- CreateIndex
CREATE INDEX "idx_inventory_adjustments_status" ON "inventory_adjustments"("status");

-- CreateIndex
CREATE INDEX "idx_inventory_adjustments_operator" ON "inventory_adjustments"("operator_id");

-- CreateIndex
CREATE INDEX "idx_inventory_adjustments_approver" ON "inventory_adjustments"("approver_id");

-- CreateIndex
CREATE INDEX "idx_inventory_adjustments_date" ON "inventory_adjustments"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_order_sequences_type" ON "order_sequences"("sequence_type");

-- CreateIndex
CREATE INDEX "idx_order_sequences_date" ON "order_sequences"("date_key");

-- CreateIndex
CREATE UNIQUE INDEX "uk_order_sequences_type_date" ON "order_sequences"("sequence_type", "date_key");
