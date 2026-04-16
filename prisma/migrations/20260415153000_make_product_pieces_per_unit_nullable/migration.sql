-- Remove fake default pieces-per-unit from product master data.
ALTER TABLE `products`
  MODIFY `pieces_per_unit` INT NULL;
