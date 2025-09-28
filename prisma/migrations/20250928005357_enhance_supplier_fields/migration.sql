/*
  Warnings:

  - Added the required column `normalized_name` to the `suppliers` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_suppliers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "supplier_code" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "contact_person" TEXT,
    "email" TEXT,
    "tax_number" TEXT,
    "bank_name" TEXT,
    "bank_account" TEXT,
    "payment_terms" TEXT,
    "credit_limit" REAL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_suppliers" ("address", "created_at", "id", "name", "normalized_name", "phone", "status", "updated_at") SELECT "address", "created_at", "id", "name", LOWER(TRIM("name")), "phone", "status", "updated_at" FROM "suppliers";
DROP TABLE "suppliers";
ALTER TABLE "new_suppliers" RENAME TO "suppliers";
CREATE UNIQUE INDEX "suppliers_supplier_code_key" ON "suppliers"("supplier_code");
CREATE INDEX "suppliers_name_idx" ON "suppliers"("name");
CREATE INDEX "suppliers_supplier_code_idx" ON "suppliers"("supplier_code");
CREATE INDEX "suppliers_phone_idx" ON "suppliers"("phone");
CREATE INDEX "suppliers_email_idx" ON "suppliers"("email");
CREATE INDEX "suppliers_status_idx" ON "suppliers"("status");
CREATE UNIQUE INDEX "suppliers_normalized_name_key" ON "suppliers"("normalized_name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
