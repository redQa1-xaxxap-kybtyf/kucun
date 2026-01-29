'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

import type { ExpenseRecord } from '@/lib/types/expense';

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

interface ExpenseEditClientProps {
  expense: ExpenseRecord;
}

export function ExpenseEditClient({ expense }: ExpenseEditClientProps) {
  const router = useRouter();

  const handleSuccess = () => {
    router.push(`/finance/expenses/${expense.id}`);
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <ExpenseForm
      mode="edit"
      expenseId={expense.id}
      initialData={expense}
      onSuccess={handleSuccess}
      onCancel={handleCancel}
    />
  );
}
