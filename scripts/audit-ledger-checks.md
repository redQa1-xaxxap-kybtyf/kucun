# 财务/往来审计核查 SQL（只读）

用途：上线后快速验证历史数据是否存在口径/流水异常；不包含任何更新语句。

## 1) refund 方向是否统一（新口径：refund 应为 credit）

```sql
SELECT id, statement_id, reference_id, amount, direction, before_balance, after_balance, transaction_date
FROM statement_transactions
WHERE transaction_type = 'refund' AND direction <> 'credit'
ORDER BY transaction_date DESC
LIMIT 200;
```

## 2) paid_amount 是否异常（历史 bug 常见：退款导致 paid_amount > total_amount）

```sql
SELECT entity_id, entity_name, partner_role, total_amount, paid_amount, current_balance, updated_at
FROM account_statements
WHERE paid_amount > total_amount + 0.01
ORDER BY (paid_amount - total_amount) DESC
LIMIT 200;
```

## 3) completed 退货单（退款型）是否缺少 sales_return 流水

```sql
SELECT ro.id, ro.return_number, ro.customer_id, ro.refund_amount, ro.completed_at
FROM return_orders ro
LEFT JOIN statement_transactions st
  ON st.reference_id = ro.id AND st.transaction_type = 'sales_return'
WHERE ro.status = 'completed'
  AND ro.process_type = 'refund'
  AND ro.refund_amount > 0
  AND st.id IS NULL
ORDER BY ro.completed_at DESC
LIMIT 200;
```

## 4) 非 completed 退货单是否出现 sales_return 流水（不应影响余额）

```sql
SELECT ro.id, ro.return_number, ro.status, ro.process_type, st.id AS transaction_id, st.transaction_date, st.amount
FROM return_orders ro
JOIN statement_transactions st
  ON st.reference_id = ro.id AND st.transaction_type = 'sales_return'
WHERE ro.status <> 'completed'
ORDER BY st.transaction_date DESC
LIMIT 200;
```

## 5) completed 退款记录是否缺少 refund 流水

```sql
SELECT rr.id, rr.refund_number, rr.customer_id, rr.processed_amount, rr.processed_date
FROM refund_records rr
LEFT JOIN statement_transactions st
  ON st.reference_id = rr.id AND st.transaction_type = 'refund'
WHERE rr.status = 'completed'
  AND rr.processed_amount > 0
  AND st.id IS NULL
ORDER BY rr.processed_date DESC
LIMIT 200;
```

## 6) completed 退货单 completed_at 缺失（会导致期间归属漂移/无法按 completedAt 入账）

```sql
SELECT id, return_number, status, process_type, refund_amount, created_at, updated_at
FROM return_orders
WHERE status = 'completed' AND completed_at IS NULL
ORDER BY updated_at DESC
LIMIT 200;
```

## 7) 流水余额是否自洽（after_balance = before_balance ± amount）

```sql
SELECT id, statement_id, transaction_type, direction, amount, before_balance, after_balance, transaction_date
FROM statement_transactions
WHERE ROUND(
  after_balance - before_balance - (CASE WHEN direction = 'debit' THEN amount ELSE -amount END),
  2
) <> 0
ORDER BY transaction_date DESC
LIMIT 200;
```

## 8) 总账余额是否与最新一笔流水 after_balance 一致

```sql
SELECT a.entity_id,
       a.entity_name,
       a.partner_role,
       a.current_balance,
       t.after_balance AS last_after_balance,
       t.transaction_date AS last_transaction_date
FROM account_statements a
JOIN (
  SELECT st1.*
  FROM statement_transactions st1
  JOIN (
    SELECT statement_id, MAX(transaction_date) AS max_date
    FROM statement_transactions
    GROUP BY statement_id
  ) last_tx
    ON last_tx.statement_id = st1.statement_id AND last_tx.max_date = st1.transaction_date
) t
  ON t.statement_id = a.id
WHERE ROUND(a.current_balance - t.after_balance, 2) <> 0
ORDER BY ABS(a.current_balance - t.after_balance) DESC
LIMIT 200;
```

## 9) 关键余额变更是否写入 SystemLog（ledger:\*）

```sql
SELECT id, action, user_id, metadata, created_at
FROM system_logs
WHERE type = 'business_operation'
  AND action LIKE 'ledger:%'
ORDER BY created_at DESC
LIMIT 200;
```
