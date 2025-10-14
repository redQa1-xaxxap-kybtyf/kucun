'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';

import { BatchSelector } from '@/components/sales-orders/batch-selector';
import { IntelligentProductInput } from '@/components/sales-orders/intelligent-product-input';
import { Button } from '@/components/ui/button';
import { calculatePieceDisplay } from '@/lib/utils/piece-calculation';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableCell, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import type { Product } from '@/lib/types/product';
import type { TransferFulfillmentMode } from '@/lib/types/sales-order';

interface OrderItemRowProps {
  index: number;
  products: Product[];
  onRemove: (index: number) => void;
  onProductChange?: (index: number, product: Product | null) => void;
  orderType: 'NORMAL' | 'TRANSFER';
  transferMode?: TransferFulfillmentMode;
  unitMapping: Record<string, string>;
}

export function OrderItemRow({
  index,
  products,
  onRemove,
  onProductChange,
  orderType,
  transferMode,
  unitMapping,
}: OrderItemRowProps) {
  const form = useFormContext();

  // 使用 useWatch 监听字段变化
  const watchedProductId = useWatch({
    control: form.control,
    name: `items.${index}.productId`,
  });

  const isManualProduct = useWatch({
    control: form.control,
    name: `items.${index}.isManualProduct`,
    defaultValue: false,
  });

  const watchedQuantity = useWatch({
    control: form.control,
    name: `items.${index}.quantity`,
    defaultValue: 0,
  });
  const watchedLocalQuantity = useWatch({
    control: form.control,
    name: `items.${index}.localQuantity`,
    defaultValue: orderType === 'TRANSFER' ? 0 : 0,
  });
  const watchedTransferQuantity = useWatch({
    control: form.control,
    name: `items.${index}.transferQuantity`,
    defaultValue: orderType === 'TRANSFER' ? 0 : 0,
  });

  const watchedUnitPrice = useWatch({
    control: form.control,
    name: `items.${index}.unitPrice`,
    defaultValue: 0,
  });

  const watchedDisplayUnit = useWatch({
    control: form.control,
    name: `items.${index}.displayUnit`,
    defaultValue: '片',
  });

  const watchedPiecesPerUnit = useWatch({
    control: form.control,
    name: `items.${index}.piecesPerUnit`,
    defaultValue: 1,
  });
  const watchedDisplayQuantity = useWatch({
    control: form.control,
    name: `items.${index}.displayQuantity`,
    defaultValue: 1,
  });

  const productFromList = React.useMemo(
    () => products.find(p => p.id === watchedProductId),
    [products, watchedProductId]
  );
  const [productOverride, setProductOverride] = React.useState<Product | null>(
    null
  );

  React.useEffect(() => {
    if (!watchedProductId) {
      setProductOverride(null);
      return;
    }
    if (productFromList) {
      setProductOverride(prev =>
        prev && prev.id === productFromList.id ? prev : productFromList
      );
    }
  }, [productFromList, watchedProductId]);

  const resolvedProduct = productOverride ?? productFromList ?? null;

  // 获取当前行的批次号
  const currentBatchNumber = useWatch({
    control: form.control,
    name: `items.${index}.batchNumber`,
  });
  const watchedRemarks = useWatch({
    control: form.control,
    name: `items.${index}.remarks`,
  });

  const handleProductChange = React.useCallback(
    (product: Product | null) => {
      setProductOverride(product);
      onProductChange?.(index, product);
    },
    [index, onProductChange]
  );

  // 构建批次列表：合并产品库存批次和当前已选批次（用于编辑模式）
  const availableBatches = React.useMemo(() => {
    const inventoryBatches = resolvedProduct?.inventory?.batches || [];

    // 如果当前有批次号，但不在库存批次列表中，添加它（用于编辑模式回显）
    if (
      currentBatchNumber &&
      !inventoryBatches.find(b => b.batchNumber === currentBatchNumber)
    ) {
      return [
        { batchNumber: currentBatchNumber, quantity: 0 }, // 数量0表示这是历史批次
        ...inventoryBatches,
      ];
    }

    return inventoryBatches;
  }, [
    resolvedProduct?.inventory?.batches,
    currentBatchNumber,
    resolvedProduct?.id,
  ]);

  // 计算片单价
  const piecePriceForCalculation =
    watchedDisplayUnit === '件' && watchedUnitPrice && watchedPiecesPerUnit
      ? watchedUnitPrice / watchedPiecesPerUnit
      : watchedUnitPrice || 0;

  // 金额 = 系统数量（片数） × 片单价
  const itemAmount = (watchedQuantity || 0) * piecePriceForCalculation;
  const localQuantityDisplay = Math.max(Number(watchedLocalQuantity) || 0, 0);
  const transferQuantityDisplay = Math.max(
    Number(watchedTransferQuantity) || 0,
    0
  );
  const formatQuantity = (value: number) =>
    Number.isFinite(value)
      ? value.toLocaleString('zh-CN', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })
      : '0';
  React.useEffect(() => {
    const displayQty = Number(watchedDisplayQuantity) || 0;
    const piecesPerUnit = Number(watchedPiecesPerUnit) || 0;
    const quantityFromDisplay =
      watchedDisplayUnit === '件' && piecesPerUnit > 0
        ? displayQty * piecesPerUnit
        : displayQty;
    const normalizedQuantity = Number.isFinite(quantityFromDisplay)
      ? Math.max(quantityFromDisplay, 0)
      : 0;
    if (Math.abs((watchedQuantity || 0) - normalizedQuantity) > 1e-6) {
      form.setValue(`items.${index}.quantity`, normalizedQuantity, {
        shouldDirty: true,
        shouldValidate: false,
      });
    }
  }, [
    form,
    index,
    watchedDisplayQuantity,
    watchedDisplayUnit,
    watchedPiecesPerUnit,
    watchedQuantity,
  ]);

  React.useEffect(() => {
    const total = Number(watchedQuantity) || 0;
    const local = Number(watchedLocalQuantity) || 0;
    const transfer = Number(watchedTransferQuantity) || 0;

    const clamp = (value: number, min: number, max: number) =>
      Math.min(Math.max(value, min), max);

    if (orderType === 'TRANSFER') {
      if (transferMode === 'MIXED') {
        const boundedLocal = clamp(local, 0, total);
        if (Math.abs(boundedLocal - local) > 0.01) {
          form.setValue(`items.${index}.localQuantity`, boundedLocal, {
            shouldDirty: true,
            shouldValidate: false,
          });
          return;
        }
        const expectedTransfer = Math.max(total - boundedLocal, 0);
        if (Math.abs(expectedTransfer - transfer) > 0.01) {
          form.setValue(`items.${index}.transferQuantity`, expectedTransfer, {
            shouldDirty: true,
            shouldValidate: false,
          });
        }
      } else {
        if (Math.abs(local) > 0.01) {
          form.setValue(`items.${index}.localQuantity`, 0, {
            shouldDirty: true,
            shouldValidate: false,
          });
          return;
        }
        if (Math.abs(transfer - total) > 0.01) {
          form.setValue(`items.${index}.transferQuantity`, total, {
            shouldDirty: true,
            shouldValidate: false,
          });
        }
      }
    } else {
      if (Math.abs(local - total) > 0.01) {
        form.setValue(`items.${index}.localQuantity`, total, {
          shouldDirty: true,
          shouldValidate: false,
        });
        return;
      }
      if (Math.abs(transfer) > 0.01) {
        form.setValue(`items.${index}.transferQuantity`, 0, {
          shouldDirty: true,
          shouldValidate: false,
        });
      }
    }
  }, [
    form,
    index,
    orderType,
    transferMode,
    watchedLocalQuantity,
    watchedQuantity,
    watchedTransferQuantity,
  ]);

  // 自动生成备注：始终显示 X件Y片 格式
  React.useEffect(() => {
    const quantity = Number(watchedQuantity) || 0;
    const piecesPerUnit = Number(watchedPiecesPerUnit) || 0;

    if (quantity > 0 && piecesPerUnit > 0) {
      try {
        const result = calculatePieceDisplay(
          Math.floor(quantity),
          piecesPerUnit
        );
        // 始终显示完整的格式，无论是否整件
        let remarksText = '';
        if (result.fullUnits === 0) {
          // 不足1件，直接显示片数
          remarksText = `${result.remainingPieces}片`;
        } else if (result.remainingPieces === 0) {
          // 整件，显示件数
          remarksText = `${result.fullUnits}件`;
        } else {
          // 既有件又有片
          remarksText = `${result.fullUnits}件${result.remainingPieces}片`;
        }

        if (remarksText !== watchedRemarks) {
          form.setValue(`items.${index}.remarks`, remarksText, {
            shouldDirty: false,
            shouldValidate: false,
          });
        }
      } catch (error) {
        // 如果计算失败，清空备注
        if (watchedRemarks) {
          form.setValue(`items.${index}.remarks`, '', {
            shouldDirty: false,
            shouldValidate: false,
          });
        }
      }
    } else {
      // 数量或每件片数无效时，清空备注
      if (watchedRemarks) {
        form.setValue(`items.${index}.remarks`, '', {
          shouldDirty: false,
          shouldValidate: false,
        });
      }
    }
  }, [form, index, watchedQuantity, watchedPiecesPerUnit, watchedRemarks]);

  const allowProductCodeEdit = isManualProduct || !watchedProductId;

  return (
    <TableRow className="h-10">
      {/* 商品名称 */}
      <TableCell className="min-w-[200px]">
        <IntelligentProductInput
          form={form}
          index={index}
          products={products}
          onProductChange={handleProductChange}
        />
      </TableCell>

      {/* 产品编码 */}
      <TableCell className="min-w-[140px]">
        <FormField
          control={form.control}
          name={`items.${index}.productCode`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ''}
                  className="h-8 font-mono text-xs"
                  placeholder="产品编码"
                  readOnly={!allowProductCodeEdit}
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
      </TableCell>

      {/* 每件片数 */}
      <TableCell className="min-w-[80px]">
        <FormField
          control={form.control}
          name={`items.${index}.piecesPerUnit`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  value={field.value || ''}
                  className="h-8 text-xs"
                  placeholder="片数"
                  disabled
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
      </TableCell>

      {/* 批次选择列 */}
      <TableCell className="min-w-[180px]">
        <FormField
          control={form.control}
          name={`items.${index}.batchNumber`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <BatchSelector
                  batches={availableBatches}
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={!resolvedProduct}
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
      </TableCell>

      {/* 规格列 */}
      <TableCell className="min-w-[100px]">
        <FormField
          control={form.control}
          name={`items.${index}.specification`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  {...field}
                  className="h-8 text-xs"
                  placeholder="规格"
                  disabled
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
      </TableCell>

      {/* 单位和数量列 */}
      <TableCell className="min-w-[120px]">
        <div className="flex items-center gap-1">
          <FormField
            control={form.control}
            name={`items.${index}.displayUnit`}
            render={({ field }) => (
              <FormItem className="flex-1">
                <Select
                  onValueChange={newUnit => {
                    const oldUnit = field.value;
                    const currentPrice = form.getValues(
                      `items.${index}.unitPrice`
                    );
                    const piecesPerUnit = form.getValues(
                      `items.${index}.piecesPerUnit`
                    );

                    // 单位切换时自动换算单价
                    if (oldUnit !== newUnit && currentPrice && piecesPerUnit) {
                      let newPrice = currentPrice;
                      if (oldUnit === '片' && newUnit === '件') {
                        // 片→件: 单价乘以每件片数
                        newPrice = currentPrice * piecesPerUnit;
                      } else if (oldUnit === '件' && newUnit === '片') {
                        // 件→片: 单价除以每件片数
                        newPrice = currentPrice / piecesPerUnit;
                      }
                      // 保留2位小数
                      form.setValue(
                        `items.${index}.unitPrice`,
                        Math.round(newPrice * 100) / 100,
                        {
                          shouldDirty: true,
                          shouldValidate: true,
                        }
                      );
                    }

                    field.onChange(newUnit);
                  }}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="片">片</SelectItem>
                    <SelectItem
                      value="件"
                      disabled={!resolvedProduct?.piecesPerUnit}
                    >
                      件
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
        </div>
      </TableCell>

      {/* 数量列 */}
      <TableCell className="min-w-[100px]">
        <FormField
          control={form.control}
          name={`items.${index}.displayQuantity`}
          rules={{
            required: '数量不能为空',
            validate: value => {
              const numeric = Number(value) || 0;
              return numeric > 0 || '数量必须大于 0';
            },
          }}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  {...field}
                  className="h-8 text-xs"
                  placeholder="数量"
                  onChange={e => {
                    const value = e.target.value;
                    field.onChange(
                      value === '' ? undefined : parseFloat(value)
                    );
                  }}
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
      </TableCell>

      {/* 单价列 */}
      <TableCell className="min-w-[100px]">
        <FormField
          control={form.control}
          name={`items.${index}.unitPrice`}
          rules={{
            required: '单价不能为空',
            validate: value => {
              const numeric = Number(value);
              return numeric > 0 || '单价必须大于 0';
            },
          }}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  {...field}
                  value={field.value || ''}
                  className="h-8 text-xs"
                  placeholder="单价"
                  onChange={e => {
                    const value = e.target.value;
                    field.onChange(
                      value === '' ? undefined : parseFloat(value)
                    );
                  }}
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
      </TableCell>

      {/* 调货销售特殊列 */}
      {orderType === 'TRANSFER' && (
        <TableCell className="min-w-[120px]">
          <FormField
            control={form.control}
            name={`items.${index}.unitCost`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    {...field}
                    value={field.value ?? ''}
                    className="h-8 text-xs"
                    placeholder="成本单价"
                    onChange={e => {
                      const value = e.target.value;
                      field.onChange(
                        value === '' ? undefined : parseFloat(value)
                      );
                    }}
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
        </TableCell>
      )}

      {orderType === 'TRANSFER' && (
        <TableCell className="min-w-[160px]">
          {transferMode === 'MIXED' ? (
            <div className="space-y-1">
              <FormField
                control={form.control}
                name={`items.${index}.localQuantity`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        value={field.value ?? ''}
                        className="h-8 text-xs"
                        placeholder="本地数量"
                        onChange={e => {
                          const value = e.target.value;
                          field.onChange(
                            value === '' ? undefined : parseFloat(value)
                          );
                        }}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              <div className="text-xs text-[hsl(var(--color-text-tertiary))]">
                本地发货：{formatQuantity(localQuantityDisplay)} 片
              </div>
              <div className="text-xs text-[hsl(var(--color-text-tertiary))]">
                调货数量：{formatQuantity(transferQuantityDisplay)} 片
              </div>
            </div>
          ) : (
            <div className="text-xs text-[hsl(var(--color-text-tertiary))]">
              全部由供应商调货（{formatQuantity(transferQuantityDisplay)} 片）
            </div>
          )}
        </TableCell>
      )}

      {/* 金额 */}
      <TableCell className="min-w-[100px]">
        <div className="text-xs font-medium">¥{itemAmount.toFixed(2)}</div>
      </TableCell>

      {/* 备注 */}
      <TableCell className="min-w-[150px]">
        <FormField
          control={form.control}
          name={`items.${index}.remarks`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea
                  {...field}
                  className="min-h-[32px] resize-none text-xs"
                  placeholder="备注"
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
      </TableCell>

      {/* 操作 */}
      <TableCell className="min-w-[80px]">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemove(index)}
          className="h-8 w-8 p-0"
        >
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
