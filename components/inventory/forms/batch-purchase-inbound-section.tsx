'use client';

import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { ProductSelector } from '@/components/inventory/product-selector';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { calculateAcceptedInboundQuantity } from '@/hooks/use-inbound-form';
import type {
  InboundDamageHandling,
  InboundUnit,
  ProductOption,
} from '@/lib/types/inbound';
import { cn } from '@/lib/utils';

type BatchPurchaseInboundField =
  | 'productId'
  | 'batchNumber'
  | 'inputQuantity'
  | 'piecesPerUnit'
  | 'weight'
  | 'unitCost'
  | 'damagedInputQuantity'
  | 'damageHandling'
  | 'damageRemarks';

export interface BatchPurchaseInboundRow {
  id: string;
  productId: string;
  batchNumber: string;
  inputQuantity?: number;
  inputUnit: InboundUnit;
  piecesPerUnit?: number;
  weight?: number;
  unitCost?: number;
  damagedInputQuantity?: number;
  damageHandling?: InboundDamageHandling;
  damageRemarks: string;
}

export type BatchPurchaseInboundRowErrors = Partial<
  Record<BatchPurchaseInboundField, string>
>;

function createRowId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createBatchPurchaseInboundRow(): BatchPurchaseInboundRow {
  return {
    id: createRowId(),
    productId: '',
    batchNumber: '',
    inputQuantity: undefined,
    inputUnit: 'pieces',
    piecesPerUnit: undefined,
    weight: undefined,
    unitCost: undefined,
    damagedInputQuantity: undefined,
    damageHandling: undefined,
    damageRemarks: '',
  };
}

