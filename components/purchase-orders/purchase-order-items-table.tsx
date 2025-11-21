'use client';

import { Plus } from 'lucide-react';
import React, { useCallback, useRef } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import type { Product } from '@/lib/types/product';
import type { CreatePurchaseOrderData } from '@/lib/validations/purchase-order';

import { PurchaseOrderItemRow } from './purchase-order-item-row';

interface PurchaseOrderItemsTableProps {
  form: UseFormReturn<CreatePurchaseOrderData>;
  fields: Array<{ id: string }>;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
}

function PurchaseOrderItemsTableComponent({
  form,
  fields,
  onAddItem,
  onRemoveItem,
}: PurchaseOrderItemsTableProps) {
  const { toast } = useToast();

  const handleProductChange = useCallback(
    (index: number, product: Product | null) => {
      if (product && product.code) {
        form.setValue(`items.${index}.productId`, product.id);
        form.setValue(`items.${index}.productCode`, product.code);
        form.setValue(`items.${index}.displayName`, product.name || '');
        form.setValue(
          `items.${index}.specification`,
          product.specification || ''
        );
        form.setValue(`items.${index}.unit`, product.unit || 'piece');
        form.setValue(
          `items.${index}.piecesPerUnit`,
          product.piecesPerUnit ?? undefined
        );
        form.setValue(`items.${index}.isManualProduct`, false);

        toast({
          title: '已自动填充',
          description: '产品信息已自动填充',
          duration: 2000,
        });
      } else {
        form.setValue(`items.${index}.productId`, undefined);
        form.setValue(`items.${index}.piecesPerUnit`, undefined);
      }
    },
    [form, toast]
  );

  const handleQuantityChange = useCallback(
    (index: number, value: string) => {
      const quantity = parseFloat(value);
      const safeQuantity = Number.isFinite(quantity) ? quantity : 0;
      const unitPrice = Number(form.getValues(`items.${index}.unitPrice`) || 0);
      form.setValue(`items.${index}.totalPrice`, safeQuantity * unitPrice, {
        shouldDirty: true,
      });
    },
    [form]
  );

  const handleUnitPriceChange = useCallback(
    (index: number, value: string) => {
      const unitPrice = parseFloat(value);
      const safeUnitPrice = Number.isFinite(unitPrice) ? unitPrice : 0;
      const quantity = Number(form.getValues(`items.${index}.quantity`) || 0);
      form.setValue(`items.${index}.totalPrice`, quantity * safeUnitPrice, {
        shouldDirty: true,
      });
    },
    [form]
  );

  return (
    <PurchaseOrderItemsTableView
      onAddItem={onAddItem}
      fields={fields}
      form={form}
      onRemoveItem={onRemoveItem}
      onProductChange={handleProductChange}
      onQuantityChange={handleQuantityChange}
      onUnitPriceChange={handleUnitPriceChange}
    />
  );
}

export const PurchaseOrderItemsTable = React.memo(
  PurchaseOrderItemsTableComponent
);
PurchaseOrderItemsTable.displayName = 'PurchaseOrderItemsTable';

interface PurchaseOrderItemsTableViewProps {
  onAddItem: () => void;
  fields: Array<{ id: string }>;
  form: UseFormReturn<CreatePurchaseOrderData>;
  onRemoveItem: (index: number) => void;
  onProductChange: (index: number, product: Product | null) => void;
  onQuantityChange: (index: number, value: string) => void;
  onUnitPriceChange: (index: number, value: string) => void;
}

function PurchaseOrderItemsTableView({
  onAddItem,
  fields,
  form,
  onRemoveItem,
  onProductChange,
  onQuantityChange,
  onUnitPriceChange,
}: PurchaseOrderItemsTableViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const focusNewRowProductCell = useCallback((rowIndex: number) => {
    if (!containerRef.current) return;
    // 延迟到下一帧，等待DOM渲染
    requestAnimationFrame(() => {
      const cell = containerRef.current?.querySelector(
        `[data-selector="product"][data-row-index="${rowIndex}"] button[role="combobox"]`
      ) as HTMLButtonElement | null;
      cell?.focus();
    });
  }, []);

  const handleAddAndFocus = useCallback(() => {
    const nextIndex = fields.length; // 新行的索引
    onAddItem();
    // 聚焦到新行的产品选择器触发点
    focusNewRowProductCell(nextIndex);
  }, [fields.length, onAddItem, focusNewRowProductCell]);

  return (
    <div
      ref={containerRef}
      className="space-y-3"
      onKeyDown={e => {
        if (e.key === 'F3') {
          e.preventDefault();
          handleAddAndFocus();
        }
      }}
    >
      <div className="flex items-center justify-between">
        <Button
          type="button"
          onClick={handleAddAndFocus}
          size="sm"
          variant="default"
          className="h-8"
          aria-label="选择产品"
          title="选择产品(F3)"
        >
          <Plus className="mr-1 h-3 w-3" />
          选择产品(F3)
        </Button>
      </div>

      <div className="relative overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {/* 冻结列：序号 */}
              <TableHead className="bg-muted/50 sticky left-0 z-10 h-9 w-[50px] border-r py-2 text-xs">
                序号
              </TableHead>
              {/* 冻结列：产品名称 */}
              <TableHead className="bg-muted/50 sticky left-[50px] z-10 h-9 w-[200px] border-r py-2 text-xs">
                产品名称 *
              </TableHead>
              {/* 冻结列：产品编码 */}
              <TableHead className="bg-muted/50 sticky left-[250px] z-10 h-9 w-[140px] min-w-[120px] border-r py-2 text-xs">
                产品编码 *
              </TableHead>
              {/* 非冻结列 */}
              <TableHead className="h-9 min-w-[180px] border-r py-2 text-xs">
                供应商 *
              </TableHead>
              <TableHead className="h-9 max-w-[220px] min-w-[200px] border-r py-2 text-xs">
                规格
              </TableHead>
              <TableHead className="h-9 min-w-[180px] border-r py-2 text-xs">
                批次号
              </TableHead>
              <TableHead className="h-9 w-[100px] border-r py-2 text-right text-xs">
                数量 *
              </TableHead>
              <TableHead className="h-9 w-[80px] border-r py-2 text-center text-xs">
                单位
              </TableHead>
              <TableHead className="h-9 w-[120px] border-r py-2 text-right text-xs">
                每件片数
              </TableHead>
              <TableHead className="h-9 w-[120px] border-r py-2 text-right text-xs">
                采购单价 *
              </TableHead>
              <TableHead className="h-9 w-[120px] border-r py-2 text-right text-xs">
                总价
              </TableHead>
              <TableHead className="h-9 min-w-[150px] border-r py-2 text-xs">
                备注
              </TableHead>
              <TableHead className="h-9 w-[80px] py-2 text-center text-xs">
                操作
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => (
              <PurchaseOrderItemRow
                key={field.id}
                form={form}
                index={index}
                onRemoveItem={onRemoveItem}
                disableRemove={fields.length === 1}
                onProductChange={onProductChange}
                onQuantityChange={onQuantityChange}
                onUnitPriceChange={onUnitPriceChange}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
