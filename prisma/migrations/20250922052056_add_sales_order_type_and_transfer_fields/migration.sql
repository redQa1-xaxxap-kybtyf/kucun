-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_sales_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "order_type" TEXT NOT NULL DEFAULT 'NORMAL',
    "supplier_id" TEXT,
    "cost_amount" REAL DEFAULT 0,
    "profit_amount" REAL DEFAULT 0,
    "total_amount" REAL NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sales_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sales_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_sales_orders" ("created_at", "customer_id", "id", "order_number", "remarks", "status", "total_amount", "updated_at", "user_id") SELECT "created_at", "customer_id", "id", "order_number", "remarks", "status", "total_amount", "updated_at", "user_id" FROM "sales_orders";
DROP TABLE "sales_orders";
ALTER TABLE "new_sales_orders" RENAME TO "sales_orders";
CREATE UNIQUE INDEX "sales_orders_order_number_key" ON "sales_orders"("order_number");
CREATE INDEX "idx_sales_orders_customer" ON "sales_orders"("customer_id");
CREATE INDEX "idx_sales_orders_user" ON "sales_orders"("user_id");
CREATE INDEX "idx_sales_orders_status" ON "sales_orders"("status");
CREATE INDEX "idx_sales_orders_order_type" ON "sales_orders"("order_type");
CREATE INDEX "idx_sales_orders_supplier" ON "sales_orders"("supplier_id");
CREATE INDEX "idx_sales_orders_date" ON "sales_orders"("created_at" DESC);
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
