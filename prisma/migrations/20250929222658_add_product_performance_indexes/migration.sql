-- CreateIndex
CREATE INDEX "idx_products_status_created" ON "products"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_products_status_name" ON "products"("status", "name");
