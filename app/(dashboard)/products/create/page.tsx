'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// API and Types
import { createProduct, productQueryKeys } from '@/lib/api/products';
import type { CreateProductData } from '@/lib/schemas/product';
import { CreateProductSchema } from '@/lib/schemas/product';
import {
    PRODUCT_STATUS_OPTIONS,
    PRODUCT_UNIT_OPTIONS,
} from '@/lib/types/product';

/**
 * 新建产品页面
 * 严格遵循全栈项目统一约定规范
 */
export default function CreateProductPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // 表单配置
  const form = useForm<CreateProductData>({
    resolver: zodResolver(CreateProductSchema),
    defaultValues: {
      code: '',
      name: '',
      specification: '',
      unit: 'piece',
      piecesPerUnit: undefined,
      weight: undefined,
      status: 'active',
      specifications: {},
    },
  });

  // 创建产品Mutation
  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: data => {
      toast.success('产品创建成功');
      queryClient.invalidateQueries({ queryKey: productQueryKeys.lists() });
      router.push(`/products/${data.id}`);
    },
    onError: error => {
      toast.error(error instanceof Error ? error.message : '创建失败');
    },
  });

  // 表单提交处理
  const onSubmit = (data: CreateProductData) => {
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
          <h1 className="text-3xl font-bold tracking-tight">新建产品</h1>
          <p className="text-muted-foreground">创建新的产品信息</p>
        </div>
      </div>

      {/* 产品表单 */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* 基本信息 */}
            <Card>
              <CardHeader>
                <CardTitle>基本信息</CardTitle>
                <CardDescription>填写产品的基本信息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>产品编码 *</FormLabel>
                      <FormControl>
                        <Input placeholder="请输入产品编码" {...field} />
                      </FormControl>
                      <FormDescription>
                        产品的唯一标识码，不可重复
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>产品名称 *</FormLabel>
                      <FormControl>
                        <Input placeholder="请输入产品名称" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="specification"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>规格</FormLabel>
                      <FormControl>
                        <Input placeholder="请输入产品规格" {...field} />
                      </FormControl>
                      <FormDescription>
                        例如：600x600mm、800x800mm等
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>计量单位 *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择计量单位" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PRODUCT_UNIT_OPTIONS.map(option => (
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

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>状态 *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择产品状态" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PRODUCT_STATUS_OPTIONS.map(option => (
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
              </CardContent>
            </Card>

            {/* 详细信息 */}
            <Card>
              <CardHeader>
                <CardTitle>详细信息</CardTitle>
                <CardDescription>填写产品的详细参数</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="piecesPerUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>每单位片数</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="请输入每单位片数"
                          {...field}
                          onChange={e =>
                            field.onChange(
                              e.target.value
                                ? Number(e.target.value)
                                : undefined
                            )
                          }
                        />
                      </FormControl>
                      <FormDescription>每个计量单位包含的片数</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>重量 (kg)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="请输入重量"
                          {...field}
                          onChange={e =>
                            field.onChange(
                              e.target.value
                                ? Number(e.target.value)
                                : undefined
                            )
                          }
                        />
                      </FormControl>
                      <FormDescription>单个产品的重量（千克）</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel>产品描述</FormLabel>
                  <Textarea
                    placeholder="请输入产品描述（可选）"
                    className="min-h-[100px]"
                  />
                  <p className="text-sm text-muted-foreground">
                    详细描述产品的特点和用途
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
                  创建产品
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
