'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { OutboundType } from '@/lib/types/inventory';

interface OutboundFilters {
  startDate: string;
  endDate: string;
  type: OutboundType | '';
  search?: string;
}

interface OutboundRecord {
  id: string;
  recordNumber: string;
  productId: string;
  productCode: string;
  productName: string;
  productSpecification?: string;
  quantity: number;
  type: OutboundType;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

export function useOutboundRecords() {
  // 筛选状态
  const [filters, setFilters] = useState<OutboundFilters>({
    startDate: '',
    endDate: '',
    type: '',
  });

  // 获取出库记录数据
  const { data, isLoading, error } = useQuery({
    queryKey: ['outbound-records', filters],
    queryFn: async () => {
      // 构建查询参数
      const searchParams = new URLSearchParams();
      searchParams.append('page', '1');
      searchParams.append('limit', '50');

      if (filters.type) {
        searchParams.append('type', filters.type);
      }
      if (filters.startDate) {
        searchParams.append('startDate', filters.startDate);
      }
      if (filters.endDate) {
        searchParams.append('endDate', filters.endDate);
      }

      // 调用API
      const response = await fetch(
        `/api/inventory/outbound?${searchParams.toString()}`
      );

      if (!response.ok) {
        throw new Error('获取出库记录失败');
      }

      const result = await response.json();

      return {
        data: result.data as OutboundRecord[],
        pagination: result.pagination,
      };
    },
    staleTime: 5 * 60 * 1000, // 5分钟
  });

  const outboundRecords = data?.data || [];

  // 重置筛选
  const resetFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      type: '',
    });
  };

  // 更新筛选条件
  const updateFilter = (key: keyof OutboundFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  return {
    outboundRecords,
    filters,
    isLoading,
    error,
    resetFilters,
    updateFilter,
  };
}
