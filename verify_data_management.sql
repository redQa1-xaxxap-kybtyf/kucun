-- verify_data_management.sql
-- 用途：在执行「设置 -> 数据管理」的 reset_trial / cleanup_test 后，核验是否“清理干净、零遗落、可验证”。
-- 说明：以下查询若返回 cnt > 0 或返回记录行，代表存在残留/异常，需要进一步检查。
-- 数据库：MySQL（与 Prisma schema 对齐）

-- ============================================================
-- 0) 系统模式 / 写入锁 / 任务状态
-- ============================================================
SELECT key, value, updated_at
FROM system_settings
WHERE `key` IN ('system_mode', 'system_write_lock');

SELECT status, COUNT(*) AS cnt
FROM data_management_tasks
GROUP BY status;

SELECT id, action, status, stage, started_at, finished_at, created_at
FROM data_management_tasks
WHERE status IN ('queued', 'running')
  AND created_at < (NOW() - INTERVAL 60 MINUTE)
ORDER BY created_at DESC
LIMIT 50;

-- ============================================================
-- 1) Production：活跃 test 数据残留（应为 0）
-- ============================================================
SELECT 'sales_orders' AS table_name, COUNT(*) AS cnt
FROM sales_orders
WHERE data_tag = 'test' AND voided_at IS NULL
UNION ALL
SELECT 'return_orders', COUNT(*)
FROM return_orders
WHERE data_tag = 'test' AND voided_at IS NULL
UNION ALL
SELECT 'payment_records', COUNT(*)
FROM payment_records
WHERE data_tag = 'test' AND voided_at IS NULL
UNION ALL
SELECT 'refund_records', COUNT(*)
FROM refund_records
WHERE data_tag = 'test' AND voided_at IS NULL
UNION ALL
SELECT 'purchase_orders', COUNT(*)
FROM purchase_orders
WHERE data_tag = 'test' AND voided_at IS NULL
UNION ALL
SELECT 'factory_shipment_orders', COUNT(*)
FROM factory_shipment_orders
WHERE data_tag = 'test' AND voided_at IS NULL
UNION ALL
SELECT 'payable_records', COUNT(*)
FROM payable_records
WHERE data_tag = 'test' AND voided_at IS NULL
UNION ALL
SELECT 'payment_out_records', COUNT(*)
FROM payment_out_records
WHERE data_tag = 'test' AND voided_at IS NULL
UNION ALL
SELECT 'expense_records', COUNT(*)
FROM expense_records
WHERE data_tag = 'test' AND voided_at IS NULL;

-- 关联表残留：预收冲抵/核销（命中表示清理不干净，或 test 数据未被正确剥离）
SELECT COUNT(*) AS cnt
FROM prepayment_usages pu
JOIN payment_records pr ON pr.id = pu.payment_record_id
JOIN sales_orders so ON so.id = pu.sales_order_id
WHERE pr.data_tag = 'test' OR so.data_tag = 'test';

-- 关联表残留：运输查询记录关联 test 发货单
SELECT COUNT(*) AS cnt
FROM shipping_queries sq
JOIN factory_shipment_orders fso ON fso.id = sq.factory_shipment_order_id
WHERE fso.data_tag = 'test';

-- ============================================================
-- 2) 往来流水孤儿检查（应为 0）
-- ============================================================
-- sales_orders
SELECT 'sales_orders' AS ref_table, COUNT(*) AS cnt
FROM statement_transactions st
LEFT JOIN sales_orders so ON so.id = st.reference_id
WHERE st.transaction_type IN ('sale', 'sale_reversal', 'order_cancellation', 'order_cancellation_reversal')
  AND so.id IS NULL
UNION ALL
-- return_orders
SELECT 'return_orders', COUNT(*)
FROM statement_transactions st
LEFT JOIN return_orders ro ON ro.id = st.reference_id
WHERE st.transaction_type IN ('sales_return', 'sales_return_reversal')
  AND ro.id IS NULL
UNION ALL
-- payment_records
SELECT 'payment_records', COUNT(*)
FROM statement_transactions st
LEFT JOIN payment_records pr ON pr.id = st.reference_id
WHERE st.transaction_type IN (
  'payment_in','payment_in_reversal',
  'prepayment_in','prepayment_in_reversal',
  'prepayment_out','prepayment_out_reversal'
)
  AND pr.id IS NULL
UNION ALL
-- refund_records
SELECT 'refund_records', COUNT(*)
FROM statement_transactions st
LEFT JOIN refund_records rr ON rr.id = st.reference_id
WHERE st.transaction_type IN ('refund', 'refund_reversal')
  AND rr.id IS NULL
UNION ALL
-- payable_records
SELECT 'payable_records', COUNT(*)
FROM statement_transactions st
LEFT JOIN payable_records pr ON pr.id = st.reference_id
WHERE st.transaction_type IN ('purchase', 'purchase_reversal')
  AND pr.id IS NULL
UNION ALL
-- payment_out_records
SELECT 'payment_out_records', COUNT(*)
FROM statement_transactions st
LEFT JOIN payment_out_records por ON por.id = st.reference_id
WHERE st.transaction_type IN ('payment_out', 'payment_out_reversal')
  AND por.id IS NULL;

