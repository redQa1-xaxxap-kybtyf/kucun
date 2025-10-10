'use client';

import { Check, ChevronsUpDown, Package, Plus, Search } from 'lucide-react';
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
import { cn } from '@/lib/utils';

import { AddTemporaryProductDialog } from './add-temporary-product-dialog';

interface ProductWithInventory {
  id: string;
  code: string;
  name: string;
  specification?: string | null;
  unit: string;
  piecesPerUnit?: number | null;
  inventory?: {
    totalInventory: number;
    availableInventory: number;
    reservedInventory: number;
    batches?: Array<{
      batchNumber: string;
      quantity: number;
    }>;
  } | null;
}

interface SmartProductSearchProps {
  products: ProductWithInventory[];
  value?: string;
  onValueChange?: (value: string) => void;
  onBatchSelect?: (productId: string, batchNumber: string) => void;
  onTemporaryProductAdd?: (productData: {
    name: string;
    specification?: string;
    weight?: number;
    unit?: string;
  }) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowTemporaryProducts?: boolean; // 是否允许添加临时产品
}

/**
 * 智能产品搜索组件
 * 支持搜索库存商品，搜索无结果时可添加临时产品
 */
export function SmartProductSearch({
  products,
  value,
  onValueChange,
  onBatchSelect,
  onTemporaryProductAdd,
  placeholder = '搜索商品',
  disabled = false,
  className,
  allowTemporaryProducts = false,
}: SmartProductSearchProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  const [showAddDialog, setShowAddDialog] = React.useState(false);

  // 获取选中的产品
  const selectedProduct = products.find(product => product.id === value);

  // 过滤产品列表
  const filteredProducts = React.useMemo(() => {
    if (!searchValue) {
      return products;
    }

    const searchLower = searchValue.toLowerCase();
    return products.filter(
      product =>
        product.name.toLowerCase().includes(searchLower) ||
        product.code.toLowerCase().includes(searchLower) ||
        (product.specification &&
          product.specification.toLowerCase().includes(searchLower))
    );
  }, [products, searchValue]);

  // 处理批次选择
  const handleBatchSelect = (
    productId: string,
    batchNumber: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发产品选择
    onBatchSelect?.(productId, batchNumber);
    setOpen(false);
    setSearchValue('');
  };

  // 处理产品选择（用于没有批次的产品）
  const handleProductSelect = (productId: string) => {
    onValueChange?.(productId);
    setOpen(false);
    setSearchValue('');
  };

  // 处理添加临时产品
  const handleAddTemporaryProduct = () => {
    setShowAddDialog(true);
    setOpen(false);
  };

  // 处理临时产品添加完成
  const handleTemporaryProductAdded = (productData: {
    name: string;
    specification?: string;
    weight?: number;
    unit?: string;
  }) => {
    onTemporaryProductAdd?.(productData);
    setShowAddDialog(false);
    setSearchValue('');
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'w-full justify-between text-left font-normal',
              !selectedProduct && 'text-muted-foreground',
              className
            )}
            disabled={disabled}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Search className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {selectedProduct ? (
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{selectedProduct.name}</span>
                    {selectedProduct.code && (
                      <Badge variant="secondary" className="text-[11px] font-mono">
                        {selectedProduct.code}
                      </Badge>
                    )}
                  </span>
                ) : (
                  placeholder
                )}
              </span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[600px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="输入商品名称、编码或规格搜索..."
              value={searchValue}
              onValueChange={setSearchValue}
              className="h-10"
            />
            <CommandList className="max-h-[400px]">
              {filteredProducts.length > 0 ? (
                <CommandGroup>
                  {filteredProducts.map(product => (
                    <CommandItem
                      key={product.id}
                      value={product.id}
                      onSelect={() => handleProductSelect(product.id)}
                      className="flex items-start justify-between gap-4 p-4"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <Check
                          className={cn(
                            'h-4 w-4 shrink-0',
                            value === product.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <Package className="text-muted-foreground h-5 w-5 shrink-0" />
                        <div className="min-w-0 flex-1 space-y-1">
                          {/* 第一行：产品名称和编码 */}
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">
                              {product.name}
                            </span>
                            <Badge variant="secondary" className="text-xs font-mono">
                              {product.code}
                            </Badge>
                          </div>

                          {/* 第二行：规格信息 */}
                          {product.specification && (
                            <div className="text-sm text-gray-600">
                              规格：{product.specification}
                            </div>
                          )}

                          {/* 第三行：批次信息（可点击选择） */}
                          {product.inventory?.batches &&
                            product.inventory.batches.length > 0 && (
                              <div className="space-y-1">
                                <div className="text-xs font-medium text-gray-600">
                                  点击批次进行选择：
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {product.inventory.batches.map((batch, idx) => (
                                    <button
                                      key={`${product.id}-${batch.batchNumber}-${idx}`}
                                      type="button"
                                      onClick={e =>
                                        handleBatchSelect(
                                          product.id,
                                          batch.batchNumber,
                                          e
                                        )
                                      }
                                      className="flex items-center gap-1.5 rounded-md border-2 border-blue-200 bg-blue-50 px-3 py-1.5 text-xs transition-all hover:border-blue-400 hover:bg-blue-100 hover:shadow-md active:scale-95"
                                    >
                                      <span className="font-mono font-semibold text-blue-700">
                                        {batch.batchNumber}
                                      </span>
                                      <span className="text-gray-400">|</span>
                                      <span className="font-medium text-green-600">
                                        {batch.quantity} 片
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                        </div>
                      </div>

                      {/* 右侧：库存信息 */}
                      {product.inventory && (
                        <div className="shrink-0 space-y-1 text-right">
                          <div className="rounded-md bg-green-50 px-3 py-1">
                            <div className="text-xs text-gray-600">可用库存</div>
                            <div className="text-lg font-bold text-green-600">
                              {product.inventory.availableInventory}
                            </div>
                            <div className="text-xs text-gray-500">片</div>
                          </div>
                          {product.inventory.totalInventory !==
                            product.inventory.availableInventory && (
                            <div className="text-xs text-gray-500">
                              总量 {product.inventory.totalInventory} 片
                            </div>
                          )}
                        </div>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : (
                <CommandEmpty className="py-6 text-center">
                  <div className="space-y-3">
                    <div className="text-muted-foreground">
                      {searchValue ? (
                        <>未找到匹配的商品 &ldquo;{searchValue}&rdquo;</>
                      ) : (
                        '请输入关键词搜索商品'
                      )}
                    </div>
                    {allowTemporaryProducts && searchValue && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAddTemporaryProduct}
                        className="mx-auto"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        添加为临时商品
                      </Button>
                    )}
                  </div>
                </CommandEmpty>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* 添加临时产品对话框 */}
      <AddTemporaryProductDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        initialName={searchValue}
        onConfirm={handleTemporaryProductAdded}
      />
    </>
  );
}
