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
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  code: string;
  name: string;
  specification?: string;
  unit: string;
  piecesPerUnit?: number;
  inventory?: {
    totalInventory: number;
    availableInventory: number;
    reservedInventory: number;
  };
}

interface EnhancedProductSelectorProps {
  products: Product[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * 增强的产品选择器组件
 * 显示详细的产品信息和库存状态
 */
export function EnhancedProductSelector({
  products,
  value,
  onValueChange,
  placeholder = '选择产品',
  disabled = false,
  className,
}: EnhancedProductSelectorProps) {
  const [open, setOpen] = React.useState(false);

  const selectedProduct = products.find(product => product.id === value);

  // 获取库存状态
  const getInventoryStatus = (product: Product) => {
    if (!product.inventory) {
      return { status: 'unknown', color: 'secondary' as const, text: '未知' };
    }

    const available = product.inventory.availableInventory || 0;

    if (available <= 0) {
      return {
        status: 'out-of-stock',
        color: 'destructive' as const,
        text: '缺货',
      };
    } else if (available <= 10) {
      return {
        status: 'low-stock',
        color: 'secondary' as const,
        text: '库存偏低',
      };
    } else {
      return {
        status: 'in-stock',
        color: 'default' as const,
        text: '库存充足',
      };
    }
  };

  // 格式化库存显示
  const formatInventory = (product: Product) => {
    if (!product.inventory) return '未知';

    const available = product.inventory.availableInventory || 0;
    return `${available}${product.unit}`;
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
                <span className="text-xs text-muted-foreground">
                  {selectedProduct.code}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Search className="h-4 w-4" />
              {placeholder}
            </div>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="搜索产品编码或名称..." />
          <CommandList>
            <CommandEmpty>未找到相关产品</CommandEmpty>
            <CommandGroup>
              {products.map(product => {
                const inventoryStatus = getInventoryStatus(product);
                const isSelected = value === product.id;

                return (
                  <CommandItem
                    key={product.id}
                    value={`${product.code} ${product.name}`}
                    onSelect={() => {
                      onValueChange?.(product.id);
                      setOpen(false);
                    }}
                    className="flex items-center gap-3 p-3"
                  >
                    <Check
                      className={cn(
                        'h-4 w-4',
                        isSelected ? 'opacity-100' : 'opacity-0'
                      )}
                    />

                    <div className="flex-1 space-y-1">
                      {/* 产品基本信息 */}
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{product.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {product.code}
                        </Badge>
                      </div>

                      {/* 产品规格 */}
                      {product.specification && (
                        <div className="text-xs text-muted-foreground">
                          规格：{product.specification}
                        </div>
                      )}

                      {/* 库存和单位信息 */}
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">库存：</span>
                          <span className="font-medium">
                            {formatInventory(product)}
                          </span>
                          <Badge
                            variant={inventoryStatus.color}
                            className="text-xs"
                          >
                            {inventoryStatus.text}
                          </Badge>
                        </div>

                        {product.piecesPerUnit && product.piecesPerUnit > 1 && (
                          <div className="text-muted-foreground">
                            每{product.unit}：{product.piecesPerUnit}片
                          </div>
                        )}
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
