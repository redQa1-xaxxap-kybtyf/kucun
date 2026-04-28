'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
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
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { queryKeys } from '@/lib/queryKeys';
import { COUNT_TYPE_OPTIONS } from '@/lib/types/inventory-count';
import { cn } from '@/lib/utils';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';
import {
  inventoryCountFormSchema,
  type InventoryCountFormData,
} from '@/lib/validations/inventory-count';

const NO_CATEGORY_VALUE = 'none';

interface CountFormProps {
  mode: 'create' | 'edit';
  countId?: string;
  initialData?: InventoryCountFormData;
  onSuccess?: (countId: string) => void;
  onCancel?: () => void;
}

export function CountForm({
  mode,
  countId,
  initialData,
  onSuccess,
  onCancel,
}: CountFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // 查询分类列表
  const { data: categoriesData } = useQuery({
    queryKey: queryKeys.categories.list({ status: 'active' }),
    queryFn: async () => {
      const response = await fetch('/api/categories?status=active');
      if (!response.ok) {
        throw new Error('获取分类列表失败');
      }
      return response.json();
    },
  });

  const categoryOptions = (
    Array.isArray(categoriesData?.data) ? categoriesData?.data : []
  ) as {
    id: string;
    name: string;
  }[];

  // ✅ 表单配置 - 使用统一的 InventoryCountFormData 类型
  const form = useForm<InventoryCountFormData>({
    resolver: standardSchemaResolver(inventoryCountFormSchema),
    mode: 'onBlur', // ✅ 用户离开字段时验证
    reValidateMode: 'onChange', // ✅ 提交后实时验证
    criteriaMode: 'all', // ✅ 显示所有错误
    shouldFocusError: true,
    defaultValues: initialData || {
      countName: '',
      countType: 'full',
      planDate: format(new Date(), 'yyyy-MM-dd'),
      location: '',
      categoryId: undefined,
      remarks: '',
    },
  });

  // 创建盘点单
  const createMutation = useMutation({
    mutationFn: async (data: InventoryCountFormData) => {
      const response = await fetch(
        '/api/inventory/counts',
        getCsrfTokenHeader({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '创建盘点单失败');
      }

      return response.json();
    },
    onSuccess: data => {
      toast({
        title: '创建成功',
        description: '盘点单已成功创建',
      });

      // ✅ 使用 refetchQueries 强制立即刷新，确保用户创建盘点计划后立即看到新记录
      queryClient.refetchQueries({
        queryKey: queryKeys.inventory.counts(),
        type: 'active',
      });

      onSuccess?.(data.data.id);
    },
    onError: (error: Error) => {
      toast({
        title: '创建失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // 更新盘点单
  const updateMutation = useMutation({
    mutationFn: async (data: InventoryCountFormData) => {
      const response = await fetch(
        `/api/inventory/counts/${countId}`,
        getCsrfTokenHeader({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '更新盘点单失败');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '更新成功',
        description: '盘点单已成功更新',
      });

      // ✅ 使用 refetchQueries 强制立即刷新，确保用户更新盘点计划后立即看到变化
      queryClient.refetchQueries({
        queryKey: queryKeys.inventory.counts(),
        type: 'active',
      });
      if (countId) {
        queryClient.refetchQueries({
          queryKey: queryKeys.inventory.count(countId),
          type: 'active',
        });
      }

      onSuccess?.(countId || '');
    },
    onError: (error: Error) => {
      toast({
        title: '更新失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // 提交表单
  const onSubmit = async (data: InventoryCountFormData) => {
    setIsSubmitting(true);
    try {
      if (mode === 'create') {
        await createMutation.mutateAsync(data);
      } else {
        await updateMutation.mutateAsync(data);
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  const hasUnsavedChanges = form.formState.isDirty && !isSubmitting;
  const { confirmLeavePage } = useUnsavedChangesGuard({
    enabled: hasUnsavedChanges,
    message: '当前盘点单尚未保存，确定要离开吗？',
  });

  const handleCancel = () => {
    if (!confirmLeavePage()) {
      return;
    }

    if (onCancel) {
      onCancel();
      return;
    }

    router.back();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === 'create' ? '新建盘点单' : '编辑盘点单'}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* 盘点单名称 */}
              <FormField
                control={form.control}
                name="countName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>盘点单名称 *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="请输入盘点单名称"
                        {...field}
                        maxLength={200}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 盘点类型 */}
              <FormField
                control={form.control}
                name="countType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>盘点类型 *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="请选择盘点类型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COUNT_TYPE_OPTIONS.map(option => (
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

              {/* 计划日期 */}
              <FormField
                control={form.control}
                name="planDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>计划日期 *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? (
                              format(new Date(field.value), 'yyyy-MM-dd')
                            ) : (
                              <span>请选择日期</span>
                            )}
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
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 库位 / 存放区域 */}
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>库位/存放区域</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="请输入库位或存放区域（选填）"
                        {...field}
                        maxLength={100}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 盘点分类 */}
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>盘点分类</FormLabel>
                    <Select
                      onValueChange={value =>
                        field.onChange(
                          value === NO_CATEGORY_VALUE ? undefined : value
                        )
                      }
                      value={field.value ?? NO_CATEGORY_VALUE}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="请选择分类（可选）" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_CATEGORY_VALUE}>
                          不选择
                        </SelectItem>
                        {categoryOptions.map(category => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 操作按钮 */}
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isSubmitting ? '提交中...' : '提交'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
