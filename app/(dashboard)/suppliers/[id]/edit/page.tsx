'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { getSupplier, updateSupplier, supplierQueryKeys } from '@/lib/api/suppliers';
import { 
  UpdateSupplierSchema, 
  supplierUpdateDefaults,
  formatSupplierStatus,
  type SupplierUpdateFormData 
} from '@/lib/schemas/supplier';

interface EditSupplierPageProps {
  params: {
    id: string;
  };
}

export default function EditSupplierPage({ params }: EditSupplierPageProps) {
  const router = useRouter();
  const { id } = params;

  // 获取供应商详情
  const { data: supplierData, isLoading: isLoadingSupplier, error } = useQuery({
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
    onSuccess: (data) => {
      toast.success(data.message || '供应商更新成功');
      router.push('/suppliers');
    },
    onError: (error) => {
      toast.error(error.message || '更新供应商失败');
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

  // 错误处理
  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center text-red-600">
          加载供应商信息失败: {error.message}
        </div>
      </div>
    );
  }

  // 加载中
  if (isLoadingSupplier) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">加载中...</div>
      </div>
    );
  }

  // 供应商不存在
  if (!supplierData?.data) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center text-red-600">供应商不存在</div>
      </div>
    );
  }

  const supplier = supplierData.data;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题和导航 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/suppliers">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">编辑供应商</h1>
          <p className="text-muted-foreground">修改供应商 "{supplier.name}" 的信息</p>
        </div>
      </div>

      {/* 表单 */}
      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                      <FormDescription>
                        供应商的当前状态
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 提交按钮 */}
                <div className="flex gap-4 pt-4">
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {isLoading ? '更新中...' : '更新供应商'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/suppliers')}
                    disabled={isLoading}
                  >
                    取消
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
