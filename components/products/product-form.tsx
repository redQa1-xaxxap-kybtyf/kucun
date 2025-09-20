'use client';

// React相关

// 第三方库
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, Loader2, Package, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

// UI组件
import { ImageUpload } from '@/components/common/image-upload';
import { SpecificationsEditor } from '@/components/products/specifications-editor';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import {
  createProduct,
  productQueryKeys,
  updateProduct,
} from '@/lib/api/products';
import {
  CreateProductSchema,
  UpdateProductSchema,
  productFormDefaults,
} from '@/lib/schemas/product';
import {
  PRODUCT_STATUS_LABELS,
  PRODUCT_UNIT_LABELS,
  type Product,
} from '@/lib/types/product';

// 表单数据类型定义
interface ProductFormData {
  id: string;
  code: string;
  name: string;
  specification?: string;
  specifications?: Record<string, string | number | undefined>;
  unit: 'piece' | 'sheet' | 'strip' | 'box' | 'square_meter';
  piecesPerUnit: number;
  weight?: number;
  thickness?: number;
  status?: 'active' | 'inactive';
  categoryId?: string;
  images?: string[];
}

interface ProductFormProps {
  mode: 'create' | 'edit';
  initialData?: Product;
  onSuccess?: (product: Product) => void;
  onCancel?: () => void;
}

export function ProductForm({
  mode,
  initialData,
  onSuccess,
  onCancel,
}: ProductFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string>('');

  // 表单配置
  const isEdit = mode === 'edit';
  const schema = isEdit ? UpdateProductSchema : CreateProductSchema;

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues:
      isEdit && initialData
        ? {
            id: initialData.id,
            code: initialData.code,
            name: initialData.name,
            specification: initialData.specification || '',
            unit: initialData.unit,
            piecesPerUnit: initialData.piecesPerUnit,
            weight: initialData.weight,
            thickness: initialData.thickness,
            status: initialData.status,
            specifications:
              initialData.specifications || productFormDefaults.specifications,
          }
        : {
            ...productFormDefaults,
            code: '',
            name: '',
          },
  });

  // 创建产品 Mutation
  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: response => {
      queryClient.invalidateQueries({ queryKey: productQueryKeys.lists() });
      if (onSuccess) {
        onSuccess(response);
      } else {
        router.push('/products');
      }
    },
    onError: error => {
      setSubmitError(error instanceof Error ? error.message : '创建产品失败');
    },
  });

  // 更新产品 Mutation
  const updateMutation = useMutation({
    mutationFn: (data: ProductUpdateInput) => {
      if (!initialData?.id) {
        throw new Error('产品ID不能为空');
      }
      return updateProduct(initialData.id, data);
    },
    onSuccess: async response => {
      // 彻底失效所有相关查询缓存
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: productQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: productQueryKeys.lists() }),
        queryClient.invalidateQueries({
          queryKey: productQueryKeys.detail(response.id),
        }),
        queryClient.invalidateQueries({
          queryKey: productQueryKeys.details(),
        }),
        // 同时失效分类查询缓存，因为产品分类可能发生变化
        queryClient.invalidateQueries({ queryKey: ['categories'] }),
      ]);

      // 强制重新获取更新后的产品数据
      await queryClient.refetchQueries({
        queryKey: productQueryKeys.detail(response.id),
      });

      if (onSuccess) {
        onSuccess(response);
      } else {
        router.push('/products');
      }
    },
    onError: error => {
      setSubmitError(error instanceof Error ? error.message : '更新产品失败');
    },
  });

  const isLoading = createMutation.isPending || updateMutation.isPending;

  // 表单提交
  const onSubmit = async (data: ProductFormData) => {
    setSubmitError('');

    try {
      if (isEdit) {
        if (!initialData?.id) {
          throw new Error('产品ID不能为空');
        }

        // 处理weight和thickness字段的类型转换
        const updateData: ProductUpdateInput = {
          ...data,
          weight: data.weight === 0 ? undefined : data.weight,
          thickness: data.thickness === 0 ? undefined : data.thickness,
        };
        await updateMutation.mutateAsync(updateData);
      } else {
        const createData: ProductCreateInput = {
          ...data,
          weight: data.weight === 0 ? undefined : data.weight,
          thickness: data.thickness === 0 ? undefined : data.thickness,
        };
        await createMutation.mutateAsync(createData);
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
      router.push('/products');
    }
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
              {isEdit ? '编辑产品' : '新增产品'}
            </h1>
            <p className="text-muted-foreground">
              {isEdit ? '修改产品信息和规格参数' : '创建新的瓷砖产品'}
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
                <Package className="mr-2 h-5 w-5" />
                基础信息
              </CardTitle>
              <CardDescription>
                产品的基本信息，包括编码、名称、规格等
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>产品编码 *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="如：TC-800-001"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        产品的唯一标识码，建议使用字母和数字组合
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
                        <Input
                          placeholder="如：现代简约抛光砖"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>产品的显示名称</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>计量单位</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择计量单位" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(PRODUCT_UNIT_LABELS).map(
                            ([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription>产品的销售计量单位</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="piecesPerUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>每件片数</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="10000"
                          disabled={isLoading}
                          {...field}
                          onChange={e => {
                            const value = e.target.value;
                            field.onChange(value ? parseInt(value, 10) : 1);
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        每个销售单位包含的瓷砖片数
                      </FormDescription>
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
                          step="0.1"
                          min="0"
                          max="100000"
                          placeholder="如：25.5"
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
                      <FormDescription>
                        单个销售单位的重量（可选）
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="thickness"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>厚度 (mm)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          placeholder="如：8.5"
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
                      <FormDescription>瓷砖产品的厚度（可选）</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isEdit && (
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>产品状态</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={isLoading}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(PRODUCT_STATUS_LABELS).map(
                              ([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          停用的产品将不能创建新的销售订单
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <FormField
                control={form.control}
                name="specification"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>规格描述</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="产品的简要规格描述..."
                        className="min-h-[80px]"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      产品规格的简要文字描述（可选）
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 瓷砖规格信息 */}
          <SpecificationsEditor
            control={form.control}
            name="specifications"
            disabled={isLoading}
          />

          {/* 产品图片 */}
          <Card>
            <CardHeader>
              <CardTitle>产品图片</CardTitle>
              <CardDescription>
                上传产品的展示图片，支持多张图片上传
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="images"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <ImageUpload
                        value={field.value || []}
                        onChange={field.onChange}
                        maxFiles={5}
                        maxSize={5}
                        disabled={isLoading}
                      />
                    </FormControl>
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
              {isEdit ? '保存修改' : '创建产品'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
