'use client';

import { ChevronDown, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { SupplierPriceSelector } from '@/components/factory-shipments/supplier-price-selector';
import { IntelligentProductInput } from '@/components/sales-orders/intelligent-product-input';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
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
import { cn } from '@/lib/utils';
import { COST_PRICE_STEP, roundCostPrice } from '@/lib/utils/cost-price';
import type { FactoryShipmentOrderFormData } from '@/lib/validations/factory-shipment';

interface FactoryShipmentItemCardsProps {
  form: UseFormReturn<FactoryShipmentOrderFormData, any, any>;
  products: Product[];
  fields: any[];
  duplicateRowIndexes?: ReadonlySet<number>;
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
  duplicateRowIndexes,
  onRemoveItem,
  onProductChange,
  calculateItemAmount,
  getBlurHandler,
}: FactoryShipmentItemCardsProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  if (fields.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-6 py-12 text-center">
        <div className="text-muted-foreground flex flex-col items-center gap-2">
          <div className="text-sm text-[hsl(var(--color-text-primary))]">
            暂无产品明细
          </div>
          <p className="text-xs text-[hsl(var(--color-text-secondary))]">
            点击“新增一行”开始录入厂家直发明细
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-[hsl(var(--color-border-primary))]">
      <div className="overflow-x-auto">
        <div className="lg:min-w-[1260px]">
          <div className="hidden gap-2 border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))]/45 px-3 py-2 text-[11px] font-medium tracking-[0.03em] text-[hsl(var(--color-text-secondary))] lg:grid lg:grid-cols-[56px_minmax(220px,2fr)_minmax(180px,1.6fr)_110px_110px_84px_76px_96px_96px_104px_92px]">
            <div className="text-center">行次</div>
            <div>产品</div>
            <div>供应商</div>
            <div>批次</div>
            <div>规格</div>
            <div className="text-right">数量</div>
            <div>单位</div>
            <div className="text-right">进货价</div>
            <div className="text-right">销售价</div>
            <div className="text-right">金额</div>
            <div className="text-center">操作</div>
          </div>
          {fields.map((field, index) => {
            const itemAmount = calculateItemAmount(index);
            const lineSummary = getLineSummary(form, index);
            const itemErrors = form.formState.errors.items?.[index];
            const piecesPerUnit =
              Number(form.watch(`items.${index}.piecesPerUnit`) || 0) || 0;
            const currentUnit = String(
              form.watch(`items.${index}.unit`) || '片'
            );
            const showPiecesPerUnit = currentUnit === '件' || piecesPerUnit > 0;
            const hasExtraInfo =
              showPiecesPerUnit || lineSummary.remarks.length > 0;
            const isExpanded = expandedRows[field.id] ?? hasExtraInfo;
            const isDuplicate = duplicateRowIndexes?.has(index) ?? false;

            return (
              <div
                key={field.id}
                className={cn(
                  'bg-[hsl(var(--color-bg-card))] px-3 py-2 transition-colors',
                  index > 0 &&
                    'border-t border-[hsl(var(--color-border-secondary))]',
                  isDuplicate &&
                    'bg-red-50/70 ring-1 ring-inset ring-red-200'
                )}
              >
                <div className="flex flex-col gap-3 border-b border-[hsl(var(--color-border-secondary))] pb-3 md:flex-row md:items-center md:justify-between lg:hidden">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-xs font-medium tracking-[0.08em] text-[hsl(var(--color-text-secondary))]">
                      第 {index + 1} 行
                    </span>
                    {isDuplicate && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-600">
                        重复产品
                      </span>
                    )}
                    <span className="min-w-0 truncate text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                      {lineSummary.displayName || '未选择产品'}
                    </span>
                    {lineSummary.productCode && (
                      <span className="text-xs text-[hsl(var(--color-text-secondary))]">
                        编码：{lineSummary.productCode}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-4 md:justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-[hsl(var(--color-text-secondary))]"
                      onClick={() =>
                        setExpandedRows(prev => ({
                          ...prev,
                          [field.id]: !isExpanded,
                        }))
                      }
                    >
                      补充信息
                      <ChevronDown
                        className={`ml-1 h-4 w-4 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-red-500 hover:bg-red-50 hover:text-red-600"
                      onClick={() => onRemoveItem(index)}
                      aria-label={`删除第 ${index + 1} 行`}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      删除
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:mt-0 lg:grid-cols-[56px_minmax(220px,2fr)_minmax(180px,1.6fr)_110px_110px_84px_76px_96px_96px_104px_92px] lg:gap-2">
                  <div className="hidden lg:flex lg:h-8 lg:items-center lg:justify-center lg:text-xs lg:font-medium lg:text-[hsl(var(--color-text-secondary))]">
                    <span
                      className={cn(
                        'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2',
                        isDuplicate && 'bg-red-100 text-red-600'
                      )}
                    >
                      {index + 1}
                    </span>
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-medium text-[hsl(var(--color-text-primary))] lg:hidden">
                      产品 <span className="text-destructive">*</span>
                    </div>
                    <div className="space-y-1.5">
                      <IntelligentProductInput
                        form={form}
                        index={index}
                        products={products}
                        onProductChange={onProductChange(index)}
                        placeholder="搜索产品"
                        enableTemporaryProducts
                      />
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

                  <div>
                    <div className="mb-1 text-xs font-medium text-[hsl(var(--color-text-primary))] lg:hidden">
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

                  <div>
                    <FormField
                      control={form.control}
                      name={`items.${index}.batchNumber`}
                      render={({ field }) => (
                        <FormItem>
                          <div className="mb-1 text-xs font-medium text-[hsl(var(--color-text-primary))] lg:hidden">
                            批次
                          </div>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value || ''}
                              placeholder="批次号"
                              className="h-8 text-sm"
                            />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div>
                    <FormField
                      control={form.control}
                      name={`items.${index}.specification`}
                      render={({ field }) => (
                        <FormItem>
                          <div className="mb-1 text-xs font-medium text-[hsl(var(--color-text-primary))] lg:hidden">
                            规格
                          </div>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value || ''}
                              placeholder="规格"
                              className="h-8 text-sm"
                            />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="hidden lg:block">
                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value || ''}
                              onChange={e =>
                                field.onChange(parseFloat(e.target.value) || 0)
                              }
                              placeholder="数量"
                              className="h-8 text-right text-sm font-medium"
                            />
                          </FormControl>
                          <FormMessage className="pt-1 text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="hidden lg:block">
                    <FormField
                      control={form.control}
                      name={`items.${index}.unit`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Select
                              value={field.value || '片'}
                              onValueChange={newUnit => {
                                const oldUnit = field.value || '片';
                                const piecesPerUnit =
                                  Number(
                                    form.getValues(
                                      `items.${index}.piecesPerUnit`
                                    ) || 0
                                  ) || 0;
                                const currentSalePrice =
                                  Number(
                                    form.getValues(
                                      `items.${index}.unitPrice`
                                    ) || 0
                                  ) || 0;
                                const currentCostPrice =
                                  Number(
                                    form.getValues(`items.${index}.unitCost`) ||
                                      0
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
                                          (
                                            currentSalePrice * piecesPerUnit
                                          ).toFixed(2)
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
                                          (
                                            currentSalePrice / piecesPerUnit
                                          ).toFixed(4)
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
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="片">片</SelectItem>
                                <SelectItem value="件">件</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage className="pt-1 text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="hidden lg:block">
                    <FormField
                      control={form.control}
                      name={`items.${index}.unitCost`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="number"
                              step={COST_PRICE_STEP}
                              min="0"
                              {...field}
                              value={
                                field.value === undefined ||
                                Number.isNaN(field.value)
                                  ? ''
                                  : field.value
                              }
                              onChange={e => {
                                const value = e.target.value;
                                field.onChange(
                                  value === ''
                                    ? undefined
                                    : Number.parseFloat(value)
                                );
                              }}
                              placeholder="进货价"
                              className="h-8 text-right text-sm"
                            />
                          </FormControl>
                          <FormMessage className="pt-1 text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="hidden lg:block">
                    <FormField
                      control={form.control}
                      name={`items.${index}.unitPrice`}
                      render={({ field }) => (
                        <FormItem>
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
                              placeholder="销售价"
                              className="h-8 text-right text-sm"
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
                                  field.onChange(
                                    Number.isNaN(parsed) ? 0 : parsed
                                  );
                                }
                                field.onBlur();
                              }}
                            />
                          </FormControl>
                          <FormMessage className="pt-1 text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="hidden lg:block">
                    <div className="flex h-8 items-center justify-end rounded-md border border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))]/60 px-2 text-sm font-semibold text-orange-600">
                      ￥{itemAmount.toFixed(2)}
                    </div>
                  </div>

                  <div className="hidden lg:block">
                    <div className="flex items-center justify-center gap-1 pt-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[hsl(var(--color-text-secondary))]"
                        onClick={() =>
                          setExpandedRows(prev => ({
                            ...prev,
                            [field.id]: !isExpanded,
                          }))
                        }
                      >
                        {isExpanded ? '收起' : '补充'}
                        <ChevronDown
                          className={`ml-1 h-4 w-4 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                        onClick={() => onRemoveItem(index)}
                        aria-label={`删除第 ${index + 1} 行`}
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:hidden">
                  <FormField
                    control={form.control}
                    name={`items.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem>
                        <div className="mb-1 text-xs font-medium text-[hsl(var(--color-text-primary))]">
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
                            className="h-8 text-right text-sm font-medium"
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
                        <div className="mb-1 text-xs font-medium text-[hsl(var(--color-text-primary))]">
                          单位
                        </div>
                        <FormControl>
                          <Select
                            value={field.value || '片'}
                            onValueChange={newUnit => {
                              const oldUnit = field.value || '片';
                              const piecesPerUnit =
                                Number(
                                  form.getValues(
                                    `items.${index}.piecesPerUnit`
                                  ) || 0
                                ) || 0;
                              const currentSalePrice =
                                Number(
                                  form.getValues(`items.${index}.unitPrice`) ||
                                    0
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
                                        (
                                          currentSalePrice * piecesPerUnit
                                        ).toFixed(2)
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
                                        (
                                          currentSalePrice / piecesPerUnit
                                        ).toFixed(4)
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
                            <SelectTrigger className="h-8 text-sm">
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
                        <div className="mb-1 text-xs font-medium text-[hsl(var(--color-text-primary))]">
                          进货价
                        </div>
                        <FormControl>
                          <Input
                            type="number"
                            step={COST_PRICE_STEP}
                            min="0"
                            {...field}
                            value={
                              field.value === undefined ||
                              Number.isNaN(field.value)
                                ? ''
                                : field.value
                            }
                            onChange={e => {
                              const value = e.target.value;
                              field.onChange(
                                value === ''
                                  ? undefined
                                  : Number.parseFloat(value)
                              );
                            }}
                            placeholder="进货价"
                            className="h-8 text-right text-sm"
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
                        <div className="mb-1 text-xs font-medium text-[hsl(var(--color-text-primary))]">
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
                            className="h-8 text-right text-sm"
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
                                field.onChange(
                                  Number.isNaN(parsed) ? 0 : parsed
                                );
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
                    <div className="mb-1 text-xs font-medium text-[hsl(var(--color-text-primary))]">
                      金额
                    </div>
                    <div className="flex h-8 items-center justify-end rounded-md border border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))]/60 px-3 text-sm font-semibold text-orange-600">
                      ￥{itemAmount.toFixed(2)}
                    </div>
                  </div>
                </div>

                <Collapsible
                  open={isExpanded}
                  onOpenChange={open =>
                    setExpandedRows(prev => ({ ...prev, [field.id]: open }))
                  }
                >
                  <CollapsibleContent className="mt-3 space-y-3 lg:mt-2 lg:border-t lg:border-[hsl(var(--color-border-secondary))] lg:pt-3 lg:pl-[68px]">
                    <div
                      className={`grid gap-3 ${
                        showPiecesPerUnit
                          ? 'lg:grid-cols-[minmax(160px,0.8fr)_minmax(0,1.4fr)]'
                          : ''
                      }`}
                    >
                      {showPiecesPerUnit && (
                        <FormField
                          control={form.control}
                          name={`items.${index}.piecesPerUnit`}
                          render={({ field }) => (
                            <FormItem>
                              <div className="mb-1 text-xs font-medium text-[hsl(var(--color-text-primary))]">
                                每件片数
                              </div>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  step="1"
                                  {...field}
                                  value={
                                    field.value === undefined ||
                                    field.value === null
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
                                  className="h-8 text-right text-sm"
                                />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={form.control}
                        name={`items.${index}.remarks`}
                        render={({ field }) => (
                          <FormItem>
                            <div className="mb-1 text-xs font-medium text-[hsl(var(--color-text-primary))]">
                              备注
                            </div>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value || ''}
                                placeholder="备注，可不填"
                                className="h-8 text-sm"
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
