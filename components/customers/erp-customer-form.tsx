'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useForm, type UseFormReturn } from 'react-hook-form';

import { PageHeader } from '@/components/common/page-header';
import {
  AddressSelector,
  formatAddressString,
  type AddressData,
} from '@/components/ui/address-selector';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  createCustomer,
  customerQueryKeys,
  updateCustomer,
} from '@/lib/api/customers';
import type {
  Customer,
  CustomerExtendedInfo,
  CustomerUpdateInput,
} from '@/lib/types/customer';
import {
  customerCreateSchema as CreateCustomerSchema,
  customerCreateDefaults,
  parseExtendedInfo,
  processExtendedInfo,
  type CustomerCreateFormData as CreateCustomerData,
} from '@/lib/validations/customer';

interface ERPCustomerFormProps {
  mode?: 'create' | 'edit';
  initialData?: Customer;
  onSuccess?: () => void;
  onCancel?: () => void;
}

type CustomerFormInstance = UseFormReturn<CreateCustomerData>;

function normalizeExtendedInfo(
  extendedInfo?: CreateCustomerData['extendedInfo']
): CustomerExtendedInfo | undefined {
  if (!extendedInfo) {
    return undefined;
  }
  const processed = processExtendedInfo(extendedInfo);
  if (!processed) {
    return undefined;
  }
  try {
    return JSON.parse(processed) as CustomerExtendedInfo;
  } catch {
    return undefined;
  }
}

function buildAddressValue(address: CreateCustomerData['address']): string {
  if (typeof address === 'string') {
    return address;
  }
  if (address) {
    return formatAddressString(address as AddressData);
  }
  return '';
}

function useCustomerFormActions({
  mode,
  initialData,
  onSuccess,
  router,
  toast,
  queryClient,
}: {
  mode: ERPCustomerFormProps['mode'];
  initialData?: Customer;
  onSuccess?: () => void;
  router: ReturnType<typeof useRouter>;
  toast: ReturnType<typeof useToast>['toast'];
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: data => {
      toast({
        title: '创建成功',
        description: `客户 "${data.name}" 创建成功！`,
        variant: 'success',
      });
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户创建客户后立即看到新记录
      queryClient.refetchQueries({
        queryKey: customerQueryKeys.all,
        type: 'active',
      });
      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/customers');
      }
    },
    onError: error => {
      toast({
        title: '创建失败',
        description: error instanceof Error ? error.message : '创建失败',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CustomerUpdateInput) =>
      updateCustomer(initialData?.id || '', data),
    onSuccess: data => {
      toast({
        title: '更新成功',
        description: `客户 "${data.name}" 更新成功！`,
        variant: 'success',
      });
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户更新客户后立即看到变化
      queryClient.refetchQueries({
        queryKey: customerQueryKeys.all,
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: customerQueryKeys.detail(initialData?.id || ''),
        type: 'active',
      });
      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/customers');
      }
    },
    onError: error => {
      toast({
        title: '更新失败',
        description: error instanceof Error ? error.message : '更新失败',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (data: CreateCustomerData) => {
    const extendedInfoPayload = normalizeExtendedInfo(data.extendedInfo);
    if (mode === 'edit' && initialData) {
      updateMutation.mutate({
        id: initialData.id,
        name: data.name,
        phone: data.phone || '',
        address: buildAddressValue(data.address),
        extendedInfo: extendedInfoPayload,
      });
    } else {
      createMutation.mutate({
        name: data.name,
        phone: data.phone || '',
        address: buildAddressValue(data.address),
        extendedInfo: extendedInfoPayload,
      });
    }
  };

  const handleCancel = (onCancel?: () => void) => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  return {
    handleSubmit,
    handleCancel,
    isLoading: createMutation.isPending || updateMutation.isPending,
  };
}

function BasicInfoSection({
  form,
  isLoading,
}: {
  form: CustomerFormInstance;
  isLoading: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>客户名称 *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="请输入客户名称"
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
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>联系电话</FormLabel>
                <FormControl>
                  <Input
                    placeholder="请输入联系电话"
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
            name="extendedInfo.phone2"
            render={({ field }) => (
              <FormItem>
                <FormLabel>备用电话1</FormLabel>
                <FormControl>
                  <Input
                    placeholder="请输入备用电话（可选）"
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
            name="extendedInfo.phone3"
            render={({ field }) => (
              <FormItem>
                <FormLabel>备用电话2</FormLabel>
                <FormControl>
                  <Input
                    placeholder="请输入备用电话（可选）"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
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
              <FormLabel>地址</FormLabel>
              <FormControl>
                <AddressSelector
                  value={field.value}
                  onChange={addressData => {
                    const addressString = formatAddressString(addressData);
                    field.onChange(addressString);
                  }}
                  showLabel={false}
                  disabled={isLoading}
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

function FormActions({
  isLoading,
  mode,
  onCancel,
}: {
  isLoading: boolean;
  mode: ERPCustomerFormProps['mode'];
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-3">
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={onCancel}
        disabled={isLoading}
        className="h-10 gap-2 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:border-[hsl(var(--color-border-strong))] hover:shadow-[var(--shadow-medium)]"
      >
        <ArrowLeft className="h-4 w-4" />
        取消
      </Button>
      <Button
        type="submit"
        size="lg"
        disabled={isLoading}
        className="h-10 gap-2 bg-[hsl(var(--color-primary))] text-white shadow-[var(--shadow-medium)] transition-transform hover:-translate-y-0.5 hover:bg-[hsl(var(--color-primary-hover))] hover:shadow-[var(--shadow-heavy)] focus-visible:ring-[hsl(var(--color-primary))]"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {mode === 'create' ? '保存中...' : '保存中...'}
          </>
        ) : (
          <>
            <Save className="h-4 w-4" />
            {mode === 'create' ? '新建客户' : '保存修改'}
          </>
        )}
      </Button>
    </div>
  );
}

/**
 * 客户表单组件
 * ✅ 统一 UI 样式，与产品管理表单保持一致
 */
export function ERPCustomerForm({
  mode = 'create',
  initialData,
  onSuccess,
  onCancel,
}: ERPCustomerFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<CreateCustomerData>({
    resolver: standardSchemaResolver(CreateCustomerSchema),
    defaultValues: {
      ...customerCreateDefaults,
      name: initialData?.name || '',
      phone: initialData?.phone || '',
      address: initialData?.address || '',
      extendedInfo: {
        ...(customerCreateDefaults.extendedInfo ?? {}),
        ...(typeof initialData?.extendedInfo === 'string'
          ? parseExtendedInfo(initialData.extendedInfo)
          : {}),
      },
    },
  });

  const {
    handleSubmit: submitCustomer,
    handleCancel,
    isLoading,
  } = useCustomerFormActions({
    mode,
    initialData,
    onSuccess,
    router,
    toast,
    queryClient,
  });

  const onSubmit = submitCustomer;

  const isEdit = mode === 'edit';

  return (
    <>
      <PageHeader
        title={isEdit ? '编辑客户' : '新建客户'}
        description={isEdit ? '修改客户信息' : '创建新的客户记录'}
        icon={<Users className="h-6 w-6 text-white" />}
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <BasicInfoSection form={form} isLoading={isLoading} />

          <Card className="overflow-hidden">
            <CardContent className="p-4">
              <FormActions
                isLoading={isLoading}
                mode={mode}
                onCancel={() => handleCancel(onCancel)}
              />
            </CardContent>
          </Card>
        </form>
      </Form>
    </>
  );
}
