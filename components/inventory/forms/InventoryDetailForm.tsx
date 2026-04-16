import { Building2, Calculator } from 'lucide-react';
import { useWatch, type Control, type Path } from 'react-hook-form';

import { CustomerSelector } from '@/components/customers/customer-hierarchy';
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
import { Textarea } from '@/components/ui/textarea';
import {
  ADJUST_REASON_LABELS,
  MANUAL_DAMAGE_CATEGORY_LABELS,
  MANUAL_DAMAGE_HANDLING_LABELS,
} from '@/lib/validations/inventory-operations';

import type {
  FormValuesByMode,
  OperationMode,
} from '../hooks/useInventoryOperationForm';

interface InventoryDetailFormProps<M extends OperationMode> {
  control: Control<FormValuesByMode[M]>;
  mode: M;
  isLoading: boolean;
}

const adjustReasonOptions = Object.entries(ADJUST_REASON_LABELS).map(
  ([value, label]) => ({ value, label })
);

export function InventoryDetailForm<M extends OperationMode>({
  control,
  mode,
  isLoading,
}: InventoryDetailFormProps<M>) {
  const outboundControl =
    control as unknown as Control<FormValuesByMode['outbound']>;
  const adjustControl = control as unknown as Control<FormValuesByMode['adjust']>;
  const watchedOutboundType = useWatch({
    control: outboundControl,
    name: 'type',
  });
  const watchedAdjustReason = useWatch({
    control: adjustControl,
    name: 'reason',
  });
  const outboundType = mode === 'outbound' ? watchedOutboundType : undefined;
  const adjustReason = mode === 'adjust' ? watchedAdjustReason : undefined;
  const requiresCustomer =
    outboundType === 'sales_outbound' || outboundType === 'sample_outbound';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Calculator className="mr-2 h-5 w-5" />
          详细信息
        </CardTitle>
        <CardDescription>
          {mode === 'inbound'
            ? '入库相关详细信息'
            : mode === 'outbound'
              ? '出库相关详细信息'
              : '调整相关详细信息'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={control}
          name={'batchNumber' as Path<FormValuesByMode[M]>}
          render={({ field }) => (
            <FormItem>
              <FormLabel>批次号</FormLabel>
              <FormControl>
                <Input
                  placeholder="输入批次号"
                  disabled={isLoading}
                  value={typeof field.value === 'string' ? field.value : ''}
                  onChange={event => field.onChange(event.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {mode === 'outbound' && requiresCustomer && (
          <FormField
            control={
              control as unknown as Control<FormValuesByMode['outbound']>
            }
            name={'customerId' as Path<FormValuesByMode['outbound']>}
            render={() => (
              <FormItem>
                <FormLabel className="flex items-center">
                  <Building2 className="mr-2 h-4 w-4" />
                  客户
                </FormLabel>
                <FormControl>
                  <CustomerSelector<FormValuesByMode['outbound']>
                    control={
                      control as unknown as Control<
                        FormValuesByMode['outbound']
                      >
                    }
                    name={'customerId' as Path<FormValuesByMode['outbound']>}
                    placeholder="选择客户"
                    disabled={isLoading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {mode === 'outbound' && !requiresCustomer ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
            当前类型无需选择客户。若本次是发给客户的销售或客户样品，请回到上方改为“销售出库”或“样品出库”。
          </div>
        ) : null}

        {mode === 'adjust' && (
          <FormField
            control={control}
            name={'reason' as Path<FormValuesByMode[M]>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>调整原因</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value as string | undefined}
                  disabled={isLoading}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择调整原因" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {adjustReasonOptions.map(option => (
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
        )}

        {mode === 'adjust' && adjustReason === 'damage_loss' ? (
          <>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              报损保存后会自动登记到“手工报损台账”。如果后续需要找工厂赔付，在这里先选好处理方式，后面台账里可以继续跟进。
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={control}
                name={'damageCategory' as Path<FormValuesByMode[M]>}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>报损类型</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value as string | undefined}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="请选择报损类型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(MANUAL_DAMAGE_CATEGORY_LABELS).map(
                          ([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={'damageHandling' as Path<FormValuesByMode[M]>}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>处理方式</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value as string | undefined}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="请选择处理方式" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(MANUAL_DAMAGE_HANDLING_LABELS).map(
                          ([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </>
        ) : null}

        <FormField
          control={control}
          name={
            (mode === 'adjust' ? 'notes' : 'remarks') as Path<
              FormValuesByMode[M]
            >
          }
          render={({ field }) => (
            <FormItem>
              <FormLabel>{mode === 'adjust' ? '调整备注' : '备注'}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="输入备注信息"
                  className="min-h-[80px]"
                  disabled={isLoading}
                  value={typeof field.value === 'string' ? field.value : ''}
                  onChange={event => field.onChange(event.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
