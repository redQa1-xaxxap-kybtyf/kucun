'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Truck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { createSupplier } from '@/lib/api/suppliers';
import {
  CreateSupplierSchema,
  supplierCreateDefaults,
  type SupplierCreateFormData,
} from '@/lib/validations/supplier';

export default function CreateSupplierPage() {
  const router = useRouter();
  const { toast } = useToast();

  // 表单配置
  const form = useForm<SupplierCreateFormData>({
    resolver: zodResolver(CreateSupplierSchema),
    defaultValues: supplierCreateDefaults,
    mode: 'all', // 在所有交互时验证
  });

  // 创建供应商
  const createMutation = useMutation({
    mutationFn: createSupplier,
    onSuccess: data => {
      toast({
        title: '创建成功',
        description: data.message || '供应商创建成功',
        variant: 'success',
      });
      router.push('/suppliers');
    },
    onError: error => {
      toast({
        title: '创建失败',
        description: error.message || '创建供应商失败',
        variant: 'destructive',
      });
    },
  });

  // 提交表单 - 这个函数只会在表单验证通过后被调用
  // Zod Schema 已经处理了 trim() 和所有验证，无需手动校验
  const onSubmit = async (data: SupplierCreateFormData) => {
    createMutation.mutate({
      name: data.name,
      phone: data.phone || undefined,
      address: data.address || undefined,
    });
  };

  const isLoading = createMutation.isPending;

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="space-y-6">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
          <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-600 shadow-lg shadow-green-600/30">
                  <Truck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    创建供应商
                  </h1>
                  <p className="text-sm text-gray-600">
                    添加新供应商信息，建立供应商档案
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
              >
                <Link href="/suppliers">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 表单 */}
        <Card className="shadow-lg shadow-gray-200/50">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50">
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
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
                          value={field.value || ''} // 确保显示空字符串而不是 undefined
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
                          value={field.value || ''} // 确保显示空字符串而不是 undefined
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
                          value={field.value || ''} // 确保显示空字符串而不是 undefined
                        />
                      </FormControl>
                      <FormDescription>
                        供应商的详细地址，最多200个字符
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 提交按钮 */}
                <div className="flex gap-4 pt-4">
                  <Button type="submit" disabled={isLoading} className="flex-1">
                    {isLoading ? '创建中...' : '创建供应商'}
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
