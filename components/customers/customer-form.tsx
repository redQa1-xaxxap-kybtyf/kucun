/* eslint-disable max-lines-per-function */
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

// UI Components
import { InlineLoading } from '@/components/common/loading';
import { CustomerBasicInfoSection } from '@/components/customers/customer-form/CustomerBasicInfoSection';
import { CustomerExtendedInfoSection } from '@/components/customers/customer-form/CustomerExtendedInfoSection';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
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
} from '@/lib/types/customer';
import { logger } from '@/lib/utils/console-logger';
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

  // 明确表单类型,避免联合类型导致的类型推断问题
  type FormData = typeof isEdit extends true
    ? CustomerUpdateFormData
    : CustomerCreateFormData;

  const form = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues:
      isEdit && initialData
        ? ({
            id: initialData.id,
            name: initialData.name,
            phone: initialData.phone || '',
            address: initialData.address || '',
            parentCustomerId: initialData.parentCustomerId || '',
            extendedInfo: {
              ...customerCreateDefaults.extendedInfo,
              ...initialExtendedInfo,
            },
          } as FormData)
        : ({
            ...customerCreateDefaults,
            name: '',
            parentCustomerId: '',
          } as FormData),
  });

  // 创建客户 Mutation
  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: response => {
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户创建客户后立即看到新记录
      queryClient.refetchQueries({
        queryKey: customerQueryKeys.lists(),
        type: 'active',
      });
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
    mutationFn: (data: CustomerUpdateInput) => {
      if (!initialData) {
        throw new Error('缺少客户初始数据');
      }
      return updateCustomer(initialData.id, data);
    },
    onSuccess: response => {
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户更新客户后立即看到变化
      queryClient.refetchQueries({
        queryKey: customerQueryKeys.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: customerQueryKeys.detail(response.id),
        type: 'active',
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
      logger.error('customer-form', '客户信息提交失败', error);
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
    if (!newTag.trim()) {
      return;
    }

    const extendedInfo = form.getValues('extendedInfo');
    const currentTags = extendedInfo?.tags || [];
    if (currentTags.includes(newTag.trim())) {
      return;
    }

    form.setValue('extendedInfo', {
      ...extendedInfo,
      tags: [...currentTags, newTag.trim()],
    });
    setNewTag('');
  };

  const removeTag = (tagToRemove: string) => {
    const extendedInfo = form.getValues('extendedInfo');
    const currentTags = extendedInfo?.tags || [];
    form.setValue('extendedInfo', {
      ...extendedInfo,
      tags: currentTags.filter(tag => tag !== tagToRemove),
    });
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
          <CustomerBasicInfoSection
            form={form as never}
            isLoading={isLoading}
            excludeCustomerId={initialData?.id}
          />

          <CustomerExtendedInfoSection
            form={form as never}
            isLoading={isLoading}
            newTag={newTag}
            onNewTagChange={setNewTag}
            onAddTag={addTag}
            onRemoveTag={removeTag}
          />

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
              {isLoading && <InlineLoading size="sm" className="mr-2" />}
              <Save className="mr-2 h-4 w-4" />
              {isEdit ? '保存修改' : '创建客户'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
