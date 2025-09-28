'use client';

import { Check, ChevronDown, Package } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// UI Components
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
// API and Types
import { useProductSearch } from '@/lib/api/inbound';
import type { ProductOption } from '@/lib/types/inbound';
import { PRODUCT_UNIT_LABELS } from '@/lib/types/product';
import { cn } from '@/lib/utils';

interface ProductSelectorProps {
  value: string;
  onChange: (value: string, product?: ProductOption) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * 产品选择器组件
 * 支持搜索和选择产品，显示产品信息和当前库存
 */
export function ProductSelector({
  value,
  onChange,
  placeholder = '搜索并选择产品...',
  disabled = false,
  className,
}: ProductSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(
    null
  );
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // 搜索产品
  const {
    data: products = [],
    isLoading,
    error,
  } = useProductSearch(searchQuery);

  // 当value变化时，更新选中的产品
  useEffect(() => {
    if (value && products.length > 0) {
      const product = products.find(p => p.value === value);
      if (product) {
        setSelectedProduct(product);
      }
    } else if (!value) {
      setSelectedProduct(null);
    }
  }, [value, products]);

  // 处理搜索输入
  const handleSearchChange = (query: string) => {
    // 清除之前的定时器
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // 设置新的定时器，延迟搜索
    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(query);
    }, 300);
  };

  // 处理产品选择
  const handleSelect = (product: ProductOption) => {
    console.log('ProductSelector handleSelect called:', product);
    setSelectedProduct(product);

    // 确保 onChange 被调用
    try {
      onChange(product.value, product);
      console.log('ProductSelector onChange called with:', product.value);
    } catch (error) {
      console.error('ProductSelector onChange error:', error);
    }

    setOpen(false);
  };

  // 清除选择
  const handleClear = () => {
    setSelectedProduct(null);
    onChange('', undefined);
    setSearchQuery('');
  };

  // 渲染选中的产品
  const renderSelectedProduct = () => {
    if (!selectedProduct) {
      return <span className="text-muted-foreground">{placeholder}</span>;
    }

    return (
      <div className="flex w-full items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Package className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="truncate font-medium">{selectedProduct.label}</div>
            <div className="text-sm text-muted-foreground">
              编码: {selectedProduct.code} | 单位:{' '}
              {PRODUCT_UNIT_LABELS[
                selectedProduct.unit as keyof typeof PRODUCT_UNIT_LABELS
              ] || selectedProduct.unit}
            </div>
          </div>
        </div>
        {selectedProduct.currentStock !== undefined && (
          <Badge variant="outline" className="ml-2 flex-shrink-0">
            库存: {selectedProduct.currentStock}
          </Badge>
        )}
      </div>
    );
  };

  // 渲染产品选项
  const renderProductOption = (product: ProductOption) => (
    <div className="flex w-full items-center justify-between">
      <div className="flex min-w-0 items-center gap-2">
        <Package className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <div className="truncate font-medium">{product.label}</div>
          <div className="text-sm text-muted-foreground">
            编码: {product.code} | 单位:{' '}
            {PRODUCT_UNIT_LABELS[
              product.unit as keyof typeof PRODUCT_UNIT_LABELS
            ] || product.unit}
          </div>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        {product.currentStock !== undefined && (
          <Badge variant="outline">库存: {product.currentStock}</Badge>
        )}
        {value === product.value && <Check className="h-4 w-4 text-primary" />}
      </div>
    </div>
  );

  // 组件卸载时清理搜索定时器，避免内存泄漏
  useEffect(() => () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    }, []);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'h-auto min-h-[2.5rem] w-full justify-between p-3',
              !selectedProduct && 'text-muted-foreground',
              className
            )}
            disabled={disabled}
          >
            {renderSelectedProduct()}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="搜索产品名称或编码..."
              onValueChange={handleSearchChange}
            />
            <CommandList>
              {isLoading ? (
                <div className="space-y-2 p-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <Skeleton className="h-4 w-4 rounded" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  搜索失败，请重试
                </div>
              ) : products.length === 0 && searchQuery ? (
                <CommandEmpty>未找到相关产品</CommandEmpty>
              ) : products.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  请输入关键词搜索产品
                </div>
              ) : (
                <CommandGroup>
                  {products.map((product, index) => (
                    <CommandItem
                      key={`${product.value}-${product.code}-${index}`}
                      value={`${product.code}-${product.value}`}
                      onSelect={value => {
                        console.log('CommandItem onSelect value:', value);
                        // 从 value 中提取产品ID（格式：CODE-ID）
                        const productId = value.split('-').slice(1).join('-');
                        console.log('Extracted productId:', productId);
                        const selectedProduct = products.find(
                          p => p.value === productId
                        );
                        console.log('Found product:', selectedProduct);
                        if (selectedProduct) {
                          handleSelect(selectedProduct);
                        }
                      }}
                      className="p-3"
                    >
                      {renderProductOption(product)}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>

          {selectedProduct && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="w-full"
              >
                清除选择
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </>
  );
}
