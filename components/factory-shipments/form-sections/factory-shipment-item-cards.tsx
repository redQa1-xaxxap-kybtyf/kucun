'use client';

import { Trash2 } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';

import { SupplierPriceSelector } from '@/components/factory-shipments/supplier-price-selector';
import { IntelligentProductInput } from '@/components/sales-orders/intelligent-product-input';
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
import type { BlurHandlerFactory } from '@/lib/hooks/useFormErrorHandling';
import type { Product } from '@/lib/types/product';
import { COST_PRICE_STEP, roundCostPrice } from '@/lib/utils/cost-price';
import type { FactoryShipmentOrderFormData } from '@/lib/validations/factory-shipment';

interface FactoryShipmentItemCardsProps {
  form: UseFormReturn<FactoryShipmentOrderFormData, any, any>;
  products: Product[];
  fields: any[];
  onRemoveItem: (index: number) => void;
  onProductChange: (index: number) => (product: Product | null) => void;
  calculateItemAmount: (index: number) => number;
  getBlurHandler?: BlurHandlerFactory<FactoryShipmentOrderFormData>;
}

function getLineSummary(
  form: UseFormReturn<FactoryShipmentOrderFormData, any, any>,
  index: number
) {
  const productCode = String(
    form.watch(`items.${index}.productCode`) || ''
  ).trim();
  const displayName = String(
    form.watch(`items.${index}.displayName`) || ''
  ).trim();
  const specification = String(
    form.watch(`items.${index}.specification`) || ''
  ).trim();
  const batchNumber = String(
    form.watch(`items.${index}.batchNumber`) || ''
  ).trim();
  const supplierId = String(
    form.watch(`items.${index}.supplierId`) || ''
  ).trim();
  const quantity = Number(form.watch(`items.${index}.quantity`) || 0) || 0;
  const unit = String(form.watch(`items.${index}.unit`) || '片').trim();
  const remarks = String(form.watch(`items.${index}.remarks`) || '').trim();

  return {
    productCode,
    displayName,
    specification,
    batchNumber,
    supplierId,
    quantity,
    unit,
    remarks,
  };
}

