'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  ChevronsUpDown,
  Package,
  Search,
} from 'lucide-react';
import * as React from 'react';

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
import { queryKeys } from '@/lib/queryKeys';
import type { Product } from '@/lib/types/product';
import { cn } from '@/lib/utils';

// 产品API查询函数
async function getProducts(): Promise<{ data: Product[] }> {
  const response = await fetch('/api/products?limit=1000&status=active');
  if (!response.ok) {
    throw new Error('获取产品列表失败');
  }
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '获取产品列表失败');
  }
  return result;
}

// 库存查询函数（暂未使用，为将来扩展预留）
async function _getInventory(
  productId: string
): Promise<{ quantity: number; available: number }> {
  const response = await fetch(`/api/inventory/check?productId=${productId}`);
  if (!response.ok) {
    return { quantity: 0, available: 0 };
  }
  const result = await response.json();
  return result.data || { quantity: 0, available: 0 };
}

interface TransferProductSelectorProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onProductChange?: (product: Product | null) => void;
  allowZeroStock?: boolean; // 是否允许选择零库存产品
  showStockInfo?: boolean; // 是否显示库存信息
}

/**
 * 调货销售专用产品选择器
 * 支持选择零库存产品，显示库存状态
 */
export function TransferProductSelector({
  value,
  onValueChange,
  placeholder = '搜索并选择产品',
  disabled = false,
  className,
  onProductChange,
  allowZeroStock: _allowZeroStock = true,
  showStockInfo = true,
}: TransferProductSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');

  // 获取产品列表
  const { data: productsResponse, isLoading } = useQuery({
    queryKey: queryKeys.products.list({ status: 'active' }),
    queryFn: getProducts,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });

  const products = productsResponse?.data || [];
  const selectedProduct = products.find(product => product.id === value);

  // 过滤产品列表
  const filteredProducts = React.useMemo(() => {
    if (!searchValue) {
      return products;
    }

    const search = searchValue.toLowerCase();
    return products.filter(
      product =>
        product.name.toLowerCase().includes(search) ||
        product.code.toLowerCase().includes(search) ||
        (product.specification &&
          product.specification.toLowerCase().includes(search))
    );
  }, [products, searchValue]);

  // 处理产品选择
  const handleSelect = (productId: string) => {
    const product = products.find(p => p.id === productId);
    onValueChange?.(productId);
    onProductChange?.(product || null);
    setOpen(false);
    setSearchValue('');
  };

  // 清除选择
  const handleClear = () => {
    onValueChange?.('');
    onProductChange?.(null);
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
          {selectedProduct ? (
            <div className="flex items-center gap-2 truncate">
              <Package className="text-muted-foreground h-4 w-4 shrink-0" />
              <div className="flex flex-col items-start truncate">
                <span className="truncate font-medium">
                  {selectedProduct.name}
                </span>
                <span className="text-muted-foreground text-xs">
                  {selectedProduct.code}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground flex items-center gap-2">
              <Search className="h-4 w-4" />
              <span>{placeholder}</span>
            </div>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="搜索产品名称、编码或规格..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? (
                '加载中...'
              ) : (
                <div className="py-6 text-center">
                  <div className="text-muted-foreground text-sm">
                    未找到相关产品
                  </div>
                </div>
              )}
            </CommandEmpty>
            <CommandGroup>
              {/* 清除选择选项 */}
              {value && (
                <CommandItem
                  onSelect={handleClear}
                  className="text-muted-foreground flex items-center gap-3 p-3"
                >
                  <div className="h-4 w-4" />
                  <div className="font-medium">清除选择</div>
                </CommandItem>
              )}

              {filteredProducts.map(product => {
                const isSelected = value === product.id;

                return (
                  <CommandItem
                    key={product.id}
                    value={`${product.name} ${product.code} ${product.specification || ''}`}
                    onSelect={() => handleSelect(product.id)}
                    className="flex items-center gap-3 p-3"
                  >
                    <Check
                      className={cn(
                        'h-4 w-4',
                        isSelected ? 'opacity-100' : 'opacity-0'
                      )}
                    />

                    <div className="flex-1 space-y-1">
                      {/* 产品名称和编码 */}
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{product.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {product.code}
                        </Badge>
                      </div>

                      {/* 产品规格 */}
                      {product.specification && (
                        <div className="text-muted-foreground text-xs">
                          规格：{product.specification}
                        </div>
                      )}

                      {/* 价格信息 */}
                      <div className="text-muted-foreground text-xs">
                        价格：¥
                        {'price' in product && typeof product.price === 'number'
                          ? product.price.toFixed(2)
                          : '0.00'}
                      </div>

                      {/* 库存状态提示（调货销售特有） */}
                      {showStockInfo && (
                        <div className="flex items-center gap-1 text-xs">
                          <AlertTriangle className="h-3 w-3 text-amber-500" />
                          <span className="text-amber-600">
                            调货销售：可选择零库存产品
                          </span>
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
