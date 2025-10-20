import { Building2, Calculator } from 'lucide-react';
import type { Control, Path } from 'react-hook-form';

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
import { ADJUST_REASON_LABELS } from '@/lib/validations/inventory-operations';

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

        {mode === 'outbound' && (
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
