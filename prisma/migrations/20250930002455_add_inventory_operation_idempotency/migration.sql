-- CreateTable
CREATE TABLE "inventory_operations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "idempotency_key" TEXT NOT NULL,
    "operation_type" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "request_data" TEXT NOT NULL,
    "response_data" TEXT,
    "error_message" TEXT,
    "operator_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" DATETIME,
    "expires_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_operations_idempotency_key_key" ON "inventory_operations"("idempotency_key");

-- CreateIndex
CREATE INDEX "idx_operation_idempotency" ON "inventory_operations"("idempotency_key");

-- CreateIndex
CREATE INDEX "idx_operation_operator" ON "inventory_operations"("operator_id");

-- CreateIndex
CREATE INDEX "idx_operation_created" ON "inventory_operations"("created_at");

-- CreateIndex
CREATE INDEX "idx_operation_expires" ON "inventory_operations"("expires_at");
