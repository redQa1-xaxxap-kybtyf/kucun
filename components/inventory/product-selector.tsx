'use client';

import { useState, useEffect, useRef } from 'react';
import { Check, ChevronDown, Package, Search } from 'lucide-react';

// UI Components
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

// API and Types
import { useProductSearch } from '@/lib/api/inbound';
import type { ProductOption } from '@/lib/types/inbound';
import { cn } from '@/lib/utils';

interface ProductSelectorProps {
  value: string;
  onChange: (value: string) => void;
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
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // 搜索产品
  const { data: products = [], isLoading, error } = useProductSearch(searchQuery);

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
    setSelectedProduct(product);
    onChange(product.value);
    setOpen(false);
  };

  // 清除选择
  const handleClear = () => {
    setSelectedProduct(null);
    onChange('');
    setSearchQuery('');
  };

  // 渲染选中的产品
  const renderSelectedProduct = () => {
    if (!selectedProduct) {
      return (
        <span className="text-muted-foreground">
          {placeholder}
        </span>
      );
    }

    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2 min-w-0">
          <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <div className="font-medium truncate">
              {selectedProduct.label}
            </div>
            <div className="text-sm text-muted-foreground">
              编码: {selectedProduct.code} | 单位: {selectedProduct.unit}
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
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2 min-w-0">
        <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="min-w-0">
          <div className="font-medium truncate">
            {product.label}
          </div>
          <div className="text-sm text-muted-foreground">
            编码: {product.code} | 单位: {product.unit}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {product.currentStock !== undefined && (
          <Badge variant="outline">
            库存: {product.currentStock}
          </Badge>
        )}
        {value === product.value && (
          <Check className="h-4 w-4 text-primary" />
        )}
      </div>
    </div>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between h-auto min-h-[2.5rem] p-3',
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
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder="搜索产品名称或编码..."
              onValueChange={handleSearchChange}
            />
          </div>
          <CommandList>
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <div className="space-y-1 flex-1">
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
              <CommandEmpty>
                未找到相关产品
              </CommandEmpty>
            ) : products.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                请输入关键词搜索产品
              </div>
            ) : (
              <CommandGroup>
                {products.map((product) => (
                  <CommandItem
                    key={product.value}
                    value={product.value}
                    onSelect={() => handleSelect(product)}
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
  );
}
