'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Loader2,
  Plus,
  Save,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

// UI Components
import { CustomerSelector } from '@/components/customers/customer-hierarchy';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
// API and Types
import {
  createCustomer,
  customerQueryKeys,
  updateCustomer,
} from '@/lib/api/customers';
import {
  type Customer,
  type CustomerCreateInput,
  type CustomerUpdateInput,
  CUSTOMER_LEVEL_LABELS,
  CUSTOMER_TYPE_LABELS,
} from '@/lib/types/customer';
import {
  type CustomerCreateFormData,
  type CustomerUpdateFormData,
  customerCreateDefaults,
  customerCreateSchema,
  customerUpdateSchema,
  parseExtendedInfo,
  processExtendedInfo,
} from '@/lib/validations/customer';

interface CustomerFormProps {
  mode: 'create' | 'edit';
  initialData?: Customer;
  onSuccess?: (customer: Customer) => void;
  onCancel?: () => void;
}

export function CustomerForm({
  mode,
  initialData,
  onSuccess,
  onCancel,
}: CustomerFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string>('');

  // 表单配置
  const isEdit = mode === 'edit';
  const schema = isEdit ? customerUpdateSchema : customerCreateSchema;

  // 解析初始数据的扩展信息
  const initialExtendedInfo = initialData?.extendedInfo
    ? parseExtendedInfo(initialData.extendedInfo)
    : customerCreateDefaults.extendedInfo;

  const form = useForm<CustomerCreateFormData | CustomerUpdateFormData>({
    resolver: zodResolver(schema),
    defaultValues:
      isEdit && initialData
        ? {
            id: initialData.id,
            name: initialData.name,
            phone: initialData.phone || '',
            address: initialData.address || '',
            parentCustomerId: initialData.parentCustomerId || '',
            extendedInfo: {
              ...customerCreateDefaults.extendedInfo,
              ...initialExtendedInfo,
            },
          }
        : {
            ...customerCreateDefaults,
            name: '',
          },
  });

  // 创建客户 Mutation
  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: response => {
      queryClient.invalidateQueries({ queryKey: customerQueryKeys.lists() });
      if (onSuccess) {
        onSuccess(response);
      } else {
        router.push('/customers');
      }
    },
    onError: error => {
      setSubmitError(error instanceof Error ? error.message : '创建客户失败');
    },
  });

  // 更新客户 Mutation
  const updateMutation = useMutation({
    mutationFn: (data: CustomerUpdateInput) =>
      updateCustomer(initialData!.id, data),
    onSuccess: response => {
      queryClient.invalidateQueries({ queryKey: customerQueryKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: customerQueryKeys.detail(response.id),
      });
      if (onSuccess) {
        onSuccess(response);
      } else {
        router.push('/customers');
      }
    },
    onError: error => {
      setSubmitError(error instanceof Error ? error.message : '更新客户失败');
    },
  });

  const isLoading = createMutation.isPending || updateMutation.isPending;

  // 表单提交
  const onSubmit = async (
    data: CustomerCreateFormData | CustomerUpdateFormData
  ) => {
    setSubmitError('');

    try {
      // 处理扩展信息
      const processedData = {
        ...data,
        extendedInfo: processExtendedInfo(data.extendedInfo),
      };

      if (isEdit) {
        await updateMutation.mutateAsync(processedData as CustomerUpdateInput);
      } else {
        await createMutation.mutateAsync(processedData as CustomerCreateInput);
      }
    } catch (error) {
      // 错误已在 mutation 的 onError 中处理
    }
  };

  // 取消操作
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.push('/customers');
    }
  };

  // 标签管理
  const [newTag, setNewTag] = useState('');

  const addTag = () => {
    if (!newTag.trim()) return;

    const currentTags = form.getValues('extendedInfo.tags') || [];
    if (currentTags.includes(newTag.trim())) return;

    form.setValue('extendedInfo.tags', [...currentTags, newTag.trim()]);
    setNewTag('');
  };

  const removeTag = (tagToRemove: string) => {
    const currentTags = form.getValues('extendedInfo.tags') || [];
    form.setValue(
      'extendedInfo.tags',
      currentTags.filter(tag => tag !== tagToRemove)
    );
  };

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={handleCancel}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isEdit ? '编辑客户' : '新增客户'}
            </h1>
            <p className="text-muted-foreground">
              {isEdit ? '修改客户信息和扩展资料' : '创建新的客户档案'}
            </p>
          </div>
        </div>
      </div>

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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building2 className="mr-2 h-5 w-5" />
                基础信息
              </CardTitle>
              <CardDescription>
                客户的基本信息，包括名称、联系方式等
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>客户名称 *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="如：广州瓷砖批发市场"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        客户的完整名称或公司名称
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>联系电话</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="如：13800138000"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>主要联系电话</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>客户地址</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="客户的详细地址..."
                        className="min-h-[80px]"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>客户的详细地址信息</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 上级客户选择 */}
              <CustomerSelector
                control={form.control}
                name="parentCustomerId"
                label="上级客户"
                placeholder="选择上级客户（可选）"
                disabled={isLoading}
                excludeId={initialData?.id}
                onlyParents={false}
              />
            </CardContent>
          </Card>

          {/* 扩展信息 */}
          <Card>
            <CardHeader>
              <CardTitle>扩展信息</CardTitle>
              <CardDescription>客户的详细资料和业务信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 联系信息 */}
              <div>
                <h4 className="mb-3 text-sm font-medium">联系信息</h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="extendedInfo.email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>邮箱地址</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="如：contact@example.com"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="extendedInfo.fax"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>传真号码</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="如：020-12345678"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="extendedInfo.website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>网站地址</FormLabel>
                        <FormControl>
                          <Input
                            type="url"
                            placeholder="如：https://www.example.com"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* 业务信息 */}
              <div>
                <h4 className="mb-3 text-sm font-medium">业务信息</h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="extendedInfo.customerType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>客户类型</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={isLoading}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择客户类型" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(CUSTOMER_TYPE_LABELS).map(
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
                    control={form.control}
                    name="extendedInfo.level"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>客户等级</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={isLoading}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择客户等级" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(CUSTOMER_LEVEL_LABELS).map(
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
                    control={form.control}
                    name="extendedInfo.industry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>所属行业</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="如：建材批发"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="extendedInfo.region"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>所在区域</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="如：华南地区"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="extendedInfo.creditLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>信用额度 (元)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="如：100000"
                            disabled={isLoading}
                            {...field}
                            onChange={e => {
                              const value = e.target.value;
                              field.onChange(
                                value ? parseFloat(value) : undefined
                              );
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="extendedInfo.paymentTerms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>付款条件</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="如：月结30天"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* 标签管理 */}
              <div>
                <h4 className="mb-3 text-sm font-medium">客户标签</h4>
                <div className="space-y-3">
                  {/* 现有标签 */}
                  <div className="flex flex-wrap gap-2">
                    {(form.watch('extendedInfo.tags') || []).map(
                      (tag, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          {tag}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-4 h-auto w-4 p-0"
                            onClick={() => removeTag(tag)}
                            disabled={isLoading}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      )
                    )}
                  </div>

                  {/* 添加新标签 */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="添加标签..."
                      value={newTag}
                      onChange={e => setNewTag(e.target.value)}
                      onKeyPress={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      disabled={isLoading}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addTag}
                      disabled={isLoading || !newTag.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 备注信息 */}
              <FormField
                control={form.control}
                name="extendedInfo.notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>备注信息</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="客户的其他备注信息..."
                        className="min-h-[100px]"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      记录客户的特殊要求、合作历史等信息
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 操作按钮 */}
          <div className="flex items-center justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              取消
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              {isEdit ? '保存修改' : '创建客户'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
