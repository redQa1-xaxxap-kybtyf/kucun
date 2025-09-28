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
    CONSTRAINT "refund_records_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "refund_records_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "refund_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_refund_records" ("bank_info", "created_at", "customer_id", "id", "processed_amount", "processed_date", "reason", "receipt_number", "refund_amount", "refund_date", "refund_method", "refund_number", "refund_type", "remaining_amount", "remarks", "return_order_id", "sales_order_id", "status", "updated_at", "user_id") SELECT "bank_info", "created_at", "customer_id", "id", "processed_amount", "processed_date", "reason", "receipt_number", "refund_amount", "refund_date", "refund_method", "refund_number", "refund_type", "remaining_amount", "remarks", "return_order_id", "sales_order_id", "status", "updated_at", "user_id" FROM "refund_records";
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
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
