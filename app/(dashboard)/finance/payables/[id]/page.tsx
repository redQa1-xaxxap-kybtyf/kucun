'use client';

import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';

import { ContentLoading } from '@/components/common/loading';
import { ErrorMessage } from '@/components/ui/error-message';
import { payablesApi } from '@/lib/api/payables';
import { queryKeys } from '@/lib/queryKeys';
import { getErrorMessage } from '@/lib/utils/error-handler';

const PayableDetailClient = dynamic(
  () =>
    import('@/components/finance/payable-detail-client').then(
      mod => mod.PayableDetailClient
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[680px] w-full animate-pulse rounded-xl bg-slate-100" />
    ),
  }
);

/**
 * 应付款详情页面
 * 遵循 Next.js 15.4 App Router 架构和全局约定规范
 */
export default function PayableDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  // 使用 React Query 获取应付款详情
  const {
    data: payable,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.payables.detail(id),
    queryFn: () => payablesApi.getPayableRecord(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return <ContentLoading />;
  }

  if (error) {
    return (
      <ErrorMessage
        title="加载失败"
        message={getErrorMessage(error)}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!payable) {
    return (
      <ErrorMessage
        title="应付款不存在"
        message="未找到指定的应付款记录"
        onRetry={() => router.push('/finance/payables')}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面头部 - 移除硬编码标题，依赖 DashboardLayoutClient 自动渲染面包屑 */}
      {/* 页面头部 - 移除硬编码标题，依赖 DashboardLayoutClient 自动渲染面包屑 */}
      {/* 标题已移至 PayableDetailClient 组件中渲染 */}

      {/* 详情内容 */}
      <PayableDetailClient payable={payable} />
    </div>
  );
}