export function FactoryShipmentItemCards({
  form,
  products,
  fields,
  onRemoveItem,
  onProductChange,
  calculateItemAmount,
  getBlurHandler,
}: FactoryShipmentItemCardsProps) {
  if (fields.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-6 py-12 text-center">
        <div className="text-muted-foreground flex flex-col items-center gap-2">
          <div className="text-sm text-[hsl(var(--color-text-primary))]">
            暂无产品明细
          </div>
          <p className="text-xs text-[hsl(var(--color-text-secondary))]">
            点击“添加产品”开始录入厂家直发明细
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {fields.map((field, index) => {
        const itemAmount = calculateItemAmount(index);
        const lineSummary = getLineSummary(form, index);
        const itemErrors = form.formState.errors.items?.[index];

        return (
          <div
            key={field.id}
            className="rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-4"
          >
            <div className="flex flex-col gap-3 border-b border-[hsl(var(--color-border-secondary))] pb-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">
                    明细 {index + 1}
                  </span>
                  <span className="min-w-0 truncate text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                    {lineSummary.displayName || '未选择产品'}
                  </span>
                </div>
                <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                  {lineSummary.productCode
                    ? `编码：${lineSummary.productCode}`
                    : '先选产品，再填数量和价格'}
                  {lineSummary.specification
                    ? `  ·  规格：${lineSummary.specification}`
                    : ''}
                  {lineSummary.batchNumber
                    ? `  ·  批次：${lineSummary.batchNumber}`
                    : ''}
                  {lineSummary.quantity > 0
                    ? `  ·  数量：${lineSummary.quantity}${lineSummary.unit || '片'}`
                    : ''}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-end">
                <div className="text-right">
                  <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                    当前金额
                  </div>
                  <div className="font-mono text-base font-semibold text-[hsl(var(--color-text-primary))]">
                    ￥{itemAmount.toFixed(2)}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                  onClick={() => onRemoveItem(index)}
                  aria-label={`删除第 ${index + 1} 行`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-12">
              <div className="xl:col-span-4">
                <div className="mb-1 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                  产品 <span className="text-destructive">*</span>
                </div>
                <div className="space-y-2">
                  <IntelligentProductInput
                    form={form}
                    index={index}
                    products={products}
                    onProductChange={onProductChange(index)}
                    placeholder="搜索产品或添加临时产品"
                    enableTemporaryProducts
                  />
                  <div className="rounded-md border bg-[hsl(var(--color-bg-secondary))] px-3 py-2 text-xs text-[hsl(var(--color-text-secondary))]">
                    {lineSummary.displayName || lineSummary.productCode ? (
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <span>名称：{lineSummary.displayName || '未带出'}</span>
                        <span>编码：{lineSummary.productCode || '未带出'}</span>
                      </div>
                    ) : (
                      <span>可搜索现有产品，也可新增临时产品。</span>
                    )}
                  </div>
                  {(itemErrors?.productCode?.message ||
                    itemErrors?.displayName?.message) && (
                    <p className="text-xs text-[hsl(var(--color-error))]">
                      {String(
                        itemErrors?.productCode?.message ||
                          itemErrors?.displayName?.message
                      )}
                    </p>
                  )}
                </div>
              </div>

              <div className="xl:col-span-3">
                <div className="mb-1 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                  供应商 <span className="text-destructive">*</span>
                </div>
                <FormField
                  control={form.control}
                  name={`items.${index}.supplierId`}
                  render={({ field }) => (
                    <SupplierPriceSelector
                      form={form}
                      index={index}
                      value={field.value}
                      onChange={field.onChange}
                      showLabel={false}
                      onBlur={
                        getBlurHandler
                          ? getBlurHandler(
                              `items.${index}.supplierId`,
                              field.onBlur
                            )
                          : field.onBlur
                      }
                    />
                  )}
                />
              </div>

              <div className="xl:col-span-2">
                <FormField
                  control={form.control}
                  name={`items.${index}.batchNumber`}
                  render={({ field }) => (
                    <FormItem>
                      <div className="mb-1 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                        批次
                      </div>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ''}
                          placeholder="批次号"
                          className="h-9 text-sm"
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </div>

              <div className="xl:col-span-3">
                <FormField
                  control={form.control}
                  name={`items.${index}.specification`}
                  render={({ field }) => (
                    <FormItem>
                      <div className="mb-1 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                        规格
                      </div>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ''}
                          placeholder="规格"
                          className="h-9 text-sm"
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <FormField
                control={form.control}
                name={`items.${index}.piecesPerUnit`}
                render={({ field }) => (
                  <FormItem>
                    <div className="mb-1 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                      装箱数
                    </div>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        {...field}
                        value={
                          field.value === undefined || field.value === null
                            ? ''
                            : field.value
                        }
                        onChange={e => {
                          const value = e.target.value;
                          if (value === '') {
                            field.onChange(undefined);
                            return;
                          }
                          const parsed = Number.parseInt(value, 10);
                          field.onChange(
                            Number.isNaN(parsed) ? undefined : parsed
                          );
                        }}
                        placeholder="片/件"
                        className="h-9 text-right text-sm"
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`items.${index}.quantity`}
                render={({ field }) => (
                  <FormItem>
                    <div className="mb-1 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                      数量 <span className="text-destructive">*</span>
                    </div>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ''}
                        onChange={e =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                        placeholder="数量"
                        className="h-9 text-right text-sm font-medium"
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`items.${index}.unit`}
                render={({ field }) => (
                  <FormItem>
                    <div className="mb-1 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                      单位
                    </div>
                    <FormControl>
                      <Select
                        value={field.value || '片'}
                        onValueChange={newUnit => {
                          const oldUnit = field.value || '片';
                          const piecesPerUnit =
                            Number(
                              form.getValues(`items.${index}.piecesPerUnit`) ||
                                0
                            ) || 0;
                          const currentSalePrice =
                            Number(
                              form.getValues(`items.${index}.unitPrice`) || 0
                            ) || 0;
                          const currentCostPrice =
                            Number(
                              form.getValues(`items.${index}.unitCost`) || 0
                            ) || 0;

                          if (
                            piecesPerUnit > 0 &&
                            oldUnit !== newUnit &&
                            (oldUnit === '片' || oldUnit === '件') &&
                            (newUnit === '片' || newUnit === '件')
                          ) {
                            if (oldUnit === '片' && newUnit === '件') {
                              if (currentSalePrice > 0) {
                                form.setValue(
                                  `items.${index}.unitPrice`,
                                  Number(
                                    (currentSalePrice * piecesPerUnit).toFixed(
                                      2
                                    )
                                  )
                                );
                              }
                              if (currentCostPrice > 0) {
                                form.setValue(
                                  `items.${index}.unitCost`,
                                  roundCostPrice(
                                    currentCostPrice * piecesPerUnit
                                  )
                                );
                              }
                            }

                            if (oldUnit === '件' && newUnit === '片') {
                              if (currentSalePrice > 0) {
                                form.setValue(
                                  `items.${index}.unitPrice`,
                                  Number(
                                    (currentSalePrice / piecesPerUnit).toFixed(
                                      4
                                    )
                                  )
                                );
                              }
                              if (currentCostPrice > 0) {
                                form.setValue(
                                  `items.${index}.unitCost`,
                                  roundCostPrice(
                                    currentCostPrice / piecesPerUnit
                                  )
                                );
                              }
                            }
                          }

                          field.onChange(newUnit);
                        }}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="片">片</SelectItem>
                          <SelectItem value="件">件</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`items.${index}.unitCost`}
                render={({ field }) => (
                  <FormItem>
                    <div className="mb-1 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                      进货价
                    </div>
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
                        onChange={e => {
                          const value = e.target.value;
                          field.onChange(
                            value === '' ? undefined : Number.parseFloat(value)
                          );
                        }}
                        placeholder="进货价"
                        className="h-9 text-right text-sm"
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`items.${index}.unitPrice`}
                render={({ field }) => (
                  <FormItem>
                    <div className="mb-1 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                      销售价 <span className="text-destructive">*</span>
                    </div>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="decimal"
                        {...field}
                        value={
                          field.value === undefined ||
                          Number.isNaN(field.value as number)
                            ? ''
                            : field.value
                        }
                        placeholder="销售单价"
                        className="h-9 text-right text-sm"
                        onChange={event => {
                          const value = event.target.value;
                          if (value === '' || /^\d*\.?\d*$/.test(value)) {
                            field.onChange(value === '' ? '' : value);
                          }
                        }}
                        onFocus={event => {
                          event.target.select();
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
                  </FormItem>
                )}
              />

              <div>
                <div className="mb-1 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                  金额
                </div>
                <div className="flex h-9 items-center justify-end rounded-md border bg-[hsl(var(--color-bg-secondary))] px-3 text-sm font-semibold text-orange-600">
                  ￥{itemAmount.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <FormField
                control={form.control}
                name={`items.${index}.remarks`}
                render={({ field }) => (
                  <FormItem>
                    <div className="mb-1 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                      备注
                    </div>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ''}
                        placeholder="备注"
                        className="h-9 text-sm"
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
