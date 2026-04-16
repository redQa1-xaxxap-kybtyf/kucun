import { Package } from 'lucide-react';
import { useWatch, type Control, type Path } from 'react-hook-form';

import { ProductSelector } from '@/components/products/product-selector';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  FormControl,
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
import {
  INBOUND_REASON_OPTIONS,
  INBOUND_UNIT_OPTIONS,
} from '@/lib/types/inbound';
import { COST_PRICE_STEP } from '@/lib/utils/cost-price';

import type {
  FormValuesByMode,
  OperationMode,
} from '../hooks/useInventoryOperationForm';

type TypeOption = { value: string; label: string };

interface InventoryBasicInfoFormProps<M extends OperationMode> {
  control: Control<FormValuesByMode[M]>;
  mode: M;
  typeOptions: TypeOption[];
  isLoading: boolean;
}

export function InventoryBasicInfoForm<M extends OperationMode>({
  control,
  mode,
  typeOptions,
  isLoading,
}: InventoryBasicInfoFormProps<M>) {
  const outboundControl = control as unknown as Control<
    FormValuesByMode['outbound']
  >;
  const watchedOutboundType = useWatch({
    control: outboundControl,
    name: 'type',
  });
  const outboundType = mode === 'outbound' ? watchedOutboundType : undefined;
  const outboundTypeDescription =
    outboundType && OUTBOUND_TYPE_DESCRIPTION_MAP[outboundType]
      ? OUTBOUND_TYPE_DESCRIPTION_MAP[outboundType]
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Package className="mr-2 h-5 w-5" />
          基础信息
        </CardTitle>
        <CardDescription>选择产品并填写基础信息</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderOperationTypeField({ control, mode, typeOptions, isLoading })}
        {mode === 'outbound' && outboundTypeDescription ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
            {outboundTypeDescription}
          </div>
        ) : null}
        <FormField
          control={control}
          name={'productId' as Path<FormValuesByMode[M]>}
          render={({ field }) => (
            <FormItem>
              <FormLabel>产品</FormLabel>
              <FormControl>
                <ProductSelector
                  value={field.value ? String(field.value) : ''}
                  onValueChange={field.onChange}
                  disabled={isLoading}
                  placeholder="选择产品"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {renderQuantitySection({ control, mode, isLoading })}
      </CardContent>
    </Card>
  );
}

const OUTBOUND_TYPE_DESCRIPTION_MAP: Record<string, string> = {
  normal_outbound:
    '用于普通手工出库或历史补录。若是客户样品，请选“样品出库”；若是展厅领样或内部消耗，请选“内部领用”。',
  sales_outbound:
    '用于没有挂销售单、但已经确定要发给客户的销售出库，需要选择客户。',
  sample_outbound: '用于客户样品领取，会纳入样品统计，需要选择客户。',
  internal_use_outbound:
    '用于展厅摆样、内部领料、内部送样等场景，不需要选择客户。',
  adjust_outbound:
    '仅用于特殊台账修正。常规破损、丢失或报废，建议走“报损处理”。',
};

function renderOperationTypeField<M extends OperationMode>({
  control,
  mode,
  typeOptions,
  isLoading,
}: {
  control: Control<FormValuesByMode[M]>;
  mode: M;
  typeOptions: TypeOption[];
  isLoading: boolean;
}) {
  if (mode === 'adjust') {
    return null;
  }

  if (mode === 'inbound') {
    return (
      <FormField
        control={control}
        name={'reason' as Path<FormValuesByMode[M]>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>入库原因</FormLabel>
            <Select
              onValueChange={field.onChange}
              value={field.value as string | undefined}
              disabled={isLoading}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="选择入库原因" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {INBOUND_REASON_OPTIONS.map(option => (
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

  const outboundOptions = typeOptions.length > 0 ? typeOptions : [];
  return (
    <FormField
      control={control}
      name={'type' as Path<FormValuesByMode[M]>}
      render={({ field }) => (
        <FormItem>
          <FormLabel>出库类型</FormLabel>
          <Select
            onValueChange={field.onChange}
            value={field.value as string | undefined}
            disabled={isLoading}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="选择出库类型" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {outboundOptions.map(option => (
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

function renderQuantitySection<M extends OperationMode>({
  control,
  mode,
  isLoading,
}: {
  control: Control<FormValuesByMode[M]>;
  mode: M;
  isLoading: boolean;
}) {
  if (mode === 'adjust') {
    return (
      <FormField
        control={control}
        name={'adjustQuantity' as Path<FormValuesByMode[M]>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>调整数量</FormLabel>
            <FormControl>
              <Input
                type="number"
                step="1"
                placeholder="正数增加，负数减少"
                disabled={isLoading}
                value={
                  field.value === undefined ? '' : String(field.value ?? '')
                }
                onChange={event => {
                  const value = Number(event.target.value);
                  field.onChange(Number.isNaN(value) ? field.value : value);
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }

  if (mode === 'inbound') {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          control={control}
          name={'inputQuantity' as Path<FormValuesByMode[M]>}
          render={({ field }) => (
            <FormItem>
              <FormLabel>入库数量</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="1"
                  placeholder="输入数量"
                  disabled={isLoading}
                  value={
                    field.value === undefined ? '' : String(field.value ?? '')
                  }
                  onChange={event => {
                    const value = Number(event.target.value);
                    field.onChange(Number.isNaN(value) ? field.value : value);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={'inputUnit' as Path<FormValuesByMode[M]>}
          render={({ field }) => (
            <FormItem>
              <FormLabel>入库单位</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value as string | undefined}
                disabled={isLoading}
              >
                <FormControl>
                  <SelectTrigger>
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
        <FormField
          control={control}
          name={'piecesPerUnit' as Path<FormValuesByMode[M]>}
          render={({ field }) => (
            <FormItem>
              <FormLabel>每单位片数</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="1"
                  placeholder="如：6"
                  disabled={isLoading}
                  value={
                    field.value === undefined ? '' : String(field.value ?? '')
                  }
                  onChange={event => {
                    const value = Number(event.target.value);
                    field.onChange(Number.isNaN(value) ? field.value : value);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={'weight' as Path<FormValuesByMode[M]>}
          render={({ field }) => (
            <FormItem>
              <FormLabel>本批次实际每件重量 (kg)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="不填则本次不记录重量"
                  disabled={isLoading}
                  value={
                    field.value === undefined ? '' : String(field.value ?? '')
                  }
                  onChange={event => {
                    const value = Number(event.target.value);
                    field.onChange(Number.isNaN(value) ? field.value : value);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FormField
        control={control}
        name={'quantity' as Path<FormValuesByMode[M]>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>出库数量</FormLabel>
            <FormControl>
              <Input
                type="number"
                min="1"
                placeholder="输入数量"
                disabled={isLoading}
                value={
                  field.value === undefined ? '' : String(field.value ?? '')
                }
                onChange={event => {
                  const value = Number(event.target.value);
                  field.onChange(Number.isNaN(value) ? field.value : value);
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={'unitCost' as Path<FormValuesByMode[M]>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>单位成本</FormLabel>
            <FormControl>
              <Input
                type="number"
                min="0"
                step={COST_PRICE_STEP}
                placeholder="输入单位成本"
                disabled={isLoading}
                value={
                  field.value === undefined ? '' : String(field.value ?? '')
                }
                onChange={event => {
                  const value = Number(event.target.value);
                  field.onChange(Number.isNaN(value) ? field.value : value);
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
