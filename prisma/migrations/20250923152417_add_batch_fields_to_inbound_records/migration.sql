-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_inbound_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "record_number" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "batch_number" TEXT,
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
    CONSTRAINT "inbound_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_inbound_records" ("created_at", "id", "product_id", "quantity", "reason", "record_number", "remarks", "updated_at", "user_id") SELECT "created_at", "id", "product_id", "quantity", "reason", "record_number", "remarks", "updated_at", "user_id" FROM "inbound_records";
DROP TABLE "inbound_records";
ALTER TABLE "new_inbound_records" RENAME TO "inbound_records";
CREATE UNIQUE INDEX "inbound_records_record_number_key" ON "inbound_records"("record_number");
CREATE INDEX "idx_inbound_records_product" ON "inbound_records"("product_id");
CREATE INDEX "idx_inbound_records_variant" ON "inbound_records"("variant_id");
CREATE INDEX "idx_inbound_records_batch" ON "inbound_records"("batch_number");
CREATE INDEX "idx_inbound_records_user" ON "inbound_records"("user_id");
CREATE INDEX "idx_inbound_records_reason" ON "inbound_records"("reason");
CREATE INDEX "idx_inbound_records_date" ON "inbound_records"("created_at" DESC);
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