-- ============================================================
-- 3) 单据缺流水（应为 0）
-- ============================================================
-- 已确认/已完成的销售单缺 sale 流水
SELECT so.id, so.order_number, so.status, so.created_at
FROM sales_orders so
LEFT JOIN statement_transactions st
  ON st.reference_id = so.id AND st.transaction_type = 'sale'
WHERE so.voided_at IS NULL
  AND so.status IN ('confirmed', 'shipped', 'completed')
  AND st.id IS NULL
ORDER BY so.created_at DESC
LIMIT 50;

-- 已完成的退货单缺 sales_return 流水
SELECT ro.id, ro.return_number, ro.status, ro.completed_at
FROM return_orders ro
LEFT JOIN statement_transactions st
  ON st.reference_id = ro.id AND st.transaction_type = 'sales_return'
WHERE ro.voided_at IS NULL
  AND ro.status = 'completed'
  AND st.id IS NULL
ORDER BY ro.created_at DESC
LIMIT 50;

-- 已确认收款缺 payment_in/prepayment_* 流水（至少其一存在）
SELECT pr.id, pr.payment_number, pr.status, pr.payment_type, pr.payment_date
FROM payment_records pr
LEFT JOIN statement_transactions st_in
  ON st_in.reference_id = pr.id AND st_in.transaction_type IN ('payment_in', 'prepayment_in', 'prepayment_out')
WHERE pr.voided_at IS NULL
  AND pr.status = 'confirmed'
  AND st_in.id IS NULL
ORDER BY pr.created_at DESC
LIMIT 50;

-- 已处理/已完成退款缺 refund 流水
SELECT rr.id, rr.refund_number, rr.status, rr.processed_date
FROM refund_records rr
LEFT JOIN statement_transactions st
  ON st.reference_id = rr.id AND st.transaction_type = 'refund'
WHERE rr.voided_at IS NULL
  AND rr.status IN ('processing', 'completed')
  AND st.id IS NULL
ORDER BY rr.created_at DESC
LIMIT 50;

-- 应付单缺 purchase 流水
SELECT pr.id, pr.payable_number, pr.status, pr.created_at
FROM payable_records pr
LEFT JOIN statement_transactions st
  ON st.reference_id = pr.id AND st.transaction_type = 'purchase'
WHERE pr.voided_at IS NULL
  AND st.id IS NULL
ORDER BY pr.created_at DESC
LIMIT 50;

-- 已确认付款缺 payment_out 流水
SELECT por.id, por.payment_number, por.status, por.payment_date
FROM payment_out_records por
LEFT JOIN statement_transactions st
  ON st.reference_id = por.id AND st.transaction_type = 'payment_out'
WHERE por.voided_at IS NULL
  AND por.status = 'confirmed'
  AND st.id IS NULL
ORDER BY por.created_at DESC
LIMIT 50;

-- ============================================================
-- 4) 台账非零 / 异常组合（按需核查）
-- ============================================================
SELECT COUNT(*) AS non_zero_statement_cnt
FROM account_statements
WHERE total_amount <> 0
   OR paid_amount <> 0
   OR pending_amount <> 0
   OR current_balance <> 0
   OR overdue_amount <> 0;

-- ============================================================
-- 5) 过期 processing 幂等锁（应为 0）
-- ============================================================
SELECT COUNT(*) AS expired_processing_cnt
FROM inventory_operations
WHERE status = 'processing'
  AND expires_at < NOW();

-- ============================================================
-- 6) Trial：产品/分类等基础资料残留（应为 0）
-- 说明：production 模式下不清空基础资料，因此本段仅在 system_mode=trial（或未设置时默认 trial）时生效。
-- ============================================================
SELECT 'products' AS table_name, COUNT(*) AS cnt
FROM products
WHERE COALESCE(
        (SELECT `value` FROM system_settings WHERE `key` = 'system_mode' LIMIT 1),
        'trial'
      ) = 'trial'
UNION ALL
SELECT 'product_variants', COUNT(*)
FROM product_variants
WHERE COALESCE(
        (SELECT `value` FROM system_settings WHERE `key` = 'system_mode' LIMIT 1),
        'trial'
      ) = 'trial'
UNION ALL
SELECT 'categories', COUNT(*)
FROM categories
WHERE COALESCE(
        (SELECT `value` FROM system_settings WHERE `key` = 'system_mode' LIMIT 1),
        'trial'
      ) = 'trial'
UNION ALL
SELECT 'temporary_products', COUNT(*)
FROM temporary_products
WHERE COALESCE(
        (SELECT `value` FROM system_settings WHERE `key` = 'system_mode' LIMIT 1),
        'trial'
      ) = 'trial'
UNION ALL
SELECT 'batch_specifications', COUNT(*)
FROM batch_specifications
WHERE COALESCE(
        (SELECT `value` FROM system_settings WHERE `key` = 'system_mode' LIMIT 1),
        'trial'
      ) = 'trial'
UNION ALL
SELECT 'fifo_consumption_ledger', COUNT(*)
FROM fifo_consumption_ledger
WHERE COALESCE(
        (SELECT `value` FROM system_settings WHERE `key` = 'system_mode' LIMIT 1),
        'trial'
      ) = 'trial';
