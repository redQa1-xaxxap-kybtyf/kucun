import { redirect } from 'next/navigation';

/**
 * 财务报表索引页
 *
 * 访问 /finance/reports 时自动跳转到当前月份的月度报表，
 * 避免出现 404 / _not-found。
 */
export default function FinanceReportsIndexPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  redirect(`/finance/reports/monthly?year=${year}&month=${month}`);
}
