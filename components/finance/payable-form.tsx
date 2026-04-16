'use client';

import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  AlertCircle,
  Building2,
  Calendar as CalendarIcon,
  CreditCard,
  FileText,
} from 'lucide-react';

import { SupplierSelector } from '@/components/suppliers/supplier-selector';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePayableForm } from '@/hooks/use-payable-form';
import {
  PAYABLE_SOURCE_TYPE_LABELS,
  PAYABLE_STATUS_LABELS,
  type PayableRecordDetail,
} from '@/lib/types/payable';
import { cn } from '@/lib/utils';

interface PayableFormProps {
  mode: 'create' | 'edit';
  payableId?: string;
  initialData?: PayableRecordDetail;
  onSuccess?: (payable: PayableRecordDetail) => void;
  onCancel?: () => void;
}

export function PayableForm({
  mode,
  payableId,
  initialData,
  onSuccess,
  onCancel,
}: PayableFormProps) {
  const { form, isEdit, isLoading, submitError, onSubmit, handleCancel } =
    usePayableForm({
      mode,
      payableId,
      initialData,
      onSuccess,
      onCancel,
    });

  return (
    <div className="space-y-6">
      {/* 错误提示 */}
      {submitError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* 基础信息 */}
          <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
            <CardHeader className="border-b bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
              <CardTitle className="flex items-center text-[hsl(var(--color-text-primary))]">
                <Building2 className="mr-2 h-5 w-5 text-[hsl(var(--color-primary))]" />
                基础信息
              </CardTitle>
              <CardDescription>
                填写应付款的基本信息，包括供应商、来源和金额
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* 供应商选择 */}
                <FormField
                  control={form.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>供应商 *</FormLabel>
                      <FormControl>
                        <SupplierSelector
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={isLoading || isEdit}
                          placeholder="选择供应商..."
                        />
                      </FormControl>
                      <FormDescription>选择应付款对应的供应商</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 来源类型 */}
                <FormField
                  control={form.control}
                  name="sourceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>来源类型 *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={isLoading || isEdit}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择来源类型" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(PAYABLE_SOURCE_TYPE_LABELS).map(
                            ([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription>应付款的来源类型</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 应付金额 */}
                <FormField
                  control={form.control}
                  name="payableAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>应付金额 *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          disabled={isLoading}
                          {...field}
                          onChange={e =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormDescription>应付款的总金额（元）</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 到期日期 */}
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>到期日期</FormLabel>
                      <FormControl>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full justify-start text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                              disabled={isLoading}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? (
                                format(new Date(field.value), 'PPP', {
                                  locale: zhCN,
                                })
                              ) : (
                                <span>选择日期</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={
                                field.value ? new Date(field.value) : undefined
                              }
                              onSelect={date =>
                                field.onChange(
                                  date ? format(date, 'yyyy-MM-dd') : ''
                                )
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </FormControl>
                      <FormDescription>应付款的到期日期</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 来源单号 */}
                {!isEdit && (
                  <FormField
                    control={form.control}
                    name="sourceNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>来源单号</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="输入来源单号"
                            disabled={isLoading}
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormDescription>
                          关联的采购订单或其他单据号
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* 付款条件 */}
                <FormField
                  control={form.control}
                  name="paymentTerms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>付款条件</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="例如：货到付款、月结30天"
                          disabled={isLoading}
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormDescription>约定的付款条件或账期</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 状态（仅编辑模式） */}
                {isEdit && (
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>状态</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          disabled={isLoading}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(PAYABLE_STATUS_LABELS).map(
                              ([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                        <FormDescription>应付款的当前状态</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* 详细信息 */}
          <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
            <CardHeader className="border-b bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
              <CardTitle className="flex items-center text-[hsl(var(--color-text-primary))]">
                <FileText className="mr-2 h-5 w-5 text-[hsl(var(--color-primary))]" />
                详细信息
              </CardTitle>
              <CardDescription>填写应付款的描述和备注信息</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                {/* 描述 */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>描述</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="输入应付款的详细描述..."
                          disabled={isLoading}
                          rows={3}
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormDescription>
                        应付款的详细说明（最多500字符）
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
                      <FormLabel>备注</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="输入备注信息..."
                          disabled={isLoading}
                          rows={3}
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormDescription>
                        其他需要记录的信息（最多1000字符）
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* 表单操作 */}
          <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
            <CardContent className="p-6">
              <div className="flex items-center justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isLoading}
                  size="lg"
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  size="lg"
                  className="min-w-[120px]"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  {isLoading ? '保存中...' : isEdit ? '保存修改' : '登记应付款'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}
