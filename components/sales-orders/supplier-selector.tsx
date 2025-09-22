'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Search, Truck } from 'lucide-react';
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
import type { Supplier } from '@/lib/types/supplier';
import { cn } from '@/lib/utils';

// 供应商API查询函数
async function getSuppliers(): Promise<{ data: Supplier[] }> {
  const response = await fetch('/api/suppliers?limit=100&status=active');
  if (!response.ok) {
    throw new Error('获取供应商列表失败');
  }
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '获取供应商列表失败');
  }
  return result;
}

interface SupplierSelectorProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onSupplierChange?: (supplier: Supplier | null) => void;
}

/**
 * 可搜索的供应商选择器组件
 * 支持按供应商名称和手机号码进行模糊搜索
 */
export function SupplierSelector({
  value,
  onValueChange,
  placeholder = '搜索并选择供应商',
  disabled = false,
  className,
  onSupplierChange,
}: SupplierSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');

  // 获取供应商列表
  const { data: suppliersResponse, isLoading } = useQuery({
    queryKey: ['suppliers', 'active'],
    queryFn: getSuppliers,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });

  const suppliers = suppliersResponse?.data || [];
  const selectedSupplier = suppliers.find(supplier => supplier.id === value);

  // 过滤供应商列表
  const filteredSuppliers = React.useMemo(() => {
    if (!searchValue) return suppliers;

    const search = searchValue.toLowerCase();
    return suppliers.filter(
      supplier =>
        supplier.name.toLowerCase().includes(search) ||
        (supplier.phone && supplier.phone.includes(search))
    );
  }, [suppliers, searchValue]);

  // 处理供应商选择
  const handleSelect = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    onValueChange?.(supplierId);
    onSupplierChange?.(supplier || null);
    setOpen(false);
    setSearchValue('');
  };

  // 清除选择
  const handleClear = () => {
    onValueChange?.('');
    onSupplierChange?.(null);
    setOpen(false);
    setSearchValue('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('h-12 w-full justify-between', className)}
          disabled={disabled || isLoading}
        >
          {selectedSupplier ? (
            <div className="flex items-center gap-2 truncate">
              <Truck className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col items-start truncate">
                <span className="truncate font-medium">
                  {selectedSupplier.name}
                </span>
                {selectedSupplier.phone && (
                  <span className="text-xs text-muted-foreground">
                    {selectedSupplier.phone}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Search className="h-4 w-4" />
              {isLoading ? '加载中...' : placeholder}
            </div>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="搜索供应商名称或手机号..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? (
                '加载中...'
              ) : (
                <div className="py-6 text-center">
                  <div className="text-sm text-muted-foreground">
                    未找到相关供应商
                  </div>
                </div>
              )}
            </CommandEmpty>
            <CommandGroup>
              {/* 清除选择选项 */}
              {value && (
                <CommandItem
                  onSelect={handleClear}
                  className="flex items-center gap-3 p-3 text-muted-foreground"
                >
                  <div className="h-4 w-4" />
                  <div className="font-medium">清除选择</div>
                </CommandItem>
              )}

              {filteredSuppliers.map(supplier => {
                const isSelected = value === supplier.id;

                return (
                  <CommandItem
                    key={supplier.id}
                    value={`${supplier.name} ${supplier.phone || ''}`}
                    onSelect={() => handleSelect(supplier.id)}
                    className="flex items-center gap-3 p-3"
                  >
                    <Check
                      className={cn(
                        'h-4 w-4',
                        isSelected ? 'opacity-100' : 'opacity-0'
                      )}
                    />

                    <div className="flex-1 space-y-1">
                      {/* 供应商名称 */}
                      <div className="font-medium">{supplier.name}</div>

                      {/* 供应商电话 */}
                      {supplier.phone && (
                        <div className="text-xs text-muted-foreground">
                          {supplier.phone}
                        </div>
                      )}

                      {/* 供应商地址 */}
                      {supplier.address && (
                        <div className="text-xs text-muted-foreground">
                          {supplier.address}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
