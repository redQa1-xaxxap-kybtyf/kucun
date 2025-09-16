# 库存管理工具 - MySQL 数据库设计文档

## 概述

本文档描述了库存管理工具的 MySQL 8.0+ 数据库设计，严格按照 TECH_ARCHITECTURE 文档规范实现。

## 技术特性

- **数据库版本**: MySQL 8.0+
- **字符集**: utf8mb4
- **排序规则**: utf8mb4_unicode_ci
- **存储引擎**: InnoDB
- **特殊功能**: JSON 字段、全文搜索、窗口函数

## 数据库表结构

### 1. 用户表 (users)

```sql
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'sales') DEFAULT 'sales',
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

### 2. 客户表 (customers)

```sql
CREATE TABLE customers (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    extended_info JSON COMMENT 'JSON格式的客户扩展信息',
    parent_customer_id VARCHAR(36) COMMENT '上级客户ID，用于层级关系',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_customer_id) REFERENCES customers(id)
);

CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_parent ON customers(parent_customer_id);
CREATE FULLTEXT INDEX idx_customers_search ON customers(name, phone, address);
-- JSON字段索引
CREATE INDEX idx_customer_json_tags ON customers((CAST(extended_info->'$.tags' AS JSON ARRAY)));
```

### 3. 产品表 (products)

```sql
CREATE TABLE products (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    specification VARCHAR(200),
    specifications JSON COMMENT 'JSON格式的详细规格信息',
    unit ENUM('piece', 'sheet', 'strip') DEFAULT 'piece',
    pieces_per_unit INT DEFAULT 1,
    weight DECIMAL(10,2),
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_products_code ON products(code);
CREATE INDEX idx_products_status ON products(status);
CREATE FULLTEXT INDEX idx_products_search ON products(name, specification);
-- JSON字段索引
CREATE INDEX idx_product_json_colors ON products((CAST(specifications->'$.colors' AS JSON ARRAY)));
CREATE INDEX idx_product_json_size ON products((specifications->>'$.size'));
```

### 4. 销售单表 (sales_orders)

```sql
CREATE TABLE sales_orders (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    status ENUM('draft', 'confirmed', 'shipped', 'completed', 'cancelled') DEFAULT 'draft',
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX idx_sales_orders_user ON sales_orders(user_id);
CREATE INDEX idx_sales_orders_status ON sales_orders(status);
CREATE INDEX idx_sales_orders_date ON sales_orders(created_at DESC);
```

### 5. 销售单明细表 (sales_order_items)

```sql
CREATE TABLE sales_order_items (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    sales_order_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(36) NOT NULL,
    color_code VARCHAR(50),
    production_date VARCHAR(20) COMMENT '生产日期，瓷砖行业特有',
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX idx_sales_order_items_order ON sales_order_items(sales_order_id);
CREATE INDEX idx_sales_order_items_product ON sales_order_items(product_id);
CREATE INDEX idx_sales_order_items_product_color ON sales_order_items(product_id, color_code);
```

### 6. 库存表 (inventory)

```sql
CREATE TABLE inventory (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    product_id VARCHAR(36) NOT NULL,
    color_code VARCHAR(50),
    production_date DATE,
    quantity INT NOT NULL DEFAULT 0,
    reserved_quantity INT NOT NULL DEFAULT 0 COMMENT '预留数量',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    UNIQUE KEY uk_inventory (product_id, color_code, production_date)
);

CREATE INDEX idx_inventory_product ON inventory(product_id);
CREATE INDEX idx_inventory_quantity ON inventory(quantity);
CREATE INDEX idx_inventory_product_color ON inventory(product_id, color_code);
CREATE INDEX idx_inventory_available ON inventory((quantity - reserved_quantity));
```

### 7. 入库记录表 (inbound_records)

```sql
CREATE TABLE inbound_records (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    record_number VARCHAR(50) UNIQUE NOT NULL,
    type ENUM('normal_inbound', 'return_inbound', 'adjust_inbound') DEFAULT 'normal_inbound',
    product_id VARCHAR(36) NOT NULL,
    color_code VARCHAR(50),
    production_date DATE,
    quantity DECIMAL(10,2) NOT NULL,
    remarks TEXT,
    user_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_inbound_records_product ON inbound_records(product_id);
CREATE INDEX idx_inbound_records_user ON inbound_records(user_id);
CREATE INDEX idx_inbound_records_type ON inbound_records(type);
CREATE INDEX idx_inbound_records_date ON inbound_records(created_at DESC);
```

## 初始化数据

```sql
-- 创建默认管理员用户
INSERT INTO users (email, name, password_hash, role) VALUES
('admin@inventory.com', '系统管理员', '$2b$10$hashedpassword', 'admin');

-- 创建示例产品（包含JSON规格）
INSERT INTO products (code, name, specification, specifications, unit, pieces_per_unit) VALUES
('TC001', '抛光砖', '800x800mm', JSON_OBJECT(
    'size', '800x800mm',
    'thickness', '10mm',
    'surface', 'polished',
    'colors', JSON_ARRAY('white', 'grey', 'black'),
    'properties', JSON_OBJECT(
        'water_absorption', '0.1%',
        'slip_resistance', 'R9',
        'frost_resistance', true
    )
), 'piece', 4);

-- 创建示例客户（包含JSON扩展信息）
INSERT INTO customers (name, phone, address, extended_info) VALUES
('建材批发商A', '13800138001', '北京市朝阳区建材市场1号', JSON_OBJECT(
    'credit_limit', 100000,
    'payment_terms', '30天',
    'preferred_delivery', JSON_OBJECT(
        'time', '09:00-17:00',
        'address_type', 'warehouse'
    ),
    'tags', JSON_ARRAY('VIP', '长期合作', '批发商')
));
```

## 数据库用户和权限

```sql
-- 创建应用数据库用户
CREATE USER IF NOT EXISTS 'inventory_app'@'%' IDENTIFIED BY 'secure_inventory_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_system.* TO 'inventory_app'@'%';
FLUSH PRIVILEGES;
```

## 性能优化配置

```sql
-- 启用MySQL 8.0性能监控
UPDATE performance_schema.setup_instruments SET ENABLED = 'YES', TIMED = 'YES'
WHERE NAME LIKE '%statement/%' OR NAME LIKE '%stage/%';

UPDATE performance_schema.setup_consumers SET ENABLED = 'YES'
WHERE NAME LIKE '%events_statements_%' OR NAME LIKE '%events_stages_%';
```

## 从 SQLite 迁移到 MySQL

当需要从开发环境的 SQLite 迁移到生产环境的 MySQL 时：

1. 更新 `.env` 文件中的 `DATABASE_URL`
2. 更新 `prisma/schema.prisma` 中的 `provider` 为 `mysql`
3. 恢复枚举类型和 MySQL 特定的数据类型
4. 运行 `npx prisma db push` 或 `npx prisma migrate dev`
5. 运行 `npm run db:seed` 初始化数据

## 备份和恢复

```bash
# 备份数据库
mysqldump -u inventory_app -p inventory_system > backup.sql

# 恢复数据库
mysql -u inventory_app -p inventory_system < backup.sql
```
