'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { OutboundType } from '@/lib/types/inventory';

interface OutboundFilters {
  startDate: string;
  endDate: string;
  type: OutboundType | '';
}

interface OutboundRecord {
  id: string;
  recordNumber: string;
  productId: string;
  productCode: string;
  productName: string;
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
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000));
      return {
        data: [] as OutboundRecord[],
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          totalPages: 0,
        },
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
