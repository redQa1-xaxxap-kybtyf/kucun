'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';

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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  getSupplier,
  supplierQueryKeys,
  updateSupplier,
} from '@/lib/api/suppliers';
import {
  UpdateSupplierSchema,
  supplierUpdateDefaults,
  type SupplierUpdateFormData,
} from '@/lib/validations/supplier';

interface EditSupplierPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function EditSupplierPage({ params }: EditSupplierPageProps) {
  const router = useRouter();
  const { id } = use(params);
  const { toast } = useToast();

  const HeaderCard = ({ subtitle }: { subtitle: ReactNode }) => (
    <Card className="overflow-hidden">
      <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-[0_10px_24px_rgba(9,88,217,0.22)]">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                编辑供应商
              </h1>
              <div className="text-sm text-[hsl(var(--color-text-secondary))]">
                {subtitle}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="lg"
            asChild
            className="h-11 gap-2 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:border-[hsl(var(--color-border-strong))] hover:shadow-[var(--shadow-medium)]"
          >
            <Link href="/suppliers">
              <ArrowLeft className="h-4 w-4" />
              返回
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // 获取供应商详情
  const {
    data: supplierData,
    isLoading: isLoadingSupplier,
    error,
  } = useQuery({
    queryKey: supplierQueryKeys.detail(id),
    queryFn: () => getSupplier(id),
  });

  // 表单配置
  const form = useForm<SupplierUpdateFormData>({
    resolver: zodResolver(UpdateSupplierSchema),
    defaultValues: supplierUpdateDefaults,
  });

  // 当供应商数据加载完成时，填充表单
  useEffect(() => {
    if (supplierData?.data) {
      const supplier = supplierData.data;
      form.reset({
        name: supplier.name,
        phone: supplier.phone || '',
        address: supplier.address || '',
        status: supplier.status,
      });
    }
  }, [supplierData, form]);

  // 更新供应商
  const updateMutation = useMutation({
    mutationFn: (data: SupplierUpdateFormData) => updateSupplier(id, data),
    onSuccess: data => {
      toast({
        title: '更新成功',
        description: data.message || '供应商更新成功',
        variant: 'success',
      });
      router.push('/suppliers');
    },
    onError: error => {
      toast({
        title: '更新失败',
        description: error.message || '更新供应商失败',
        variant: 'destructive',
      });
    },
  });

  // 提交表单
  const onSubmit = (data: SupplierUpdateFormData) => {
    // 清理空字符串
    const submitData = {
      name: data.name,
      phone: data.phone || undefined,
      address: data.address || undefined,
      status: data.status,
    };

    updateMutation.mutate(submitData);
  };

  const isLoading = updateMutation.isPending;

  // 加载中
  if (isLoadingSupplier) {
    return (
      <div className="flex h-full flex-col overflow-auto p-6">
        <div className="space-y-6">
          <HeaderCard subtitle="加载供应商信息中..." />
        </div>
      </div>
    );
  }

  // 错误处理
  if (error) {
    return (
      <div className="flex h-full flex-col overflow-auto p-6">
        <div className="space-y-6">
          <HeaderCard
            subtitle={
              <span className="text-[hsl(var(--color-error))]">
                加载失败: {error.message}
              </span>
            }
          />
        </div>
      </div>
    );
  }

  // 供应商不存在
  if (!supplierData?.data) {
    return (
      <div className="flex h-full flex-col overflow-auto p-6">
        <div className="space-y-6">
          <HeaderCard
            subtitle={
              <span className="text-[hsl(var(--color-error))]">
                供应商不存在
              </span>
            }
          />
        </div>
      </div>
    );
  }

  const supplier = supplierData.data;

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面标题卡片 */}
        <HeaderCard
          subtitle={<>修改供应商 &ldquo;{supplier.name}&rdquo; 的信息</>}
        />

        {/* 表单 */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-gradient-to-r from-[hsl(var(--color-bg-secondary))] to-[hsl(var(--color-bg-tertiary))]">
            <CardTitle className="flex items-center text-[hsl(var(--color-text-primary))]">
              <Building2 className="mr-2 h-5 w-5 text-[hsl(var(--color-primary))]" />
              基本信息
            </CardTitle>
            <CardDescription>
              填写供应商的基本信息，包括名称、联系方式和地址
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                {/* 供应商名称 */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>供应商名称 *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="请输入供应商名称"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        供应商的正式名称，最多100个字符
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 联系电话 */}
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
                      <FormDescription>
                        供应商的联系电话，支持手机和固话格式
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 地址 */}
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>地址</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="请输入供应商地址"
                          disabled={isLoading}
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        供应商的详细地址，最多200个字符
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 状态 */}
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>状态</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择状态" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">活跃</SelectItem>
                          <SelectItem value="inactive">停用</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>供应商的当前状态</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* 操作按钮 */}
        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => router.push('/suppliers')}
                disabled={isLoading}
                className="h-11 gap-2 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:border-[hsl(var(--color-border-strong))] hover:shadow-[var(--shadow-medium)]"
              >
                <ArrowLeft className="h-4 w-4" />
                取消
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={isLoading}
                onClick={form.handleSubmit(onSubmit)}
                className="h-11 gap-2 bg-[hsl(var(--color-primary))] text-white shadow-[var(--shadow-medium)] transition-transform hover:-translate-y-0.5 hover:bg-[hsl(var(--color-primary-hover))] hover:shadow-[var(--shadow-heavy)] focus-visible:ring-[hsl(var(--color-primary))]"
              >
                {isLoading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    更新中...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    更新供应商
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
