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
  } | null;
}

interface SmartProductSearchProps {
  products: ProductWithInventory[];
  value?: string;
  onValueChange?: (value: string) => void;
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
    if (!searchValue) return products;

    const searchLower = searchValue.toLowerCase();
    return products.filter(
      product =>
        product.name.toLowerCase().includes(searchLower) ||
        product.code.toLowerCase().includes(searchLower) ||
        (product.specification &&
          product.specification.toLowerCase().includes(searchLower))
    );
  }, [products, searchValue]);

  // 处理产品选择
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
              <Search className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">
                {selectedProduct ? (
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{selectedProduct.name}</span>
                    {selectedProduct.specification && (
                      <span className="text-sm text-muted-foreground">
                        {selectedProduct.specification}
                      </span>
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
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="输入商品名称、编码或规格搜索..."
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              {filteredProducts.length > 0 ? (
                <CommandGroup>
                  {filteredProducts.map(product => (
                    <CommandItem
                      key={product.id}
                      value={product.id}
                      onSelect={() => handleProductSelect(product.id)}
                      className="flex items-center justify-between p-3"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <Check
                          className={cn(
                            'h-4 w-4',
                            value === product.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <Package className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">
                              {product.name}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {product.code}
                            </Badge>
                          </div>
                          {product.specification && (
                            <div className="truncate text-sm text-muted-foreground">
                              {product.specification}
                            </div>
                          )}
                        </div>
                      </div>
                      {product.inventory && (
                        <div className="flex-shrink-0 text-right">
                          <div className="text-sm font-medium">
                            库存: {product.inventory.availableInventory}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {product.unit}
                          </div>
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
