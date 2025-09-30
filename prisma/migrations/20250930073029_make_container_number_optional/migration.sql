-- CreateTable
CREATE TABLE "customer_product_prices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customer_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "price_type" TEXT NOT NULL,
    "unit_price" REAL NOT NULL,
    "order_id" TEXT,
    "order_type" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "customer_product_prices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "customer_product_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "supplier_product_prices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplier_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "unit_price" REAL NOT NULL,
    "order_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "supplier_product_prices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "supplier_product_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_factory_shipment_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_number" TEXT NOT NULL,
    "container_number" TEXT,
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
INSERT INTO "new_factory_shipment_orders" ("arrival_date", "completion_date", "container_number", "created_at", "customer_id", "delivery_date", "deposit_amount", "id", "order_number", "paid_amount", "plan_date", "receivable_amount", "remarks", "shipment_date", "status", "total_amount", "updated_at", "user_id") SELECT "arrival_date", "completion_date", "container_number", "created_at", "customer_id", "delivery_date", "deposit_amount", "id", "order_number", "paid_amount", "plan_date", "receivable_amount", "remarks", "shipment_date", "status", "total_amount", "updated_at", "user_id" FROM "factory_shipment_orders";
DROP TABLE "factory_shipment_orders";
ALTER TABLE "new_factory_shipment_orders" RENAME TO "factory_shipment_orders";
CREATE UNIQUE INDEX "factory_shipment_orders_order_number_key" ON "factory_shipment_orders"("order_number");
CREATE INDEX "factory_shipment_orders_order_number_idx" ON "factory_shipment_orders"("order_number");
CREATE INDEX "factory_shipment_orders_container_number_idx" ON "factory_shipment_orders"("container_number");
CREATE INDEX "idx_factory_shipment_orders_customer" ON "factory_shipment_orders"("customer_id");
CREATE INDEX "idx_factory_shipment_orders_user" ON "factory_shipment_orders"("user_id");
CREATE INDEX "factory_shipment_orders_status_idx" ON "factory_shipment_orders"("status");
CREATE INDEX "idx_factory_shipment_orders_created" ON "factory_shipment_orders"("created_at" DESC);
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "idx_customer_product_price_lookup" ON "customer_product_prices"("customer_id", "product_id", "price_type");

-- CreateIndex
CREATE INDEX "idx_customer_price_history" ON "customer_product_prices"("customer_id", "price_type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_customer_product_price_product" ON "customer_product_prices"("product_id");

-- CreateIndex
CREATE INDEX "idx_supplier_product_price_lookup" ON "supplier_product_prices"("supplier_id", "product_id");

-- CreateIndex
CREATE INDEX "idx_supplier_price_history" ON "supplier_product_prices"("supplier_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_supplier_product_price_product" ON "supplier_product_prices"("product_id");
