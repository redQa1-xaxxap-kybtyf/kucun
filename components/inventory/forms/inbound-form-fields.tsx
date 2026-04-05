'use client';

import { useSession } from 'next-auth/react';
import { useMemo } from 'react';
import { type UseFormReturn } from 'react-hook-form';

import { SupplierSelector } from '@/components/suppliers/supplier-selector';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
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
import { can } from '@/lib/auth/permissions';
import {
  INBOUND_DAMAGE_HANDLING_OPTIONS,
  type InboundFormData,
  INBOUND_REASON_OPTIONS,
  INBOUND_UNIT_OPTIONS,
} from '@/lib/types/inbound';
import { COST_PRICE_STEP } from '@/lib/utils/cost-price';
import { formatCurrency, formatNumber } from '@/lib/utils/format';

// ✅ 修复: 使用泛型参数以兼容 standardSchemaResolver
interface InboundFormFieldsProps {
  form: UseFormReturn<InboundFormData, any, any>;
}

function parseOptionalNumber(value: string): number | undefined {
  if (value.trim() === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function InboundQuantityFields({ form }: InboundFormFieldsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {/* 入库数量 */}
      <FormField
        control={form.control}
        name="inputQuantity"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-semibold text-gray-900">
              入库数量 *
            </FormLabel>
            <FormControl>
              <Input
                type="number"
                min="1"
                step="1"
                placeholder="请输入数量"
                className="h-9"
                name={field.name}
                ref={field.ref}
                value={field.value ?? ''}
                onBlur={field.onBlur}
                onChange={event =>
                  field.onChange(parseOptionalNumber(event.target.value))
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 入库单位 */}
      <FormField
        control={form.control}
        name="inputUnit"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-semibold text-gray-900">
              入库单位 *
            </FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="选择单位" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {INBOUND_UNIT_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 最终片数 */}
      <FormField
        control={form.control}
        name="quantity"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium text-gray-600">
              最终片数
            </FormLabel>
            <FormControl>
              <Input
                type="number"
                readOnly
                className="bg-muted h-9"
                name={field.name}
                ref={field.ref}
                value={field.value && field.value > 0 ? field.value : ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

export function InboundSpecificationFields({ form }: InboundFormFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* 每件片数 */}
      <FormField
        control={form.control}
        name="piecesPerUnit"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-semibold text-gray-900">
              装箱数 *
            </FormLabel>
            <FormControl>
              <Input
                type="number"
                min="1"
                step="1"
                placeholder="请输入装箱数"
                className="h-9"
                name={field.name}
                ref={field.ref}
                value={field.value ?? ''}
                onBlur={field.onBlur}
                onChange={event =>
                  field.onChange(parseOptionalNumber(event.target.value))
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 每件重量 */}
      <FormField
        control={form.control}
        name="weight"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-black text-slate-700">
              每件重量 (kg) *
            </FormLabel>
            <FormControl>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="请输入每件重量"
                className="h-9"
                name={field.name}
                ref={field.ref}
                value={field.value ?? ''}
                onBlur={field.onBlur}
                onChange={event =>
                  field.onChange(parseOptionalNumber(event.target.value))
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

export function InboundReasonField({ form }: InboundFormFieldsProps) {
  const { data: session } = useSession();
  const user = session?.user;

  // 根据用户权限过滤入库原因选项
  const availableReasons = useMemo(() => {
    // 如果用户没有期初库存权限，过滤掉 opening_balance
    if (!user || !can(user, 'inventory:opening_balance')) {
      return INBOUND_REASON_OPTIONS.filter(r => r.value !== 'opening_balance');
    }

    return INBOUND_REASON_OPTIONS;
  }, [user]);

  return (
    <FormField
      control={form.control}
      name="reason"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-sm font-semibold text-gray-900">
            入库原因 *
          </FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <FormControl>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="选择入库原因" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {availableReasons.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function InboundCostField({ form }: InboundFormFieldsProps) {
  return (
    <FormField
      control={form.control}
      name="unitCost"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-sm font-black text-slate-700">
            单位成本 (元/片) *
          </FormLabel>
          <FormControl>
            <Input
              type="number"
              min="0.01"
              step={COST_PRICE_STEP}
              placeholder="请输入每片成本"
              className="h-9"
              name={field.name}
              ref={field.ref}
              value={field.value ?? ''}
              onBlur={field.onBlur}
              onChange={event =>
                field.onChange(parseOptionalNumber(event.target.value))
              }
            />
          </FormControl>
          <FormDescription className="text-xs text-gray-500">
            请填写每片的成本。例如：每件100元，装箱数10，则单位成本为10元
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// 供应商选择字段
export function InboundSupplierField({ form }: InboundFormFieldsProps) {
  const currentReason = form.watch('reason');
  const isRequired = currentReason !== 'opening_balance';

  return (
    <FormField
      control={form.control}
      name="supplierId"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-sm font-semibold text-gray-900">
            供应商
            {isRequired && (
              <span className="ml-0.5 align-middle text-red-500">*</span>
            )}
          </FormLabel>
          <FormControl>
            <SupplierSelector
              value={field.value}
              onValueChange={field.onChange}
              placeholder="请选择供应商"
              onBlur={field.onBlur}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// 总价显示字段（只读）
export function InboundTotalCostField({ form }: InboundFormFieldsProps) {
  const watchedQuantity = form.watch('quantity');
  const watchedUnitCost = form.watch('unitCost');

  const totalCost = useMemo(() => {
    if (!watchedQuantity || !watchedUnitCost) return 0;
    return watchedQuantity * watchedUnitCost;
  }, [watchedQuantity, watchedUnitCost]);

  return (
    <FormField
      control={form.control}
      name="totalCost"
      render={() => (
        <FormItem>
          <FormLabel className="text-sm font-black text-slate-500">
            合规总价 (元)
          </FormLabel>
          <FormControl>
            <Input
              type="text"
              readOnly
              className="bg-muted h-9"
              value={totalCost > 0 ? `¥${totalCost.toFixed(2)}` : ''}
            />
          </FormControl>
          <FormDescription className="text-xs text-gray-500">
            自动计算：数量 × 单价
          </FormDescription>
        </FormItem>
      )}
    />
  );
}

export function InboundPurchaseDamageSection({
  form,
}: InboundFormFieldsProps) {
  const reason = form.watch('reason');
  const inputUnit = form.watch('inputUnit');
  const acceptedQuantity = form.watch('quantity') ?? 0;
  const damagedQuantity = form.watch('damagedQuantity') ?? 0;
  const unitCost = form.watch('unitCost') ?? 0;
  const damageHandling = form.watch('damageHandling');

  const summary = useMemo(() => {
    const arrivalQuantity = acceptedQuantity + damagedQuantity;
    const damageAmount =
      damagedQuantity > 0 && unitCost > 0 ? damagedQuantity * unitCost : 0;
    const damageAmountLabel =
      damageHandling === 'supplier_claim' ? '赔付参考' : '损耗参考';

    return {
      arrivalQuantity,
      damageAmount,
      damageAmountLabel,
    };
  }, [acceptedQuantity, damagedQuantity, damageHandling, unitCost]);

  if (reason !== 'purchase') {
    return null;
  }

  return (
    <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-6">
      <div className="rounded-2xl border border-amber-200 bg-white/70 p-4">
        <p className="text-sm font-black text-amber-900">采购到货破损登记</p>
        <p className="mt-1 text-xs font-medium text-amber-800">
          这里只登记到货当下已发现的破损。系统只把上方“入库数量”写入库存，破损数量仅用于采购追责与财务跟踪。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="damagedInputQuantity"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-black text-slate-700">
                到货破损数量
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="无破损可留空"
                  className="h-9 border-amber-200 bg-white/80"
                  name={field.name}
                  ref={field.ref}
                  value={field.value ?? ''}
                  onBlur={field.onBlur}
                  onChange={event =>
                    field.onChange(parseOptionalNumber(event.target.value))
                  }
                />
              </FormControl>
              <FormDescription className="text-xs text-amber-700">
                与上方入库单位保持一致，当前按“{inputUnit === 'units' ? '件' : '片'}”录入
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="damagedQuantity"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-slate-600">
                破损折算片数
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  readOnly
                  className="bg-muted h-9"
                  name={field.name}
                  ref={field.ref}
                  value={field.value && field.value > 0 ? field.value : ''}
                />
              </FormControl>
              <FormDescription className="text-xs text-slate-500">
                按同一装箱数自动折算，不计入库存
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="damageHandling"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-black text-slate-700">
                破损处理方式
              </FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
                disabled={!damagedQuantity}
              >
                <FormControl>
                  <SelectTrigger className="h-9 border-amber-200 bg-white/80">
                    <SelectValue placeholder="有破损时必须选择" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {INBOUND_DAMAGE_HANDLING_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-white/70 bg-white/80 p-4">
          <p className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
            合格入库
          </p>
          <p className="mt-1 text-lg font-black text-slate-900">
            {formatNumber(acceptedQuantity)}片
          </p>
        </div>
        <div className="rounded-xl border border-white/70 bg-white/80 p-4">
          <p className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
            到货合计
          </p>
          <p className="mt-1 text-lg font-black text-slate-900">
            {formatNumber(summary.arrivalQuantity)}片
          </p>
        </div>
        <div className="rounded-xl border border-white/70 bg-white/80 p-4">
          <p className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
            {summary.damageAmountLabel}
          </p>
          <p className="mt-1 text-lg font-black text-amber-700">
            {summary.damageAmount > 0
              ? formatCurrency(summary.damageAmount)
              : '—'}
          </p>
        </div>
      </div>

      <FormField
        control={form.control}
        name="damageRemarks"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-black text-slate-700">
              破损说明
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder="例如：角裂 2 件，报工厂补偿；外箱破损 1 件，不报工厂。"
                className="min-h-[88px] resize-none border-amber-200 bg-white/80"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

export function InboundOptionalFields({ form }: InboundFormFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* 批次号 - ✅ 修复：设为必填 */}
      <FormField
        control={form.control}
        name="batchNumber"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-semibold text-gray-900">
              批次号/色号 *
            </FormLabel>
            <FormControl>
              <Input
                placeholder="请输入批次号或色号"
                className="h-9"
                {...field}
              />
            </FormControl>
            <FormDescription className="text-xs text-gray-500">
              瓷砖行业要求：同一项目必须使用相同批次/色号
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 备注 */}
      <FormField
        control={form.control}
        name="remarks"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium text-gray-600">
              备注
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder="请输入备注信息（可选）"
                className="min-h-[36px] resize-none"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
