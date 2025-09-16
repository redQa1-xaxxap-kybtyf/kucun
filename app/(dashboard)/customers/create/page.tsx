'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

// UI Components
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
import { Textarea } from '@/components/ui/textarea';

// API and Types
import { createCustomer, customerQueryKeys } from '@/lib/api/customers';
import type {
  CreateCustomerData } from '@/lib/schemas/customer';
import {
  CreateCustomerSchema
} from '@/lib/schemas/customer';

/**
 * 新建客户页面
 * 严格遵循全栈项目统一约定规范
 */
export default function CreateCustomerPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // 表单配置
  const form = useForm<CreateCustomerData>({
    resolver: zodResolver(CreateCustomerSchema),
    defaultValues: {
      name: '',
      phone: '',
      address: '',
      extendedInfo: {},
    },
  });

  // 创建客户Mutation
  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: data => {
      toast.success('客户创建成功');
      queryClient.invalidateQueries({ queryKey: customerQueryKeys.lists() });
      router.push(`/customers/${data.id}`);
    },
    onError: error => {
      toast.error(error instanceof Error ? error.message : '创建失败');
    },
  });

  // 表单提交处理
  const onSubmit = (data: CreateCustomerData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">新建客户</h1>
          <p className="text-muted-foreground">创建新的客户信息</p>
        </div>
      </div>

      {/* 客户表单 */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* 基本信息 */}
            <Card>
              <CardHeader>
                <CardTitle>基本信息</CardTitle>
                <CardDescription>填写客户的基本信息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>客户名称 *</FormLabel>
                      <FormControl>
                        <Input placeholder="请输入客户名称" {...field} />
                      </FormControl>
                      <FormDescription>
                        客户的公司名称或个人姓名
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
                        <Input placeholder="请输入联系电话" {...field} />
                      </FormControl>
                      <FormDescription>客户的主要联系电话</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>地址</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="请输入客户地址"
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>客户的详细地址信息</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* 扩展信息 */}
            <Card>
              <CardHeader>
                <CardTitle>扩展信息</CardTitle>
                <CardDescription>填写客户的扩展信息（可选）</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">联系人</label>
                  <Input placeholder="请输入联系人姓名" />
                  <p className="text-sm text-muted-foreground">
                    主要联系人的姓名
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">邮箱</label>
                  <Input type="email" placeholder="请输入邮箱地址" />
                  <p className="text-sm text-muted-foreground">
                    客户的邮箱地址
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">备注</label>
                  <Textarea
                    placeholder="请输入备注信息"
                    className="min-h-[100px]"
                  />
                  <p className="text-sm text-muted-foreground">
                    关于客户的其他备注信息
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={createMutation.isPending}
            >
              取消
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  创建中...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  创建客户
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
