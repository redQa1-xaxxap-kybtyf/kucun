'use client';

import { useRouter } from 'next/navigation';

import type { useCreateBatchInboundRecords } from '@/lib/api/inbound';
import { useFormSubmit } from '@/lib/hooks/use-form-submit';
import type { BatchCreateInboundRequest } from '@/lib/types/inbound';

interface UseBatchInboundFormSubmitProps {
  createMutation: ReturnType<typeof useCreateBatchInboundRecords>;
  onSuccess?: () => void;
}

export function useBatchInboundFormSubmit({
  createMutation,
  onSuccess,
}: UseBatchInboundFormSubmitProps) {
  const router = useRouter();

  return useFormSubmit<BatchCreateInboundRequest>({
    onSubmit: async data => await createMutation.mutateAsync(data),
    onSuccess: () => {
      if (onSuccess) {
        onSuccess();
        return;
      }

      router.push('/inventory/inbound');
    },
    successMessage: '批量入库成功',
    errorMessage: '批量入库失败',
  });
}
