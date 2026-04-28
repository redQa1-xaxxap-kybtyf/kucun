/* eslint-disable max-lines, max-lines-per-function */
'use client';

import { Package, Trash2 } from 'lucide-react';
import * as React from 'react';
import { useWatch } from 'react-hook-form';

import { BatchSelector } from '@/components/sales-orders/batch-selector';
import { IntelligentProductInput } from '@/components/sales-orders/intelligent-product-input';
import { InventoryStatus } from '@/components/sales-orders/inventory-checker';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import type { Product } from '@/lib/types/product';
import type { TransferFulfillmentMode } from '@/lib/types/sales-order';
import { cn } from '@/lib/utils';
import { COST_PRICE_STEP, formatCostPrice } from '@/lib/utils/cost-price';
import { requiresProductBatchSelection } from '@/lib/utils/product-inventory';

import { useOrderItemController } from './hooks';

interface OrderItemMobileCardProps {
  index: number;
  isHighlighted?: boolean;
  products: Product[];
  onRemove: (index: number) => void;
  onProductChange?: (index: number, product: Product | null) => void;
  orderType: 'NORMAL' | 'TRANSFER';
  transferMode?: TransferFulfillmentMode;
  showInlineInventoryStatus?: boolean;
}

export function OrderItemMobileCard({
  index,
  isHighlighted = false,
  products,
  onRemove,
  onProductChange,
  orderType,
  transferMode,
  showInlineInventoryStatus = false,
}: OrderItemMobileCardProps) {
  const controller = useOrderItemController({
    index,
    products,
    onProductChange,
    orderType,
    transferMode,
  });
  const {
    form,
    isManualProduct,
    resolvedProduct,
    availableBatches,
    localQuantityDisplay,
    transferQuantityDisplay,
    itemAmount,
    formatQuantity,
    onProductOverride,
    watchers,
  } = controller;

  const productCodePath = `items.${index}.productCode` as const;
  const manualNamePath = `items.${index}.manualProductName` as const;
  const manualSpecPath = `items.${index}.manualSpecification` as const;
  const piecesPerUnitPath = `items.${index}.piecesPerUnit` as const;
  const batchNumberPath = `items.${index}.batchNumber` as const;
  const displayUnitPath = `items.${index}.displayUnit` as const;
  const displayQuantityPath = `items.${index}.displayQuantity` as const;
  const unitPricePath = `items.${index}.unitPrice` as const;
  const unitCostPath = `items.${index}.unitCost` as const;
  const localQuantityPath = `items.${index}.localQuantity` as const;
  const remarksPath = `items.${index}.remarks` as const;
  const specificationPath = `items.${index}.specification` as const;

  const productCodeValue =
    useWatch({
      control: form.control,
      name: productCodePath,
    }) ??
    resolvedProduct?.code ??
    '';
  const specificationValue =
    useWatch({
      control: form.control,
      name: isManualProduct ? manualSpecPath : specificationPath,
    }) ?? '';
  const unitCostValue =
    useWatch({
      control: form.control,
      name: unitCostPath,
    }) ?? undefined;

  const hasInventoryInfo =
    Boolean(resolvedProduct) &&
    resolvedProduct?.inventory?.availableQuantity !== undefined;
  const requestedQuantity = Number(watchers.quantity ?? 0) || 0;
  const selectedBatchNumber = watchers.batchNumber ?? undefined;
  const numericUnitCost =
    typeof unitCostValue === 'string'
      ? Number(unitCostValue)
      : Number(unitCostValue ?? 0);
  const showBelowCostWarning =
    orderType === 'TRANSFER' &&
    Number.isFinite(watchers.unitPrice) &&
    Number.isFinite(numericUnitCost) &&
    watchers.unitPrice > 0 &&
    numericUnitCost > 0 &&
    watchers.unitPrice < numericUnitCost;

  return (
    <div
      id={`sales-order-item-row-${index}`}
      data-sales-order-row-index={index}
      data-testid="sales-order-mobile-item-card"
      className={cn(
        'rounded-md border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-3 shadow-sm',
        isHighlighted &&
          'border-amber-300 bg-amber-50/80 shadow-[0_0_0_1px_rgba(245,158,11,0.25)]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] font-medium text-[hsl(var(--color-text-secondary))]">
            <span className="rounded-md bg-[hsl(var(--color-primary-light))] px-2 py-0.5 text-[hsl(var(--color-primary))]">
              第 {index + 1} 项
            </span>
            {resolvedProduct?.name ? (
              <span className="truncate text-[hsl(var(--color-text-primary))]">
                {resolvedProduct.name}
              </span>
            ) : isManualProduct ? (
              <span className="truncate text-[hsl(var(--color-text-primary))]">
                临时产品
              </span>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemove(index)}
          className="h-8 w-8 shrink-0 rounded-md p-0 text-red-500 hover:bg-red-50 hover:text-red-600"
          aria-label={`删除第 ${index + 1} 项`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-3 space-y-3">
        <MobileField label="产品编码 / 产品">
          <IntelligentProductInput
            form={form}
            index={index}
            products={products}
            onProductChange={onProductOverride}
            orderType={orderType}
          />
        </MobileField>

        {resolvedProduct && !isManualProduct ? (
          <div className="rounded-md bg-[hsl(var(--color-bg-secondary))] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-[hsl(var(--color-border-primary))] bg-white px-2 py-1 font-mono text-[11px] font-semibold text-[hsl(var(--color-text-primary))]">
                {productCodeValue || '未设编码'}
              </span>
              <div className="min-w-0 flex-1 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                <span className="truncate">{resolvedProduct.name}</span>
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-[hsl(var(--color-text-secondary))]">
              <span className="rounded-md bg-white px-2 py-1">
                规格 {specificationValue || '未填写'}
              </span>
              <span className="rounded-md bg-white px-2 py-1">
                装箱数{' '}
                {watchers.piecesPerUnit > 0 ? `${watchers.piecesPerUnit}片/件` : '-'}
              </span>
            </div>
          </div>
        ) : null}

        {isManualProduct ? (
          <div className="grid grid-cols-2 gap-3">
            <MobileField label="产品编码">
              <FormField
                control={form.control}
                name={productCodePath}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ''}
                        className="h-9 font-mono text-sm"
                        placeholder="产品编码"
                        onChange={event => {
                          const value = event.target.value;
                          field.onChange(
                            value === '' ? undefined : value.trim()
                          );
                        }}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </MobileField>

            <MobileField label="装箱数">
              <FormField
                control={form.control}
                name={piecesPerUnitPath}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        {...field}
                        value={field.value ?? ''}
                        className="h-9 text-sm"
                        placeholder="装箱数"
                        onChange={event => {
                          const value = event.target.value;
                          field.onChange(
                            value === '' ? undefined : parseInt(value, 10)
                          );
                        }}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </MobileField>

            <div className="col-span-2">
              <MobileField label="产品名称">
                <FormField
                  control={form.control}
                  name={manualNamePath}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          className="h-9 text-sm"
                          placeholder="手动产品名称（可选）"
                          onChange={event => {
                            const next = event.target.value;
                            field.onChange(next === '' ? undefined : next);
                          }}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </MobileField>
            </div>

            <div className="col-span-2">
              <MobileField label="规格">
                <FormField
                  control={form.control}
                  name={manualSpecPath}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          className="h-9 text-sm"
                          placeholder="规格"
                          onChange={event => {
                            const value = event.target.value;
                            field.onChange(value === '' ? undefined : value);
                          }}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </MobileField>
            </div>
          </div>
        ) : null}

        {!isManualProduct ? (
          <MobileField label="批次号">
            <FormField
              control={form.control}
              name={batchNumberPath}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <BatchSelector
                      batches={availableBatches}
                      value={field.value}
                      onValueChange={batchNumber => {
                        field.onChange(batchNumber);

                        const matched = availableBatches.find(
                          batch => batch.batchNumber === batchNumber
                        );
                        const fallback =
                          typeof resolvedProduct?.piecesPerUnit === 'number' &&
                          resolvedProduct.piecesPerUnit > 0
                            ? resolvedProduct.piecesPerUnit
                            : undefined;
                        const nextPieces =
                          matched &&
                          matched.piecesPerUnit &&
                          matched.piecesPerUnit > 0
                            ? matched.piecesPerUnit
                            : fallback;

                        form.setValue(piecesPerUnitPath, nextPieces, {
                          shouldDirty: false,
                          shouldValidate: false,
                        });
                      }}
                      disabled={!resolvedProduct}
                      className="h-9 text-sm"
                      triggerProps={{
                        'data-sales-order-focus-target': 'batch',
                      }}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                  {requiresProductBatchSelection(resolvedProduct, field.value) ? (
                    <p className="text-[11px] text-amber-600">
                      存在多个可用批次，请先选择批次
                    </p>
                  ) : null}
                </FormItem>
              )}
            />
          </MobileField>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <MobileField label="数量">
            <div className="flex gap-2">
              <FormField
                control={form.control}
                name={displayUnitPath}
                render={({ field }) => (
                  <FormItem className="w-[92px] shrink-0">
                    <Select
                      value={field.value}
                      onValueChange={newUnit => {
                        const oldUnit = field.value;
                        const currentPrice = form.getValues(unitPricePath);
                        const piecesPerUnit = form.getValues(piecesPerUnitPath);

                        if (oldUnit !== newUnit && currentPrice && piecesPerUnit) {
                          let nextPrice = currentPrice;
                          if (oldUnit === '片' && newUnit === '件') {
                            nextPrice = currentPrice * piecesPerUnit;
                          } else if (oldUnit === '件' && newUnit === '片') {
                            nextPrice = currentPrice / piecesPerUnit;
                          }

                          form.setValue(
                            unitPricePath,
                            Math.round(nextPrice * 100) / 100,
                            { shouldDirty: true, shouldValidate: false }
                          );
                        }

                        field.onChange(newUnit);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="片">片</SelectItem>
                        <SelectItem
                          value="件"
                          disabled={
                            !resolvedProduct?.piecesPerUnit && !isManualProduct
                          }
                        >
                          件
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={displayQuantityPath}
                rules={{
                  validate: value => {
                    if (value === undefined || value === null) {
                      return '数量不能为空';
                    }
                    const numeric = Number(value);
                    if (Number.isNaN(numeric) || numeric <= 0) {
                      return '数量必须大于 0';
                    }
                    return true;
                  },
                }}
                render={({ field }) => (
                  <FormItem className="min-w-0 flex-1">
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={field.value ?? ''}
                        className="h-9 text-sm"
                        placeholder="数量"
                        data-sales-order-focus-target="quantity"
                        onChange={event => {
                          const inputValue = event.target.value;
                          if (
                            inputValue === '' ||
                            /^\d*\.?\d*$/.test(inputValue)
                          ) {
                            field.onChange(
                              inputValue === '' ? '' : inputValue
                            );
                          }
                        }}
                        onBlur={event => {
                          const inputValue = event.target.value;
                          if (!inputValue || inputValue === '.') {
                            field.onChange(1);
                          } else {
                            const parsed = parseFloat(inputValue);
                            field.onChange(Number.isNaN(parsed) ? 1 : parsed);
                          }
                          field.onBlur();
                        }}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>
            {showInlineInventoryStatus &&
            hasInventoryInfo &&
            requestedQuantity > 0 ? (
              <div className="mt-1">
                <InventoryStatus
                  product={resolvedProduct as Product}
                  requestedQuantity={requestedQuantity}
                  batchNumber={selectedBatchNumber}
                  className="text-xs"
                />
              </div>
            ) : null}
          </MobileField>

          <MobileField label="销售单价">
            <FormField
              control={form.control}
              name={unitPricePath}
              rules={{
                required: '销售单价不能为空',
                validate: value => {
                  const numeric = Number(value);
                  return numeric > 0 || '销售单价必须大于 0';
                },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      type="text"
                      inputMode="decimal"
                      {...field}
                      value={
                        field.value === undefined || Number.isNaN(field.value)
                          ? ''
                          : field.value
                      }
                      className="h-9 text-sm"
                      placeholder="销售单价"
                      onFocus={event => {
                        event.target.select();
                      }}
                      onChange={event => {
                        const value = event.target.value;
                        if (value === '' || /^\d*\.?\d*$/.test(value)) {
                          field.onChange(value === '' ? '' : value);
                        }
                      }}
                      onBlur={event => {
                        const value = event.target.value;
                        if (!value || value === '.') {
                          field.onChange(0);
                        } else {
                          const parsed = Number.parseFloat(value);
                          field.onChange(Number.isNaN(parsed) ? 0 : parsed);
                        }
                        field.onBlur();
                      }}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                  {showBelowCostWarning ? (
                    <p className="mt-1 text-[11px] text-amber-600">
                      销售价低于成本（约 {formatCostPrice(numericUnitCost, {
                        withSymbol: false,
                        fallback: '0.000',
                      })}
                      ）
                    </p>
                  ) : null}
                </FormItem>
              )}
            />
          </MobileField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {orderType === 'TRANSFER' ? (
            <MobileField label="成本单价">
              <FormField
                control={form.control}
                name={unitCostPath}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="number"
                        step={COST_PRICE_STEP}
                        min="0"
                        {...field}
                        value={
                          field.value === undefined || Number.isNaN(field.value)
                            ? ''
                            : field.value
                        }
                        className="h-9 text-sm"
                        placeholder="成本单价"
                        onFocus={event => {
                          event.target.select();
                        }}
                        onChange={event => {
                          const value = event.target.value;
                          field.onChange(
                            value === '' ? undefined : Number.parseFloat(value)
                          );
                        }}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </MobileField>
          ) : (
            <div className="rounded-md bg-[hsl(var(--color-bg-secondary))] px-3 py-2.5">
              <div className="text-[11px] font-medium text-[hsl(var(--color-text-secondary))]">
                产品金额
              </div>
              <div className="mt-1 text-lg font-semibold text-orange-600">
                ￥{itemAmount.toFixed(2)}
              </div>
            </div>
          )}

          {orderType === 'TRANSFER' ? (
            transferMode === 'MIXED' ? (
              <MobileField label="本地发货">
                <FormField
                  control={form.control}
                  name={localQuantityPath}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          value={field.value ?? ''}
                          className="h-9 text-sm"
                          placeholder="本地数量"
                          onChange={event => {
                            const value = event.target.value;
                            field.onChange(
                              value === '' ? undefined : parseFloat(value)
                            );
                          }}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                      <div className="mt-1 text-[11px] text-[hsl(var(--color-text-secondary))]">
                        本地 {formatQuantity(localQuantityDisplay)} 片，调货{' '}
                        {formatQuantity(transferQuantityDisplay)} 片
                      </div>
                    </FormItem>
                  )}
                />
              </MobileField>
            ) : (
              <div className="rounded-md bg-[hsl(var(--color-bg-secondary))] px-3 py-2.5">
                <div className="text-[11px] font-medium text-[hsl(var(--color-text-secondary))]">
                  调货信息
                </div>
                <div className="mt-1 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                  全部由供应商调货
                </div>
                <div className="mt-1 text-[11px] text-[hsl(var(--color-text-secondary))]">
                  调货数量 {formatQuantity(transferQuantityDisplay)} 片
                </div>
              </div>
            )
          ) : (
            <div className="rounded-md bg-[hsl(var(--color-bg-secondary))] px-3 py-2.5">
              <div className="text-[11px] font-medium text-[hsl(var(--color-text-secondary))]">
                合计数量
              </div>
              <div className="mt-1 text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                {formatQuantity(watchers.quantity)} 片
              </div>
              <div className="mt-1 text-[11px] text-[hsl(var(--color-text-secondary))]">
                {watchers.displayUnit}数 {formatQuantity(watchers.displayQuantity)}
              </div>
            </div>
          )}
        </div>

        {orderType === 'TRANSFER' ? (
          <div className="rounded-md bg-[hsl(var(--color-bg-secondary))] px-3 py-2.5">
            <div className="text-[11px] font-medium text-[hsl(var(--color-text-secondary))]">
              产品金额
            </div>
            <div className="mt-1 text-lg font-semibold text-orange-600">
              ￥{itemAmount.toFixed(2)}
            </div>
          </div>
        ) : null}

        <MobileField label="备注">
          <FormField
            control={form.control}
            name={remarksPath}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    {...field}
                    value={field.value ?? ''}
                    className="min-h-[72px] resize-none text-sm"
                    placeholder="备注"
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
        </MobileField>
      </div>
    </div>
  );
}

function MobileField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1 text-[11px] font-medium text-[hsl(var(--color-text-secondary))]">
        <Package className="h-3 w-3" />
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}
