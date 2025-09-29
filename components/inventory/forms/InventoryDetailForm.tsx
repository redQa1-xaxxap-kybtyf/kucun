/**
 * 库存操作详细信息表单组件
 * 包含批次号、供应商/客户、位置、备注等详细字段
 */

import { Building2, Calculator } from 'lucide-react';
import type { Control, FieldValues, Path } from 'react-hook-form';

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

import { type OperationMode } from '../hooks/useInventoryOperationForm';

interface InventoryDetailFormProps<T extends FieldValues> {
  control: Control<T>;
  mode: OperationMode;
  isLoading: boolean;
}

export function InventoryDetailForm<T extends FieldValues>({
  control,
  mode,
  isLoading,
}: InventoryDetailFormProps<T>) {
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
        {/* 批次号 */}
        <FormField
          control={control}
          name={'batchNumber' as Path<T>}
          render={({ field }) => (
            <FormItem>
              <FormLabel>批次号</FormLabel>
              <FormControl>
                <Input
                  placeholder="输入批次号"
                  disabled={isLoading}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 存储位置（仅入库和出库模式） */}
        {(mode === 'inbound' || mode === 'outbound') && (
          <FormField
            control={control}
            name={'location' as Path<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>存储位置</FormLabel>
                <FormControl>
                  <Input
                    placeholder="如：A区-1排-3层"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* 供应商/客户选择 */}
        {(mode === 'inbound' || mode === 'outbound') && (
          <FormField
            control={control}
            name={(mode === 'inbound' ? 'supplierId' : 'customerId') as Path<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center">
                  <Building2 className="mr-2 h-4 w-4" />
                  {mode === 'inbound' ? '供应商' : '客户'}
                </FormLabel>
                <FormControl>
                  <CustomerSelector
                    control={control}
                    name={field.name}
                    disabled={isLoading}
                    placeholder={`选择${mode === 'inbound' ? '供应商' : '客户'}`}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* 调整原因（仅调整模式） */}
        {mode === 'adjust' && (
          <FormField
            control={control}
            name={'reason' as Path<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>调整原因</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={isLoading}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择调整原因" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="inventory_gain">盘盈</SelectItem>
                    <SelectItem value="inventory_loss">盘亏</SelectItem>
                    <SelectItem value="damage_loss">报损</SelectItem>
                    <SelectItem value="surplus_gain">报溢</SelectItem>
                    <SelectItem value="transfer">调拨</SelectItem>
                    <SelectItem value="other">其他</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* 备注 */}
        <FormField
          control={control}
          name={'notes' as Path<T>}
          render={({ field }) => (
            <FormItem>
              <FormLabel>备注</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="其他备注信息..."
                  className="min-h-[80px]"
                  disabled={isLoading}
                  {...field}
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
