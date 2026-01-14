-- P0-3: StatementTransaction 幂等唯一约束
-- 目标：同一 reference_id + transaction_type 只能落 1 条分录

CREATE UNIQUE INDEX `uk_statement_transactions_reference_type`
ON `statement_transactions`(`reference_id`, `transaction_type`);

