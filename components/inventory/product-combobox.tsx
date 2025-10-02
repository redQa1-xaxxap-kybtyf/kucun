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
  const handleSearchChange = React.useCallback((query: string) => {
    // 清除之前的定时器
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // 设置新的定时器，防抖处理
    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(query);
    }, 300);
  }, []);

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
          <div className="group rounded-md border border-input px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <div className="flex flex-wrap gap-1">
              {selectedProduct && (
                <div className="flex items-center gap-1 rounded-sm bg-secondary px-2 py-0.5">
                  <span className="text-xs">{selectedProduct.label}</span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="ml-1 rounded-sm hover:bg-secondary-foreground/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}
              <CommandInput
                placeholder={selectedProduct ? '' : placeholder}
                onValueChange={handleSearchChange}
                onFocus={() => setOpen(true)}
                disabled={disabled}
                className="ml-2 flex-1 bg-transparent outline-hidden placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="relative mt-2">
            {open && (
              <div className="absolute top-0 z-10 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-hidden animate-in">
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
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            value === product.value
                              ? 'opacity-100'
                              : 'opacity-0'
                          )}
                        />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{product.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {product.code}
                            </span>
                          </div>
                          {product.specification && (
                            <span className="text-xs text-muted-foreground">
                              {product.specification}
                            </span>
                          )}
                          {product.currentStock !== undefined && (
                            <span className="text-xs text-muted-foreground">
                              库存: {product.currentStock}片
                            </span>
                          )}
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
