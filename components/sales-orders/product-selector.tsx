'use client';

import { Check, ChevronsUpDown, Package, Search } from 'lucide-react';
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
import type { Product } from '@/lib/types/product';
import { cn } from '@/lib/utils';

interface ProductSelectorProps {
  products: Product[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * 产品选择器组件
 * 提供搜索、筛选和选择产品的功能
 */
export function ProductSelector({
  products,
  value,
  onValueChange,
  placeholder = '选择产品',
  disabled = false,
  className,
}: ProductSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');

  // 获取选中的产品
  const selectedProduct = products.find(product => product.id === value);

  // 过滤产品列表
  const filteredProducts = React.useMemo(() => {
    if (!searchValue) {return products;}

    const search = searchValue.toLowerCase();
    return products.filter(
      product =>
        product.name.toLowerCase().includes(search) ||
        product.code.toLowerCase().includes(search) ||
        product.specification?.toLowerCase().includes(search)
    );
  }, [products, searchValue]);

  // 处理产品选择
  const handleSelect = (productId: string) => {
    onValueChange(productId === value ? '' : productId);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between', className)}
          disabled={disabled}
        >
          {selectedProduct ? (
            <div className="flex items-center gap-2 truncate">
              <Package className="h-4 w-4 shrink-0" />
              <div className="flex flex-col items-start truncate">
                <span className="truncate font-medium">
                  {selectedProduct.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {selectedProduct.code}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>{placeholder}</span>
            </div>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="搜索产品名称、编码或规格..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>
              <div className="flex flex-col items-center gap-2 py-6">
                <Search className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  未找到匹配的产品
                </p>
              </div>
            </CommandEmpty>
            <CommandGroup>
              {filteredProducts.map(product => (
                <CommandItem
                  key={product.id}
                  value={product.id}
                  onSelect={() => handleSelect(product.id)}
                  className="flex items-center gap-3 p-3"
                >
                  <Check
                    className={cn(
                      'h-4 w-4',
                      value === product.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{product.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {product.code}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      规格: {product.specification} | 单位: {product.unit}
                      {product.piecesPerUnit && (
                        <span>
                          {' '}
                          | 每{product.unit}: {product.piecesPerUnit}片
                        </span>
                      )}
                    </div>
                    {product.inventory && (
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className={cn(
                            'font-medium',
                            product.inventory.availableQuantity > 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          )}
                        >
                          库存: {product.inventory.availableQuantity}
                          {product.unit}
                        </span>
                        {product.inventory.availableQuantity <= 10 && (
                          <Badge variant="destructive" className="text-xs">
                            库存不足
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * 产品信息显示组件
 * 用于显示选中产品的详细信息
 */
interface ProductInfoProps {
  product: Product;
  className?: string;
}

export function ProductInfo({ product, className }: ProductInfoProps) {
  return (
    <div className={cn('space-y-2 text-sm', className)}>
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{product.name}</span>
        <Badge variant="outline">{product.code}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div>
          <span className="font-medium">规格:</span> {product.specification}
        </div>
        <div>
          <span className="font-medium">单位:</span> {product.unit}
        </div>
        {product.piecesPerUnit && (
          <div className="col-span-2">
            <span className="font-medium">每{product.unit}:</span>{' '}
            {product.piecesPerUnit}片
          </div>
        )}
      </div>

      {product.inventory && (
        <div className="flex items-center gap-2 border-t pt-2">
          <span className="text-xs font-medium">库存状态:</span>
          <Badge
            variant={
              product.inventory.availableQuantity > 0
                ? 'default'
                : 'destructive'
            }
            className="text-xs"
          >
            {product.inventory.availableQuantity}
            {product.unit}
          </Badge>
          {product.inventory.availableQuantity <= 10 && (
            <Badge variant="outline" className="text-xs text-orange-600">
              库存预警
            </Badge>
          )}
        </div>
      )}

      {(product as any).tileSpecifications && (
        <div className="border-t pt-2">
          <div className="mb-1 text-xs font-medium">瓷砖规格:</div>
          <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
            {(product as any).tileSpecifications.size && (
              <div>尺寸: {(product as any).tileSpecifications.size}</div>
            )}
            {(product as any).tileSpecifications.thickness && (
              <div>厚度: {(product as any).tileSpecifications.thickness}mm</div>
            )}
            {(product as any).tileSpecifications.surface && (
              <div>表面: {(product as any).tileSpecifications.surface}</div>
            )}
            {(product as any).tileSpecifications.grade && (
              <div>等级: {(product as any).tileSpecifications.grade}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 批量产品选择器
 * 支持一次选择多个产品
 */
interface BatchProductSelectorProps {
  products: Product[];
  selectedProducts: string[];
  onSelectionChange: (productIds: string[]) => void;
  maxSelection?: number;
  disabled?: boolean;
}

export function BatchProductSelector({
  products,
  selectedProducts,
  onSelectionChange,
  maxSelection = 10,
  disabled = false,
}: BatchProductSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');

  // 过滤产品列表
  const filteredProducts = React.useMemo(() => {
    if (!searchValue) {return products;}

    const search = searchValue.toLowerCase();
    return products.filter(
      product =>
        product.name.toLowerCase().includes(search) ||
        product.code.toLowerCase().includes(search) ||
        product.specification?.toLowerCase().includes(search)
    );
  }, [products, searchValue]);

  // 处理产品选择
  const handleSelect = (productId: string) => {
    const isSelected = selectedProducts.includes(productId);

    if (isSelected) {
      // 取消选择
      onSelectionChange(selectedProducts.filter(id => id !== productId));
    } else {
      // 添加选择
      if (selectedProducts.length < maxSelection) {
        onSelectionChange([...selectedProducts, productId]);
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between"
          disabled={disabled}
        >
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span>
              {selectedProducts.length > 0
                ? `已选择 ${selectedProducts.length} 个产品`
                : '批量选择产品'}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="搜索产品..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>未找到匹配的产品</CommandEmpty>
            <CommandGroup>
              {filteredProducts.map(product => {
                const isSelected = selectedProducts.includes(product.id);
                const canSelect =
                  selectedProducts.length < maxSelection || isSelected;

                return (
                  <CommandItem
                    key={product.id}
                    value={product.id}
                    onSelect={() => canSelect && handleSelect(product.id)}
                    className={cn(
                      'flex items-center gap-3 p-3',
                      !canSelect && 'cursor-not-allowed opacity-50'
                    )}
                    disabled={!canSelect}
                  >
                    <Check
                      className={cn(
                        'h-4 w-4',
                        isSelected ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{product.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {product.code}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {product.specification}
                      </div>
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
