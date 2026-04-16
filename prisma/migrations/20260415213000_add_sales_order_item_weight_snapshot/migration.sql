ALTER TABLE `sales_order_items`
    ADD COLUMN `weight_snapshot` DECIMAL(18, 6) NULL AFTER `pieces_per_unit`;

UPDATE `sales_order_items` AS `soi`
LEFT JOIN `batch_specifications` AS `bs_exact`
    ON `bs_exact`.`product_id` = `soi`.`product_id`
   AND `bs_exact`.`batch_number` = `soi`.`batch_number`
   AND `bs_exact`.`variant_key` = COALESCE(`soi`.`variant_id`, '')
LEFT JOIN `batch_specifications` AS `bs_fallback`
    ON `bs_fallback`.`product_id` = `soi`.`product_id`
   AND `bs_fallback`.`batch_number` = `soi`.`batch_number`
   AND `bs_fallback`.`variant_key` = ''
LEFT JOIN `products` AS `p`
    ON `p`.`id` = `soi`.`product_id`
SET
    `soi`.`pieces_per_unit` = COALESCE(
        `soi`.`pieces_per_unit`,
        `bs_exact`.`pieces_per_unit`,
        `bs_fallback`.`pieces_per_unit`,
        `p`.`pieces_per_unit`
    ),
    `soi`.`weight_snapshot` = COALESCE(
        `soi`.`weight_snapshot`,
        `bs_exact`.`weight`,
        `bs_fallback`.`weight`,
        `p`.`weight`
    )
WHERE `soi`.`product_id` IS NOT NULL
  AND (`soi`.`is_manual_product` IS NULL OR `soi`.`is_manual_product` = 0)
  AND (`soi`.`pieces_per_unit` IS NULL OR `soi`.`weight_snapshot` IS NULL);
