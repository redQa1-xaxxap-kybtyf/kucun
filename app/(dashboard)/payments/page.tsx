'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

/**
 * 支付管理页面重定向
 * 将用户重定向到新的财务管理模块
 */
export default function PaymentsPage() {
  const router = useRouter();

  React.useEffect(() => {
    // 重定向到新的财务管理应收货款页面
    router.replace('/finance/receivables');
  }, [router]);

  return null; // 页面将重定向，不需要渲染内容
}
