-- CreateIndex
CREATE INDEX "products_name_idx" ON "products"("name");

-- CreateIndex
CREATE INDEX "idx_products_status_category" ON "products"("status", "category_id");

-- CreateIndex
CREATE INDEX "products_created_at_idx" ON "products"("created_at");
