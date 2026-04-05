ALTER TABLE `payment_out_records`
  ADD COLUMN `actual_payment_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0 AFTER `payment_amount`,
  ADD COLUMN `rounding_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0 AFTER `actual_payment_amount`;

UPDATE `payment_out_records`
SET
  `actual_payment_amount` = `payment_amount`,
  `rounding_amount` = 0;
