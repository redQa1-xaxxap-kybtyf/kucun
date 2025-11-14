'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { queryKeys } from '@/lib/queryKeys';
import type { ExpenseRelatedType } from '@/lib/types/expense';
import type { InboundRecord } from '@/lib/types/inbound';
import type { OutboundRecord } from '@/lib/types/outbound';
import type { PurchaseOrder } from '@/lib/types/purchase-order';
import type { SalesOrder } from '@/lib/types/sales-order';
import { cn } from '@/lib/utils';

interface RelatedRecordSelectorProps {
  relatedType: ExpenseRelatedType;
  value?: string | null;
  onChange: (value: string | undefined) => void;
  onRecordSelect?: (record: RelatedRecordInfo) => void;
}

interface RelatedRecordInfo {
  id: string;
  number: string;
  date?: string;
  amount?: number;
}

/**
 * 关联单据选择器组件
 * 根据关联业务类型动态显示对应的单据列表
 */
export function RelatedRecordSelector({
  relatedType,
  value,
  onChange,
  onRecordSelect,
}: RelatedRecordSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');

  // 根据关联类型获取对应的数据
  const { data, isLoading } = useQuery({
    queryKey: getQueryKey(relatedType, searchTerm),
    queryFn: () => fetchRecords(relatedType, searchTerm),
    enabled: !!relatedType && open,
    staleTime: 30 * 1000, // 30秒
  });

  const records = React.useMemo(() => {
    if (!data) return [];
    return transformRecords(relatedType, data);
  }, [data, relatedType]);

  const selectedRecord = React.useMemo(() => {
    return records.find(r => r.id === value);
  }, [records, value]);

  const handleSelect = React.useCallback(
    (recordId: string) => {
      const record = records.find(r => r.id === recordId);
      if (record) {
        onChange(recordId);
        onRecordSelect?.(record);
        setOpen(false);
      }
    },
    [records, onChange, onRecordSelect]
  );

  const placeholder = getPlaceholder(relatedType);
  const emptyText = getEmptyText(relatedType);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedRecord ? (
            <span className="truncate">{selectedRecord.number}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder={`搜索${placeholder}...`}
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-muted-foreground ml-2 text-sm">
                  加载中...
                </span>
              </div>
            ) : (
              <>
                <CommandEmpty>{emptyText}</CommandEmpty>
                <CommandGroup>
                  {records.map(record => (
                    <CommandItem
                      key={record.id}
                      value={record.id}
                      onSelect={handleSelect}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === record.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className="flex flex-1 flex-col">
                        <span className="font-medium">{record.number}</span>
                        <span className="text-muted-foreground text-xs">
                          {record.date && `日期: ${record.date}`}
                          {record.amount !== undefined &&
                            ` | 金额: ¥${record.amount.toFixed(2)}`}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// 辅助函数

function getQueryKey(
  relatedType: ExpenseRelatedType,
  searchTerm: string
): unknown[] {
  const baseParams = {
    page: 1,
    limit: 50,
    search: searchTerm || undefined,
  };

  switch (relatedType) {
    case 'inbound':
      return queryKeys.inventory.inboundsList(baseParams);
    case 'outbound':
      return queryKeys.inventory.outboundsList(baseParams);
    case 'purchase_order':
      return queryKeys.purchaseOrders.list({
        ...baseParams,
        containerNumber: searchTerm || undefined,
      });
    case 'sales_order':
      return queryKeys.salesOrders.list(baseParams);
    default:
      return ['related-records', relatedType, searchTerm];
  }
}

async function fetchRecords(
  relatedType: ExpenseRelatedType,
  searchTerm: string
): Promise<unknown> {
  const params = new URLSearchParams({
    page: '1',
    limit: '50',
    ...(searchTerm && { search: searchTerm }),
  });

  let endpoint = '';
  switch (relatedType) {
    case 'inbound':
      endpoint = '/api/inventory/inbound';
      break;
    case 'outbound':
      endpoint = '/api/inventory/outbound';
      break;
    case 'purchase_order':
      endpoint = '/api/purchase-orders';
      if (searchTerm) {
        params.delete('search');
        params.set('containerNumber', searchTerm);
      }
      break;
    case 'sales_order':
      endpoint = '/api/sales-orders';
      break;
    default:
      throw new Error(`不支持的关联类型: ${relatedType}`);
  }

  const response = await fetch(`${endpoint}?${params.toString()}`);
  if (!response.ok) {
    throw new Error('获取单据列表失败');
  }

  const result = await response.json();
  return result.data || result;
}

function transformRecords(
  relatedType: ExpenseRelatedType,
  data: unknown
): RelatedRecordInfo[] {
  if (!data) return [];

  switch (relatedType) {
    case 'inbound':
      return (data as InboundRecord[]).map(record => ({
        id: record.id,
        number: record.recordNumber,
        date: record.createdAt?.split('T')[0],
        amount: undefined,
      }));

    case 'outbound':
      return (data as OutboundRecord[]).map(record => ({
        id: record.id,
        number: record.recordNumber,
        date: record.createdAt?.split('T')[0],
        amount: undefined,
      }));

    case 'purchase_order':
      return (data as PurchaseOrder[]).map(order => ({
        id: order.id,
        number: order.containerNumber,
        date: order.orderDate?.split('T')[0],
        amount: order.totalAmount,
      }));

    case 'sales_order':
      return (data as SalesOrder[]).map(order => ({
        id: order.id,
        number: order.orderNumber,
        date: order.createdAt?.split('T')[0],
        amount: order.totalAmount,
      }));

    default:
      return [];
  }
}

function getPlaceholder(relatedType: ExpenseRelatedType): string {
  switch (relatedType) {
    case 'inbound':
      return '选择入库单';
    case 'outbound':
      return '选择出库单';
    case 'purchase_order':
      return '选择采购订单';
    case 'sales_order':
      return '选择销售订单';
    default:
      return '选择单据';
  }
}

function getEmptyText(relatedType: ExpenseRelatedType): string {
  switch (relatedType) {
    case 'inbound':
      return '未找到入库单';
    case 'outbound':
      return '未找到出库单';
    case 'purchase_order':
      return '未找到采购订单';
    case 'sales_order':
      return '未找到销售订单';
    default:
      return '未找到单据';
  }
}
