'use client';

import React from 'react';

import { useInboundRecords } from '@/lib/api/inbound';
import type { InboundQueryParams } from '@/lib/types/inbound';

export function useInboundRecordsState() {
  // 筛选状态
  const [queryParams, setQueryParams] = React.useState<InboundQueryParams>({
    page: 1,
    limit: 50,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  // 获取入库记录数据
  const { data, isLoading, error } = useInboundRecords(queryParams);
  const inboundRecords = data?.data || [];

  // 处理筛选条件变化
  const handleFilter = (
    key: keyof InboundQueryParams,
    value: string | number | boolean | undefined
  ) => {
    setQueryParams(prev => ({
      ...prev,
      [key]: value,
      page: 1, // 重置到第一页
    }));
  };

  // 重置筛选条件
  const handleResetFilters = () => {
    setQueryParams({
      page: 1,
      limit: 50,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  };

  return {
    queryParams,
    inboundRecords,
    isLoading,
    error,
    handleFilter,
    handleResetFilters,
  };
}
