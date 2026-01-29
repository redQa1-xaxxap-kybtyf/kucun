'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

import type { PayableRecordDetail } from '@/lib/types/payable';

const PayableForm = dynamic(
  () =>
    import('@/components/finance/payable-form').then(mod => mod.PayableForm),
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
 * 应付款创建客户端组件
 * 处理应付款创建成功后的提示和跳转
 */
export function PayableCreateClient() {
  const router = useRouter();

  const handleSuccess = (payable: PayableRecordDetail) => {
    // 跳转到应付款详情页
    router.push(`/finance/payables/${payable.id}`);
  };

  return <PayableForm mode="create" onSuccess={handleSuccess} />;
}
