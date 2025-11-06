'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { FieldArrayWithId } from 'react-hook-form';

import { InventoryStatus } from '@/components/sales-orders/inventory-checker';
import { ProductSelector } from '@/components/sales-orders/product-selector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Product } from '@/lib/types/product';
import type { SalesOrderCreateFormData as CreateSalesOrderData } from '@/lib/validations/sales-order';
import type { SalesOrderItemFormData } from '@/lib/validations/sales-order/schemas';

interface OrderItemsCardProps {
  fields: FieldArrayWithId<CreateSalesOrderData, 'items', 'id'>[];
  products: Product[];
  stockWarnings: Record<number, string>;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  onUpdateItem: <Key extends keyof SalesOrderItemFormData>(
    index: number,
    field: Key,
    value: SalesOrderItemFormData[Key]
  ) => void;
  onProductSelect: (productId: string, index: number) => void;
}

export function OrderItemsCard({
  fields,
  products,
  stockWarnings,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onProductSelect,
}: OrderItemsCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">订单明细</CardTitle>
          <Button type="button" onClick={onAddItem}>
            <Plus className="mr-2 h-4 w-4" />
            添加产品
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {fields.length === 0 ? (
          <OrderItemsEmptyState />
        ) : (
          <OrderItemsTable
            fields={fields}
            products={products}
            stockWarnings={stockWarnings}
            onRemoveItem={onRemoveItem}
            onUpdateItem={onUpdateItem}
            onProductSelect={onProductSelect}
          />
        )}
      </CardContent>
    </Card>
  );
}

interface OrderItemsTableProps {
  fields: FieldArrayWithId<CreateSalesOrderData, 'items', 'id'>[];
  products: Product[];
  stockWarnings: Record<number, string>;
  onRemoveItem: (index: number) => void;
  onUpdateItem: <Key extends keyof SalesOrderItemFormData>(
    index: number,
    field: Key,
    value: SalesOrderItemFormData[Key]
  ) => void;
  onProductSelect: (productId: string, index: number) => void;
}

function OrderItemsTable({
  fields,
  products,
  stockWarnings,
  onRemoveItem,
  onUpdateItem,
  onProductSelect,
}: OrderItemsTableProps) {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">产品信息</TableHead>
              <TableHead className="w-[120px]">色号</TableHead>
              <TableHead className="w-[120px]">生产日期</TableHead>
              <TableHead className="w-[100px]">数量</TableHead>
              <TableHead className="w-[120px]">单价</TableHead>
              <TableHead className="w-[120px]">小计</TableHead>
              <TableHead className="w-[80px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((item, index) => (
              <OrderItemRow
                key={item.id}
                index={index}
                item={item}
                products={products}
                warning={stockWarnings[index]}
                onRemoveItem={onRemoveItem}
                onUpdateItem={onUpdateItem}
                onProductSelect={onProductSelect}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

interface OrderItemRowProps {
  index: number;
  item: FieldArrayWithId<CreateSalesOrderData, 'items', 'id'>;
  products: Product[];
  warning?: string;
  onRemoveItem: (index: number) => void;
  onUpdateItem: <Key extends keyof SalesOrderItemFormData>(
    index: number,
    field: Key,
    value: SalesOrderItemFormData[Key]
  ) => void;
  onProductSelect: (productId: string, index: number) => void;
}

function OrderItemRow({
  index,
  item,
  products,
  warning,
  onRemoveItem,
  onUpdateItem,
  onProductSelect,
}: OrderItemRowProps) {
  const selectedProduct = products.find(
    product => product.id === item.productId
  );
  const subtotal = (item.quantity ?? 0) * (item.unitPrice ?? 0);

  return (
    <TableRow className={warning ? 'bg-destructive/5' : ''}>
      <TableCell>
        <div className="space-y-2">
          <ProductSelector
            products={products}
            value={item.productId}
            onValueChange={value => onProductSelect(value, index)}
            placeholder="选择产品"
          />

          {selectedProduct && (
            <div className="flex items-center gap-2">
              <InventoryStatus
                product={selectedProduct}
                requestedQuantity={item.quantity ?? 0}
                className="text-xs"
              />
            </div>
          )}
        </div>
      </TableCell>

      <TableCell>
        <Input
          placeholder="批次号"
          value={typeof item.batchNumber === 'string' ? item.batchNumber : ''}
          onChange={event =>
            onUpdateItem(index, 'batchNumber', event.target.value)
          }
          className="w-full"
        />
      </TableCell>

      <TableCell>
        <Input
          type="date"
          value={
            typeof item.productionDate === 'string' ? item.productionDate : ''
          }
          onChange={event =>
            onUpdateItem(index, 'productionDate', event.target.value)
          }
          className="w-full"
        />
      </TableCell>

      <TableCell>
        <div className="space-y-1">
          <Input
            type="text"
            inputMode="decimal"
            value={item.quantity ?? ''}
            onChange={event => {
              const value = event.target.value;
              // 允许输入数字、小数点、空字符串
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                // 允许空值，不立即转换，让用户可以删除内容
                onUpdateItem(
                  index,
                  'quantity',
                  value === '' ? undefined : Number(value)
                );
              }
            }}
            onFocus={event => {
              // 聚焦时自动选中所有内容，方便用户直接输入新数量
              event.target.select();
            }}
            onBlur={event => {
              const value = event.target.value;
              // 失焦时处理空值：如果为空或只有小数点，设置为默认值1
              if (!value || value === '.') {
                onUpdateItem(index, 'quantity', 1);
              } else {
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                  onUpdateItem(index, 'quantity', numValue);
                } else {
                  // 如果解析失败，恢复为默认值1
                  onUpdateItem(index, 'quantity', 1);
                }
              }
            }}
            className="w-full"
          />
          {warning && <div className="text-destructive text-xs">{warning}</div>}
        </div>
      </TableCell>

      <TableCell>
        <Input
          type="text"
          inputMode="decimal"
          value={item.unitPrice ?? ''}
          onChange={event => {
            const value = event.target.value;
            // 允许输入数字、小数点、负号、空字符串
            if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
              // 允许空值，不立即转换，让用户可以删除内容
              onUpdateItem(
                index,
                'unitPrice',
                value === '' ? undefined : Number(value)
              );
            }
          }}
          onFocus={event => {
            // 聚焦时自动选中所有内容，方便用户直接输入新价格
            event.target.select();
          }}
          onBlur={event => {
            const value = event.target.value;
            // 失焦时处理空值：如果为空或只有符号，设置为0
            if (!value || value === '-' || value === '.') {
              onUpdateItem(index, 'unitPrice', 0);
            } else {
              const numValue = parseFloat(value);
              if (!isNaN(numValue)) {
                onUpdateItem(index, 'unitPrice', numValue);
              } else {
                // 如果解析失败，恢复为0
                onUpdateItem(index, 'unitPrice', 0);
              }
            }
          }}
          className="w-full"
        />
      </TableCell>

      <TableCell>
        <div className="font-medium">￥{subtotal.toFixed(2)}</div>
      </TableCell>

      <TableCell>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemoveItem(index)}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function OrderItemsEmptyState() {
  return (
    <div className="text-muted-foreground py-8 text-center">
      <p className="mb-2 font-medium">暂无产品明细</p>
      <p className="text-sm">点击“添加产品”按钮开始添加</p>
    </div>
  );
}
