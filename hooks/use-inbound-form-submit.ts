'use client';

import { useRouter } from 'next/navigation';

import { useToast } from '@/components/ui/use-toast';
import type { useCreateInboundRecord } from '@/lib/api/inbound';
import { type InboundFormData } from '@/lib/types/inbound';

interface UseInboundFormSubmitProps {
  createMutation: ReturnType<typeof useCreateInboundRecord>;
  setIsSubmitting: (value: boolean) => void;
  onSuccess?: () => void;
}

export function useInboundFormSubmit({
  createMutation,
  setIsSubmitting,
  onSuccess,
}: UseInboundFormSubmitProps) {
  const router = useRouter();
  const { toast } = useToast();

  const onSubmit = async (data: InboundFormData) => {
    try {
      setIsSubmitting(true);

      // 构造请求数据，确保必填字段有默认值
      const requestData = {
        productId: data.productId,
        inputQuantity: data.inputQuantity,
        inputUnit: data.inputUnit,
        quantity: data.quantity,
        reason: data.reason,
        remarks: data.remarks || '',
        batchNumber: data.batchNumber || '',
        piecesPerUnit: data.piecesPerUnit,
        weight: data.weight,
      };

      await createMutation.mutateAsync(requestData);

      toast({
        title: '入库成功',
        description: `产品已成功入库 ${data.quantity} 片`,
      });

      // 调用成功回调
      if (onSuccess) {
        onSuccess();
      } else {
        // 默认跳转到入库记录页面
        router.push('/inventory/inbound');
      }
    } catch (error) {
      let errorMessage = '入库失败，请重试';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        const errorObj = error as Record<string, unknown>;
        if (typeof errorObj.message === 'string') {
          errorMessage = errorObj.message;
        }
      }

      toast({
        title: '入库失败',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    onSubmit,
    isLoading: createMutation.isPending,
  };
}
