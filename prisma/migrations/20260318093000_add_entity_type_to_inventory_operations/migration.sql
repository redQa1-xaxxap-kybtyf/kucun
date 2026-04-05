SET @db_name = DATABASE();

SET @inventory_operation_has_entity_type = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'inventory_operations'
    AND COLUMN_NAME = 'entity_type'
);

SET @inventory_operation_add_entity_type_sql = IF(
  @inventory_operation_has_entity_type = 0,
  'ALTER TABLE `inventory_operations`
     ADD COLUMN `entity_type` VARCHAR(64) NOT NULL DEFAULT ''product'' AFTER `operation_type`',
  'SELECT 1'
);

PREPARE inventory_operation_add_entity_type_stmt
FROM @inventory_operation_add_entity_type_sql;
EXECUTE inventory_operation_add_entity_type_stmt;
DEALLOCATE PREPARE inventory_operation_add_entity_type_stmt;

SET @inventory_operation_has_entity_index = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'inventory_operations'
    AND INDEX_NAME = 'idx_operation_entity'
);

SET @inventory_operation_add_entity_index_sql = IF(
  @inventory_operation_has_entity_index = 0,
  'CREATE INDEX `idx_operation_entity`
     ON `inventory_operations`(`entity_type`, `product_id`)',
  'SELECT 1'
);

PREPARE inventory_operation_add_entity_index_stmt
FROM @inventory_operation_add_entity_index_sql;
EXECUTE inventory_operation_add_entity_index_stmt;
DEALLOCATE PREPARE inventory_operation_add_entity_index_stmt;
