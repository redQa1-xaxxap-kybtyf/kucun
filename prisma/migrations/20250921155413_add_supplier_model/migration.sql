/*
  Warnings:

  - You are about to drop the column `color_code` on the `inbound_records` table. All the data in the column will be lost.
  - You are about to drop the column `production_date` on the `inbound_records` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `inbound_records` table. All the data in the column will be lost.
  - Added the required column `updated_at` to the `inbound_records` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "parent_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "product_id" TEXT NOT NULL,
    "color_code" TEXT NOT NULL,
    "color_name" TEXT,
    "color_value" TEXT,
    "sku" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_inbound_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "record_number" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'purchase',
    "remarks" TEXT,
    "user_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "inbound_records_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inbound_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_inbound_records" ("created_at", "id", "product_id", "quantity", "record_number", "remarks", "user_id") SELECT "created_at", "id", "product_id", "quantity", "record_number", "remarks", "user_id" FROM "inbound_records";
DROP TABLE "inbound_records";
ALTER TABLE "new_inbound_records" RENAME TO "inbound_records";
CREATE UNIQUE INDEX "inbound_records_record_number_key" ON "inbound_records"("record_number");
CREATE INDEX "idx_inbound_records_product" ON "inbound_records"("product_id");
CREATE INDEX "idx_inbound_records_user" ON "inbound_records"("user_id");
CREATE INDEX "idx_inbound_records_reason" ON "inbound_records"("reason");
CREATE INDEX "idx_inbound_records_date" ON "inbound_records"("created_at" DESC);
CREATE TABLE "new_inventory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "color_code" TEXT,
    "production_date" DATETIME,
    "batch_number" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved_quantity" INTEGER NOT NULL DEFAULT 0,
    "unit_cost" REAL,
    "location" TEXT,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "inventory_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inventory_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_inventory" ("color_code", "id", "product_id", "production_date", "quantity", "reserved_quantity", "updated_at") SELECT "color_code", "id", "product_id", "production_date", "quantity", "reserved_quantity", "updated_at" FROM "inventory";
DROP TABLE "inventory";
ALTER TABLE "new_inventory" RENAME TO "inventory";
CREATE INDEX "idx_inventory_product" ON "inventory"("product_id");
CREATE INDEX "idx_inventory_variant" ON "inventory"("variant_id");
CREATE INDEX "idx_inventory_quantity" ON "inventory"("quantity");
CREATE INDEX "idx_inventory_production_date" ON "inventory"("production_date");
CREATE INDEX "idx_inventory_batch" ON "inventory"("batch_number");
CREATE UNIQUE INDEX "uk_inventory_variant_batch" ON "inventory"("product_id", "variant_id", "production_date", "batch_number");
CREATE TABLE "new_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specification" TEXT,
    "specifications" TEXT,
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
INSERT INTO "new_products" ("code", "created_at", "id", "name", "pieces_per_unit", "specification", "specifications", "status", "unit", "updated_at", "weight") SELECT "code", "created_at", "id", "name", "pieces_per_unit", "specification", "specifications", "status", "unit", "updated_at", "weight" FROM "products";
DROP TABLE "products";
ALTER TABLE "new_products" RENAME TO "products";
CREATE UNIQUE INDEX "products_code_key" ON "products"("code");
CREATE INDEX "products_code_idx" ON "products"("code");
CREATE INDEX "idx_products_category" ON "products"("category_id");
CREATE INDEX "products_status_idx" ON "products"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "suppliers_name_idx" ON "suppliers"("name");

-- CreateIndex
CREATE INDEX "suppliers_phone_idx" ON "suppliers"("phone");

-- CreateIndex
CREATE INDEX "suppliers_status_idx" ON "suppliers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "categories_code_key" ON "categories"("code");

-- CreateIndex
CREATE INDEX "categories_name_idx" ON "categories"("name");

-- CreateIndex
CREATE INDEX "categories_code_idx" ON "categories"("code");

-- CreateIndex
CREATE INDEX "idx_categories_parent" ON "categories"("parent_id");

-- CreateIndex
CREATE INDEX "categories_status_idx" ON "categories"("status");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

-- CreateIndex
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");

-- CreateIndex
CREATE INDEX "product_variants_color_code_idx" ON "product_variants"("color_code");

-- CreateIndex
CREATE INDEX "product_variants_sku_idx" ON "product_variants"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "uk_product_color" ON "product_variants"("product_id", "color_code");
