'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';

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
import { useToast } from '@/components/ui/use-toast';
import { invalidateFinanceCaches } from '@/lib/cache/invalidation-helpers';
import { queryKeys } from '@/lib/queryKeys';
import {
  EXPENSE_RELATED_TYPE_OPTIONS,
  EXPENSE_TYPE_OPTIONS,
  type ExpenseRecord,
} from '@/lib/types/expense';
import { cn } from '@/lib/utils';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';
import {
  expenseFormSchema,
  type ExpenseFormData,
} from '@/lib/validations/expense';

import { RelatedRecordSelector } from './related-record-selector';

type ExpenseRequestPayload = {
  expenseType: ExpenseFormData['expenseType'];
  expenseName: string;
  expenseAmount: number;
  expenseDate: string;
  relatedType: ExpenseFormData['relatedType'] | null;
  relatedId: string | null;
  relatedNumber: string | null;
  remarks: string | null;
};

interface ExpenseFormProps {
  mode: 'create' | 'edit';
  expenseId?: string;
  initialData?: ExpenseRecord;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ExpenseForm({
  mode,
  expenseId,
  initialData,
  onSuccess,
  onCancel,
}: ExpenseFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const NO_RELATED_TYPE_VALUE = 'none';
  const isEditMode = mode === 'edit';
  const isApproved = isEditMode && initialData?.status === 'approved';

  // ✅ 使用不含 transform 的 expenseFormSchema,避免类型推断问题
  const form = useForm<ExpenseFormData>({
    resolver: standardSchemaResolver(expenseFormSchema),
    mode: 'onBlur', // ✅ 用户离开字段时验证
    reValidateMode: 'onChange', // ✅ 提交后实时验证
    criteriaMode: 'all', // ✅ 显示所有错误
    shouldFocusError: true,
    defaultValues: {
      expenseType: 'shipping',
      expenseName: '',
      expenseAmount: 0,
      expenseDate: format(new Date(), 'yyyy-MM-dd'),
      relatedType: undefined,
      relatedId: undefined,
      relatedNumber: '',
      remarks: '',
    },
  });

  React.useEffect(() => {
    if (isEditMode && initialData) {
      form.reset({
        expenseType: initialData.expenseType,
        expenseName: initialData.expenseName,
        expenseAmount: initialData.expenseAmount,
        expenseDate: initialData.expenseDate.split('T')[0],
        relatedType: initialData.relatedType ?? undefined,
        relatedId: initialData.relatedId ?? undefined,
        relatedNumber: initialData.relatedNumber ?? '',
        remarks: initialData.remarks ?? '',
      });
    }
  }, [form, initialData, isEditMode]);

  const watchedRelatedType = form.watch('relatedType');

  React.useEffect(() => {
    if (!watchedRelatedType) {
      form.setValue('relatedNumber', '');
      form.setValue('relatedId', undefined);
    }
  }, [watchedRelatedType, form]);

  const invalidateExpenseQueries = React.useCallback(() => {
    // ✅ P0修复: 使用 exact: false 失效所有以 ['finance', 'expenses'] 开头的查询
    // 修复前：只失效 ['finance', 'expenses'] 精确键，无法失效列表查询
    // 修复后：失效所有 ['finance', 'expenses', ...] 查询，包括列表和统计
    queryClient.invalidateQueries({
      queryKey: queryKeys.finance.expenses(),
      exact: false,
    });

    // ✅ 刷新财务概览和仪表盘（费用会影响财务数据）
    invalidateFinanceCaches(queryClient);
  }, [queryClient]);

  const buildPayload = React.useCallback(
    (formData: ExpenseFormData): ExpenseRequestPayload => {
      const trimmedRelatedNumber = formData.relatedNumber?.trim() ?? '';
      const trimmedRelatedId = formData.relatedId?.trim() ?? '';
      const trimmedRemarks = formData.remarks?.trim() ?? '';
      const hasRelation = Boolean(formData.relatedType);

      return {
        expenseType: formData.expenseType,
        expenseName: formData.expenseName,
        expenseAmount: Number(formData.expenseAmount),
        expenseDate: formData.expenseDate,
        relatedType: formData.relatedType ?? null,
        relatedNumber: hasRelation ? trimmedRelatedNumber || null : null,
        relatedId: hasRelation ? trimmedRelatedId || null : null,
        remarks: trimmedRemarks || null,
      };
    },
    []
  );

  const createMutation = useMutation({
    mutationFn: async (payload: ExpenseRequestPayload) => {
      const response = await fetch(
        '/api/finance/expenses',
        getCsrfTokenHeader({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '创建费用记录失败');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '创建成功',
        description:
          '费用记录已保存为草稿；审核生效后才会计入月报、年报和盈亏分析。',
      });
      invalidateExpenseQueries();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: '创建失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: ExpenseRequestPayload) => {
      if (!expenseId) {
        throw new Error('缺少费用记录ID');
      }

      const response = await fetch(
        `/api/finance/expenses/${expenseId}`,
        getCsrfTokenHeader({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '更新费用记录失败');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '更新成功',
        description: isApproved
          ? '费用记录已更新，相关报表会自动刷新。'
          : '费用记录已更新；未审核费用仍不会计入正式报表。',
      });
      invalidateExpenseQueries();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: '更新失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = async (data: ExpenseFormData) => {
    setIsSubmitting(true);
    const payload = buildPayload(data);

    try {
      if (isEditMode) {
        await updateMutation.mutateAsync(payload);
      } else {
        await createMutation.mutateAsync(payload);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditMode ? '编辑费用记录' : '新增费用记录'}</CardTitle>
        <CardDescription>
          正式财务报表仅统计已审核费用。草稿费用需要在列表点击“审核生效”后才会进入月报、年报和盈亏分析；采购订单费用按成本口径处理，不重复计入期间费用。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* 费用类型 */}
              <FormField
                control={form.control}
                name="expenseType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>费用类型 *</FormLabel>
                    <Select
                      key={`expenseType-${field.value}`}
                      onValueChange={field.onChange}
                      value={field.value}
                      defaultValue={field.value}
                      disabled={isApproved}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="请选择费用类型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EXPENSE_TYPE_OPTIONS.map(option => (
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

              {/* 费用名称 */}
              <FormField
                control={form.control}
                name="expenseName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>费用名称 *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="请输入费用名称"
                        {...field}
                        maxLength={100}
                        disabled={isApproved}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 费用金额 */}
              <FormField
                control={form.control}
                name="expenseAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>费用金额 *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        min="0.01"
                        max="99999999.99"
                        value={field.value ?? ''}
                        onChange={e =>
                          field.onChange(
                            e.target.value === ''
                              ? undefined
                              : Number.parseFloat(e.target.value)
                          )
                        }
                        disabled={isApproved}
                      />
                    </FormControl>
                    <FormDescription>最大金额：99,999,999.99</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 费用日期 */}
              <FormField
                control={form.control}
                name="expenseDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>费用日期 *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                            disabled={isApproved}
                          >
                            {field.value ? (
                              format(new Date(field.value), 'yyyy-MM-dd')
                            ) : (
                              <span>选择日期</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
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
                          disabled={date => date > new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 关联业务类型 */}
              <FormField
                control={form.control}
                name="relatedType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>关联业务类型</FormLabel>
                    <Select
                      onValueChange={value =>
                        field.onChange(
                          value === NO_RELATED_TYPE_VALUE ? undefined : value
                        )
                      }
                      value={field.value ?? NO_RELATED_TYPE_VALUE}
                      disabled={isApproved}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="请选择关联业务类型（可选）" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_RELATED_TYPE_VALUE}>
                          无关联
                        </SelectItem>
                        {EXPENSE_RELATED_TYPE_OPTIONS.map(option => (
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

              {/* 关联单据选择器 */}
              {watchedRelatedType && (
                <FormField
                  control={form.control}
                  name="relatedId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>关联单据 *</FormLabel>
                      <FormControl>
                        <RelatedRecordSelector
                          relatedType={watchedRelatedType}
                          value={field.value}
                          onChange={value => {
                            if (isApproved) return;
                            field.onChange(value);
                          }}
                          onRecordSelect={record => {
                            // 自动填充关联业务编号
                            if (!isApproved) {
                              form.setValue('relatedNumber', record.number);
                            }
                          }}
                        />
                      </FormControl>
                      <FormDescription>选择要关联的业务单据</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* 备注 */}
            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>备注</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="请输入备注信息（可选）"
                      className="min-h-[100px]"
                      {...field}
                      maxLength={1000}
                    />
                  </FormControl>
                  <FormDescription>最多 1000 个字符</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isSubmitting ? '提交中...' : isEditMode ? '保存变更' : '提交'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
