'use client';

import { Check, ChevronsUpDown, X } from 'lucide-react';
import React from 'react';

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
      // 从 value 中提取产品ID（格式：CODE-ID）
      const productId = commandValue.split('-').slice(1).join('-');
      const selectedProductItem = products.find(p => p.value === productId);

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
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            {selectedProduct ? (
              <div className="flex min-w-0 flex-1 items-center gap-2 truncate">
                <span className="truncate">
                  {selectedProduct.label}
                  {selectedProduct.specification && (
                    <span className="ml-2 text-muted-foreground">
                      {selectedProduct.specification}
                    </span>
                  )}
                </span>
              </div>
            ) : (
              <span className="truncate text-muted-foreground">
                {placeholder}
              </span>
            )}
            <div className="ml-2 flex shrink-0 items-center gap-1">
              {selectedProduct && !disabled && (
                <X
                  className="h-4 w-4 opacity-50 hover:opacity-100"
                  onClick={handleClear}
                />
              )}
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={placeholder}
              onValueChange={handleSearchChange}
            />
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
                        value === product.value ? 'opacity-100' : 'opacity-0'
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
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
