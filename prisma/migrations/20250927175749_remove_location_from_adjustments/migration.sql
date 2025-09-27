/*
  Warnings:

  - You are about to drop the column `location` on the `inventory_adjustments` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_inventory_adjustments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adjustment_number" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "batch_number" TEXT,
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
INSERT INTO "new_inventory_adjustments" ("adjust_quantity", "adjustment_number", "after_quantity", "approved_at", "approver_id", "batch_number", "before_quantity", "created_at", "id", "notes", "operator_id", "product_id", "reason", "status", "updated_at", "variant_id") SELECT "adjust_quantity", "adjustment_number", "after_quantity", "approved_at", "approver_id", "batch_number", "before_quantity", "created_at", "id", "notes", "operator_id", "product_id", "reason", "status", "updated_at", "variant_id" FROM "inventory_adjustments";
DROP TABLE "inventory_adjustments";
ALTER TABLE "new_inventory_adjustments" RENAME TO "inventory_adjustments";
CREATE UNIQUE INDEX "inventory_adjustments_adjustment_number_key" ON "inventory_adjustments"("adjustment_number");
CREATE INDEX "idx_inventory_adjustments_product" ON "inventory_adjustments"("product_id");
CREATE INDEX "idx_inventory_adjustments_variant" ON "inventory_adjustments"("variant_id");
CREATE INDEX "idx_inventory_adjustments_batch" ON "inventory_adjustments"("batch_number");
CREATE INDEX "idx_inventory_adjustments_reason" ON "inventory_adjustments"("reason");
CREATE INDEX "idx_inventory_adjustments_status" ON "inventory_adjustments"("status");
CREATE INDEX "idx_inventory_adjustments_operator" ON "inventory_adjustments"("operator_id");
CREATE INDEX "idx_inventory_adjustments_approver" ON "inventory_adjustments"("approver_id");
CREATE INDEX "idx_inventory_adjustments_date" ON "inventory_adjustments"("created_at" DESC);
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
