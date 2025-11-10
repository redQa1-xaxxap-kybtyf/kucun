-- Add unit_cost_with_expense to capture purchase freight allocation
ALTER TABLE `purchase_order_items`
  ADD COLUMN `unit_cost_with_expense` DOUBLE NULL AFTER `allocated_expense`;
