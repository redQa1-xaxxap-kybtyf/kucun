'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Package } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import type { BatchMatchResult } from '@/lib/types/batch';

interface BatchSelectorProps {
  /** 当前批次号 */
  value?: string;
  /** 批次号变更回调 */
  onValueChange: (batchNumber: string) => void;
  /** 产品ID */
  productId?: string;
  /** 产品编码 */
  productCode?: string;
  /** 供应商ID */
  supplierId?: string;
  /** 规格 */
  specification?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 占位符 */
  placeholder?: string;
  /** 样式类名 */
  className?: string;
}

/**
 * 批次选择器组件
 *
 * 功能:
 * 1. 查询匹配的现有批次(相同产品+相同供应商+相同规格)
 * 2. 显示现有批次列表供用户选择
 * 3. 支持手动输入新批次号
 * 4. 显示批次详情(库存数量、成本等)
 */
export function BatchSelector({
  value,
  onValueChange,
  productId,
  productCode,
  supplierId,
  specification,
  disabled = false,
  placeholder = '选择或输入批次号...',
  className,
}: BatchSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [manualInput, setManualInput] = React.useState(value || '');
  const [isManualMode, setIsManualMode] = React.useState(false);

  // 查询匹配的批次
  const { data: matchResult, isLoading } = useQuery<{
    data: BatchMatchResult;
    error: null;
  }>({
    queryKey: [
      'batches',
      'match',
      productId,
      productCode,
      supplierId,
      specification,
    ],
    queryFn: async () => {
      if (!productId || !productCode || !supplierId) {
        return {
          data: { hasMatch: false, batches: [], count: 0 },
          error: null,
        };
      }

      const params = new URLSearchParams({
        productId,
        productCode,
        supplierId,
      });

      if (specification) {
        params.append('specification', specification);
      }

      const response = await fetch(`/api/batches/match?${params.toString()}`);
      if (!response.ok) {
        throw new Error('查询批次失败');
      }

      return response.json();
    },
    enabled: !!productId && !!productCode && !!supplierId,
    staleTime: 30 * 1000, // 30秒缓存
  });

  const batches = matchResult?.data?.batches || [];
  const hasMatch = matchResult?.data?.hasMatch || false;

  // 选择现有批次
  const handleSelectBatch = React.useCallback(
    (batchNumber: string) => {
      onValueChange(batchNumber);
      setManualInput(batchNumber);
      setIsManualMode(false);
      setOpen(false);
    },
    [onValueChange]
  );

  // 手动输入批次号
  const handleManualInput = React.useCallback(() => {
    if (manualInput.trim()) {
      onValueChange(manualInput.trim());
      setIsManualMode(false);
      setOpen(false);
    }
  }, [manualInput, onValueChange]);

  // 切换到手动输入模式
  const handleSwitchToManual = React.useCallback(() => {
    setIsManualMode(true);
    setManualInput(value || '');
  }, [value]);

  // 如果没有提供必要的参数,只显示手动输入框
  if (!productId || !productCode || !supplierId) {
    return (
      <Input
        value={value || ''}
        onChange={e => onValueChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
    );
  }

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            <div className="flex items-center gap-2 truncate">
              <Package className="h-4 w-4 shrink-0" />
              {value ? (
                <span className="truncate">{value}</span>
              ) : (
                <span className="text-muted-foreground truncate">
                  {placeholder}
                </span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            {!isManualMode && (
              <>
                <CommandInput placeholder="搜索批次..." />
                <CommandList>
                  {isLoading ? (
                    <CommandEmpty>加载中...</CommandEmpty>
                  ) : hasMatch ? (
                    <>
                      <CommandGroup heading="现有批次">
                        {batches.map(batch => (
                          <CommandItem
                            key={batch.batchNumber}
                            value={batch.batchNumber}
                            onSelect={() =>
                              handleSelectBatch(batch.batchNumber)
                            }
                          >
                            <div className="flex w-full items-center justify-between">
                              <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {batch.batchNumber}
                                  </span>
                                  {value === batch.batchNumber && (
                                    <Check className="h-4 w-4" />
                                  )}
                                </div>
                                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                                  <span>库存: {batch.quantity}</span>
                                  {batch.unitCost && (
                                    <span>
                                      成本: ¥{batch.unitCost.toFixed(2)}
                                    </span>
                                  )}
                                  <span>
                                    {new Date(
                                      batch.updatedAt
                                    ).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      <Separator />
                    </>
                  ) : (
                    <CommandEmpty>
                      未找到匹配的批次
                      <br />
                      <span className="text-muted-foreground text-xs">
                        (相同产品+相同供应商+相同规格)
                      </span>
                    </CommandEmpty>
                  )}
                  <CommandGroup>
                    <CommandItem onSelect={handleSwitchToManual}>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        <span>手动输入新批次号</span>
                      </div>
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </>
            )}

            {isManualMode && (
              <div className="space-y-3 p-4">
                <div className="space-y-2">
                  <Label>输入新批次号</Label>
                  <Input
                    value={manualInput}
                    onChange={e => setManualInput(e.target.value)}
                    placeholder="例如: BATCH-2025-001"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleManualInput}
                    disabled={!manualInput.trim()}
                    className="flex-1"
                  >
                    确认
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsManualMode(false)}
                    className="flex-1"
                  >
                    取消
                  </Button>
                </div>
              </div>
            )}
          </Command>
        </PopoverContent>
      </Popover>

      {hasMatch && !isManualMode && (
        <div className="text-muted-foreground flex items-center gap-1 text-xs">
          <Badge variant="secondary" className="text-xs">
            找到 {batches.length} 个匹配批次
          </Badge>
          <span>可选择合并或创建新批次</span>
        </div>
      )}
    </div>
  );
}
