'use client';

import { Check, X } from 'lucide-react';
import React from 'react';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover } from '@/components/ui/popover';
import { useProductSearch } from '@/lib/api/inbound';
import type { ProductOption } from '@/lib/types/inbound';
import { cn } from '@/lib/utils';

interface ProductComboboxProps {
  value: string;
  onChange: (value: string, product?: ProductOption) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * 产品Combobox组件
 * 支持直接输入搜索，无需先点击按钮
 * 提供更自然的用户体验
 */
export function ProductCombobox({
  value,
  onChange,
  placeholder = '搜索产品名称、编码...',
  disabled = false,
  className,
}: ProductComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedProduct, setSelectedProduct] =
    React.useState<ProductOption | null>(null);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout>();

  // 搜索产品
  const { data: products = [], isLoading } = useProductSearch(searchQuery);

  // 当value变化时，更新选中的产品
  React.useEffect(() => {
    if (value && products.length > 0) {
      const product = products.find(p => p.value === value);
      if (product) {
        setSelectedProduct(product);
      }
    } else if (!value) {
      setSelectedProduct(null);
    }
  }, [value, products]);

  // 处理搜索输入（防抖）
  const handleSearchChange = React.useCallback(
    (query: string) => {
      // 清除之前的定时器
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      // 设置新的定时器，防抖处理
      searchTimeoutRef.current = setTimeout(() => {
        setSearchQuery(query);
        // 输入时自动打开下拉，避免需要额外再点一次
        if (query && query.trim().length > 0) {
          setOpen(true);
        }
      }, 300);
    },
    [setOpen]
  );

  // 处理产品选择
  const handleSelect = React.useCallback(
    (product: ProductOption) => {
      setSelectedProduct(product);
      onChange(product.value, product);
      setOpen(false);
      setSearchQuery('');
    },
    [onChange]
  );

  // 清除选择
  const handleClear = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedProduct(null);
      onChange('', undefined);
      setSearchQuery('');
    },
    [onChange]
  );

  // 处理命令项选择
  const handleCommandSelect = React.useCallback(
    (commandValue: string) => {
      // commandValue 格式：CODE-PRODUCTID
      // 由于 CODE 可能包含连字符，我们需要找到匹配的产品
      const selectedProductItem = products.find(
        p => commandValue === `${p.code}-${p.value}`
      );

      if (selectedProductItem) {
        handleSelect(selectedProductItem);
      }
    },
    [products, handleSelect]
  );

  // 组件卸载时清理搜索定时器
  React.useEffect(
    () => () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    },
    []
  );

  return (
    <div className={cn('relative', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <Command
          shouldFilter={false}
          className="overflow-visible bg-transparent"
        >
          <div className="group border-input ring-offset-background focus-within:ring-ring rounded-md border px-3 py-1.5 text-sm focus-within:ring-1 focus-within:ring-offset-0">
            <div className="flex flex-wrap gap-1">
              {selectedProduct && (
                <div className="flex items-center gap-1 rounded bg-[hsl(var(--color-primary-light))] px-2 py-0.5">
                  <span className="text-xs font-medium text-[hsl(var(--color-primary))]">
                    {selectedProduct.label}
                  </span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="ml-1 rounded hover:bg-[hsl(var(--color-primary-light))]"
                    >
                      <X className="h-3 w-3 text-[hsl(var(--color-primary))]" />
                    </button>
                  )}
                </div>
              )}
              <CommandInput
                placeholder={selectedProduct ? '' : placeholder}
                onValueChange={handleSearchChange}
                onFocus={() => {
                  if (searchQuery.length > 0 || products.length > 0) {
                    setOpen(true);
                  }
                }}
                disabled={disabled}
                className="placeholder:text-muted-foreground ml-2 flex-1 bg-transparent outline-hidden"
              />
            </div>
          </div>
          <div className="relative mt-1">
            {open && (searchQuery.length > 0 || products.length > 0) && (
              <div className="bg-popover text-popover-foreground animate-in absolute top-0 z-10 w-full rounded-md border shadow-md outline-hidden">
                <CommandList>
                  <CommandEmpty>
                    {isLoading ? '搜索中...' : '未找到相关产品'}
                  </CommandEmpty>
                  <CommandGroup>
                    {products.map(product => (
                      <CommandItem
                        key={product.value}
                        value={`${product.code}-${product.value}`}
                        onSelect={handleCommandSelect}
                        className="py-2"
                      >
                        <Check
                          className={cn(
                            'mr-2 h-3.5 w-3.5 text-[hsl(var(--color-primary))]',
                            value === product.value
                              ? 'opacity-100'
                              : 'opacity-0'
                          )}
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-900">
                              {product.code}
                            </span>
                            <span className="text-xs font-bold text-slate-400">
                              {product.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-600">
                            {product.specification && (
                              <span>规格: {product.specification}</span>
                            )}
                            {product.currentStock !== undefined && (
                              <span className="font-medium text-emerald-600">
                                库存: {product.currentStock}片
                              </span>
                            )}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </div>
            )}
          </div>
        </Command>
      </Popover>
    </div>
  );
}