function parseOptionalNumber(value: string): number | undefined {
  if (value.trim() === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs font-medium text-red-500">{message}</p>;
}

interface BatchPurchaseInboundSectionProps {
  rows: BatchPurchaseInboundRow[];
  selectedProducts: Record<string, ProductOption | null>;
  rowErrors: Record<string, BatchPurchaseInboundRowErrors>;
  onAddRow: () => void;
  onRemoveRow: (rowId: string) => void;
  onProductSelect: (
    rowId: string,
    productId: string,
    product?: ProductOption
  ) => void;
  onFieldChange: <K extends keyof BatchPurchaseInboundRow>(
    rowId: string,
    field: K,
    value: BatchPurchaseInboundRow[K]
  ) => void;
}

export function BatchPurchaseInboundSection({
  rows,
  selectedProducts,
  rowErrors,
  onAddRow,
  onRemoveRow,
  onProductSelect,
  onFieldChange,
}: BatchPurchaseInboundSectionProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setExpandedRows(current =>
      Object.fromEntries(
        Object.entries(current).filter(([rowId]) =>
          rows.some(row => row.id === rowId)
        )
      )
    );
  }, [rows]);

  const toggleExpandedRow = (rowId: string) => {
    setExpandedRows(current => ({
      ...current,
      [rowId]: !current[rowId],
    }));
  };

  return (
    <div className="space-y-4">
      <Alert className="border-blue-200 bg-blue-50">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-800">
          同一供应商一次到多种货时，可以在这里一起录入；每件片数、重量、破损这些内容按需要再补。
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        {rows.map((row, index) => {
          const selectedProduct = selectedProducts[row.id] ?? null;
          const rowError = rowErrors[row.id] ?? {};
          const quantitySummary = calculateAcceptedInboundQuantity({
            reason: 'purchase',
            inputQuantity: row.inputQuantity,
            damagedInputQuantity: row.damagedInputQuantity,
            inputUnit: row.inputUnit,
            piecesPerUnit: row.piecesPerUnit,
          });
          const hasDamage =
            (row.damagedInputQuantity ?? 0) > 0 ||
            Boolean(row.damageHandling) ||
            Boolean(row.damageRemarks.trim());
          const showAdvancedSection =
            expandedRows[row.id] ||
            row.inputUnit === 'units' ||
            hasDamage ||
            row.weight !== undefined;
          const allowAdvancedToggle = row.inputUnit !== 'units';

          return (
            <div
              key={row.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">
                    第 {index + 1} 条明细
                  </p>
                  <p className="text-xs text-slate-500">
                    合格入库 {quantitySummary.quantity ?? 0} 片
                    {quantitySummary.damagedQuantity
                      ? ` · 破损 ${quantitySummary.damagedQuantity} 片`
                      : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {allowAdvancedToggle && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => toggleExpandedRow(row.id)}
                      className="border-dashed"
                    >
                      {showAdvancedSection ? (
                        <>
                          <ChevronUp className="mr-1 h-4 w-4" />
                          收起更多设置
                        </>
                      ) : (
                        <>
                          <ChevronDown className="mr-1 h-4 w-4" />
                          更多设置
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveRow(row.id)}
                    disabled={rows.length === 1}
                    className="text-slate-500 hover:text-red-600"
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    删除
                  </Button>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">
                      产品
                    </label>
                    <ProductSelector
                      value={row.productId}
                      onChange={(productId, product) =>
                        onProductSelect(row.id, productId, product)
                      }
                      placeholder="搜索产品名称、编码..."
                      error={Boolean(rowError.productId)}
                    />
                    <FieldError message={rowError.productId} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">
                      批次号/色号
                    </label>
                    <Input
                      value={row.batchNumber}
                      placeholder="请输入批次号"
                      onChange={event =>
                        onFieldChange(row.id, 'batchNumber', event.target.value)
                      }
                    />
                    <FieldError message={rowError.batchNumber} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">
                      到货数量
                    </label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={row.inputQuantity ?? ''}
                      placeholder="请输入数量"
                      onChange={event =>
                        onFieldChange(
                          row.id,
                          'inputQuantity',
                          parseOptionalNumber(event.target.value)
                        )
                      }
                    />
                    <FieldError message={rowError.inputQuantity} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">
                      录入单位
                    </label>
                    <Select
                      value={row.inputUnit}
                      onValueChange={value =>
                        onFieldChange(row.id, 'inputUnit', value as InboundUnit)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择单位" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pieces">片</SelectItem>
                        <SelectItem value="units">件</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">
                      单位成本(元/片)
                    </label>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.001"
                      value={row.unitCost ?? ''}
                      placeholder="请输入成本"
                      onChange={event =>
                        onFieldChange(
                          row.id,
                          'unitCost',
                          parseOptionalNumber(event.target.value)
                        )
                      }
                    />
                    <FieldError message={rowError.unitCost} />
                  </div>
                </div>

                {selectedProduct && (
                  <div className="grid gap-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-xs text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <span className="text-slate-400">产品编码</span>
                      <p className="mt-1 font-semibold text-slate-900">
                        {selectedProduct.code}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">规格</span>
                      <p className="mt-1 font-semibold text-slate-900">
                        {selectedProduct.specification || '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">现有批次规格</span>
                      <p className="mt-1 font-semibold text-slate-900">
                        {selectedProduct.batchSpecs?.length
                          ? selectedProduct.batchSpecs.length === 1
                            ? `${selectedProduct.batchSpecs[0].piecesPerUnit} 片/件`
                            : `${selectedProduct.batchSpecs.length} 个历史批次`
                          : '还没有历史批次'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">当前库存</span>
                      <p className="mt-1 font-semibold text-emerald-700">
                        {selectedProduct.currentStock || 0} 片
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 xl:grid-cols-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      合格入库
                    </p>
                    <p className="mt-1 text-base font-semibold text-slate-900">
                      {quantitySummary.quantity ?? '—'} 片
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      数量填写方式
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {row.inputUnit === 'units'
                        ? `按件录入${row.piecesPerUnit ? `，每件 ${row.piecesPerUnit} 片` : '，请确认装箱数'}`
                        : '按片直接录入'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      到货破损
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {hasDamage
                        ? `已登记 ${quantitySummary.damagedQuantity ?? 0} 片`
                        : '无破损可跳过'}
                    </p>
                  </div>
                </div>

                {showAdvancedSection && (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-4">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {row.inputUnit === 'units' ? (
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-slate-700">
                            装箱数 *
                          </label>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            value={row.piecesPerUnit ?? ''}
                            placeholder="请输入每件多少片"
                            onChange={event =>
                              onFieldChange(
                                row.id,
                                'piecesPerUnit',
                                parseOptionalNumber(event.target.value)
                              )
                            }
                          />
                          <FieldError message={rowError.piecesPerUnit} />
                        </div>
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-500">
                          当前按片录入，无需填写装箱数；如需按件录入，可把上方录入单位切换为“件”。
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">
                          本次每件重量(kg)
                        </label>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={row.weight ?? ''}
                          placeholder="不填则本次不记录重量"
                          onChange={event =>
                            onFieldChange(
                              row.id,
                              'weight',
                              parseOptionalNumber(event.target.value)
                            )
                          }
                        />
                        <FieldError message={rowError.weight} />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">
                          到货破损数量
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={row.damagedInputQuantity ?? ''}
                          placeholder="无破损可留空"
                          onChange={event =>
                            onFieldChange(
                              row.id,
                              'damagedInputQuantity',
                              parseOptionalNumber(event.target.value)
                            )
                          }
                        />
                        <FieldError message={rowError.damagedInputQuantity} />
                      </div>
                    </div>

                    {hasDamage && (
                      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">
                              破损处理
                            </label>
                            <Select
                              value={row.damageHandling}
                              onValueChange={value =>
                                onFieldChange(
                                  row.id,
                                  'damageHandling',
                                  value as InboundDamageHandling
                                )
                              }
                              disabled={!row.damagedInputQuantity}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="有破损时必须选择" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="supplier_claim">
                                  报工厂赔付
                                </SelectItem>
                                <SelectItem value="internal_loss">
                                  内部承担
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FieldError message={rowError.damageHandling} />
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">
                              破损说明
                            </label>
                            <Textarea
                              value={row.damageRemarks}
                              placeholder="例如：边角破损 2 件，报工厂赔付。"
                              className="min-h-[84px] resize-none"
                              onChange={event =>
                                onFieldChange(
                                  row.id,
                                  'damageRemarks',
                                  event.target.value
                                )
                              }
                            />
                            <FieldError message={rowError.damageRemarks} />
                          </div>
                        </div>

                        <div className="grid gap-3 self-start rounded-xl border border-slate-200 bg-white p-3 text-sm">
                          <div>
                            <p className="text-xs font-bold text-slate-400">
                              合格入库
                            </p>
                            <p
                              className={cn(
                                'mt-1 text-lg font-semibold',
                                quantitySummary.quantity &&
                                  quantitySummary.quantity > 0
                                  ? 'text-slate-900'
                                  : 'text-slate-400'
                              )}
                            >
                              {quantitySummary.quantity ?? '—'} 片
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-400">
                              破损折算
                            </p>
                            <p className="mt-1 text-lg font-semibold text-amber-600">
                              {quantitySummary.damagedQuantity ?? 0} 片
                            </p>
                          </div>
                          {rowError.inputQuantity || rowError.damageHandling ? (
                            <p className="text-xs font-medium text-red-500">
                              请先修正本条数据再提交
                            </p>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onAddRow}
        className="w-full border-dashed"
      >
        <Plus className="mr-2 h-4 w-4" />
        再添加一条产品明细
      </Button>
    </div>
  );
}
