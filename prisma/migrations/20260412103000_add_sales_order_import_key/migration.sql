ALTER TABLE `sales_orders`
  ADD COLUMN `import_key` VARCHAR(191) NULL AFTER `remarks`;

UPDATE `sales_orders` AS `target`
INNER JOIN (
  SELECT
    `id`,
    SUBSTRING_INDEX(
      SUBSTRING_INDEX(`remarks`, '【销售导入:', -1),
      '】',
      1
    ) AS `legacy_import_key`
  FROM `sales_orders`
  WHERE `remarks` LIKE '%【销售导入:%】%'
) AS `legacy`
  ON `legacy`.`id` = `target`.`id`
INNER JOIN (
  SELECT `legacy_import_key`
  FROM (
    SELECT
      SUBSTRING_INDEX(
        SUBSTRING_INDEX(`remarks`, '【销售导入:', -1),
        '】',
        1
      ) AS `legacy_import_key`
    FROM `sales_orders`
    WHERE `remarks` LIKE '%【销售导入:%】%'
  ) AS `keys`
  GROUP BY `legacy_import_key`
  HAVING COUNT(*) = 1
) AS `unique_keys`
  ON `unique_keys`.`legacy_import_key` = `legacy`.`legacy_import_key`
SET `target`.`import_key` = `legacy`.`legacy_import_key`
WHERE `target`.`import_key` IS NULL;

CREATE UNIQUE INDEX `uk_sales_orders_import_key`
  ON `sales_orders`(`import_key`);
