'use client';

import { useRouter } from 'next/navigation';

import { ExpenseForm } from '@/components/finance/expenses/expense-form';
import type { ExpenseRecord } from '@/lib/types/expense';

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
