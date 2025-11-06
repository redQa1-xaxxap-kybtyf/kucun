'use client';

import { useRouter } from 'next/navigation';

import { ExpenseForm } from '@/components/finance/expenses/expense-form';

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
