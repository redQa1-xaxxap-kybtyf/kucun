'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

const ExpenseForm = dynamic(
  () =>
    import('@/components/finance/expenses/expense-form').then(
      mod => mod.ExpenseForm
    ),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
        表单加载中...
      </div>
    ),
  }
);

/**
 * 费用记录创建客户端组件
 * 处理费用记录创建成功后的提示和跳转
 */
export function ExpenseCreateClient() {
  const router = useRouter();

  const handleSuccess = () => {
    // 跳转到费用记录列表页
    router.push('/finance/expenses');
  };

  const handleCancel = () => {
    // 返回费用记录列表页
    router.push('/finance/expenses');
  };

  return (
    <ExpenseForm
      mode="create"
      onSuccess={handleSuccess}
      onCancel={handleCancel}
    />
  );
}
