-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'sales',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "extended_info" TEXT,
    "parent_customer_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "customers_parent_customer_id_fkey" FOREIGN KEY ("parent_customer_id") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specification" TEXT,
    "specifications" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'piece',
    "pieces_per_unit" INTEGER NOT NULL DEFAULT 1,
    "weight" REAL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "total_amount" REAL NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sales_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sales_order_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sales_order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "color_code" TEXT,
    "production_date" TEXT,
    "quantity" REAL NOT NULL,
    "unit_price" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    CONSTRAINT "sales_order_items_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sales_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inventory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "product_id" TEXT NOT NULL,
    "color_code" TEXT,
    "production_date" DATETIME,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved_quantity" INTEGER NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "inventory_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inbound_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "record_number" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'normal_inbound',
    "product_id" TEXT NOT NULL,
    "color_code" TEXT,
    "production_date" DATETIME,
    "quantity" REAL NOT NULL,
    "remarks" TEXT,
    "user_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inbound_records_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inbound_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payment_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payment_number" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
    "payment_amount" REAL NOT NULL,
    "payment_date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "remarks" TEXT,
    "receipt_number" TEXT,
    "bank_info" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "payment_records_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payment_records_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payment_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "idx_customers_parent" ON "customers"("parent_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_code_key" ON "products"("code");

-- CreateIndex
CREATE INDEX "products_code_idx" ON "products"("code");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("status");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_order_number_key" ON "sales_orders"("order_number");

-- CreateIndex
CREATE INDEX "idx_sales_orders_customer" ON "sales_orders"("customer_id");

-- CreateIndex
CREATE INDEX "idx_sales_orders_user" ON "sales_orders"("user_id");

-- CreateIndex
CREATE INDEX "idx_sales_orders_status" ON "sales_orders"("status");

-- CreateIndex
CREATE INDEX "idx_sales_orders_date" ON "sales_orders"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_sales_order_items_order" ON "sales_order_items"("sales_order_id");

-- CreateIndex
CREATE INDEX "idx_sales_order_items_product" ON "sales_order_items"("product_id");

-- CreateIndex
CREATE INDEX "idx_sales_order_items_product_color" ON "sales_order_items"("product_id", "color_code");

-- CreateIndex
CREATE INDEX "idx_inventory_product" ON "inventory"("product_id");

-- CreateIndex
CREATE INDEX "idx_inventory_quantity" ON "inventory"("quantity");

-- CreateIndex
CREATE INDEX "idx_inventory_product_color" ON "inventory"("product_id", "color_code");

-- CreateIndex
CREATE UNIQUE INDEX "uk_inventory" ON "inventory"("product_id", "color_code", "production_date");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_records_record_number_key" ON "inbound_records"("record_number");

-- CreateIndex
CREATE INDEX "idx_inbound_records_product" ON "inbound_records"("product_id");

-- CreateIndex
CREATE INDEX "idx_inbound_records_user" ON "inbound_records"("user_id");

-- CreateIndex
CREATE INDEX "idx_inbound_records_type" ON "inbound_records"("type");

-- CreateIndex
CREATE INDEX "idx_inbound_records_date" ON "inbound_records"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "payment_records_payment_number_key" ON "payment_records"("payment_number");

-- CreateIndex
CREATE INDEX "idx_payment_records_order" ON "payment_records"("sales_order_id");

-- CreateIndex
CREATE INDEX "idx_payment_records_customer" ON "payment_records"("customer_id");

-- CreateIndex
CREATE INDEX "idx_payment_records_user" ON "payment_records"("user_id");

-- CreateIndex
CREATE INDEX "idx_payment_records_status" ON "payment_records"("status");

-- CreateIndex
CREATE INDEX "idx_payment_records_date" ON "payment_records"("payment_date" DESC);

-- CreateIndex
CREATE INDEX "idx_payment_records_method" ON "payment_records"("paymentMethod");
