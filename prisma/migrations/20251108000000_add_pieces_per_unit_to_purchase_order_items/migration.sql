-- AlterTable
ALTER TABLE `purchase_order_items`
  ADD COLUMN `pieces_per_unit` INTEGER NULL AFTER `weight`;
