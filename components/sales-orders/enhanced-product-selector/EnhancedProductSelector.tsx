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
    totalQuantity: number;
    availableQuantity: number;
    reservedQuantity: number;
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

type InventoryStatus =
  | { status: 'unknown'; color: 'secondary'; text: string }
  | { status: 'out-of-stock'; color: 'destructive'; text: string }
  | { status: 'low-stock'; color: 'secondary'; text: string }
  | { status: 'in-stock'; color: 'default'; text: string };

const UNIT_MAPPING: Record<string, string> = {
  piece: '件',
  pieces: '件',
  box: '箱',
  boxes: '箱',
  pack: '包',
  packs: '包',
  set: '套',
  sets: '套',
  unit: '个',
  units: '个',
  kg: '公斤',
  g: '克',
  m: '米',
  cm: '厘米',
  mm: '毫米',
  m2: '平方米',
  m3: '立方米',
  l: '升',
  ml: '毫升',
};

const INVENTORY_TEXT_CLASS: Record<InventoryStatus['status'], string> = {
  unknown: '',
  'out-of-stock': 'text-red-600',
  'low-stock': 'text-orange-600',
  'in-stock': 'text-green-600',
};

const INVENTORY_BADGE_CLASS: Partial<
  Record<InventoryStatus['status'], string>
> = {
  'out-of-stock': 'border-red-200 bg-red-100 text-red-800',
  'low-stock': 'border-orange-200 bg-orange-100 text-orange-800',
};

export function EnhancedProductSelector({
  products,
  value,
  onValueChange,
  placeholder = '选择产品',
  disabled = false,
  className,
}: EnhancedProductSelectorProps) {
  const [open, setOpen] = React.useState(false);

  const selectedProduct = React.useMemo(
    () => products.find(product => product.id === value),
    [products, value]
  );

  const handleSelect = React.useCallback(
    (productId: string) => {
      onValueChange?.(productId);
      setOpen(false);
    },
    [onValueChange]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <SelectorTrigger
          selectedProduct={selectedProduct}
          placeholder={placeholder}
          disabled={disabled}
          className={className}
        />
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <ProductOptionList
          products={products}
          value={value}
          onSelect={handleSelect}
        />
      </PopoverContent>
    </Popover>
  );
}

interface SelectorTriggerProps {
  selectedProduct?: Product;
  placeholder: string;
  disabled: boolean;
  className?: string;
}

function SelectorTrigger({
  selectedProduct,
  placeholder,
  disabled,
  className,
}: SelectorTriggerProps) {
  return (
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={Boolean(selectedProduct)}
      className={cn('w-full justify-between', className)}
      disabled={disabled}
    >
      {selectedProduct ? (
        <SelectedProductSummary product={selectedProduct} />
      ) : (
        <PlaceholderContent placeholder={placeholder} />
      )}
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  );
}

function SelectedProductSummary({ product }: { product: Product }) {
  return (
    <div className="flex items-center gap-2 truncate">
      <Package className="h-4 w-4 shrink-0" />
      <div className="flex flex-col items-start truncate">
        <span className="truncate font-medium">{product.name}</span>
        <span className="text-muted-foreground text-xs">{product.code}</span>
      </div>
    </div>
  );
}

function PlaceholderContent({ placeholder }: { placeholder: string }) {
  return (
    <div className="text-muted-foreground flex items-center gap-2">
      <Search className="h-4 w-4" />
      {placeholder}
    </div>
  );
}

interface ProductOptionListProps {
  products: Product[];
  value?: string;
  onSelect: (productId: string) => void;
}

function ProductOptionList({
  products,
  value,
  onSelect,
}: ProductOptionListProps) {
  return (
    <Command>
      <CommandInput placeholder="搜索产品编码或名称..." />
      <CommandList>
        <CommandEmpty>未找到相关产品</CommandEmpty>
        <CommandGroup>
          {products.map(product => (
            <ProductOptionItem
              key={product.id}
              product={product}
              isSelected={value === product.id}
              onSelect={() => onSelect(product.id)}
            />
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

interface ProductOptionItemProps {
  product: Product;
  isSelected: boolean;
  onSelect: () => void;
}

function ProductOptionItem({
  product,
  isSelected,
  onSelect,
}: ProductOptionItemProps) {
  const inventoryStatus = getInventoryStatus(product);
  const displayUnit =
    UNIT_MAPPING[product.unit?.toLowerCase?.() ?? ''] || product.unit;
  const showPieces = product.piecesPerUnit && product.piecesPerUnit > 1;

  return (
    <CommandItem
      value={`${product.code} ${product.name}`}
      onSelect={onSelect}
      className="flex items-center gap-3 p-3"
    >
      <Check
        className={cn('h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')}
      />
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{product.name}</span>
          <Badge variant="outline" className="text-xs">
            {product.code}
          </Badge>
        </div>

        {product.specification && (
          <div className="text-muted-foreground text-xs">
            规格：{product.specification}
          </div>
        )}

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">库存：</span>
              <span
                className={cn(
                  'font-medium',
                  INVENTORY_TEXT_CLASS[inventoryStatus.status]
                )}
              >
                {formatInventory(product)}
              </span>
            </div>
            <Badge
              variant={inventoryStatus.color}
              className={cn(
                'text-xs',
                INVENTORY_BADGE_CLASS[inventoryStatus.status]
              )}
            >
              {inventoryStatus.text}
            </Badge>
          </div>

          {showPieces && (
            <div className="text-muted-foreground">
              每{displayUnit}：{product.piecesPerUnit}片
            </div>
          )}
        </div>
      </div>
    </CommandItem>
  );
}

function getInventoryStatus(product: Product): InventoryStatus {
  if (!product.inventory) {
    return { status: 'unknown', color: 'secondary', text: '未知' };
  }

  const available = product.inventory.availableQuantity || 0;

  if (available <= 0) {
    return { status: 'out-of-stock', color: 'destructive', text: '缺货' };
  }

  if (available <= 10) {
    return { status: 'low-stock', color: 'secondary', text: '库存偏低' };
  }

  return { status: 'in-stock', color: 'default', text: '库存充足' };
}

function formatInventory(product: Product): string {
  if (!product.inventory) {
    return '未知';
  }

  const available = product.inventory.availableQuantity || 0;
  const displayUnit =
    UNIT_MAPPING[product.unit?.toLowerCase?.() ?? ''] || product.unit;
  return `${available}${displayUnit}`;
}
