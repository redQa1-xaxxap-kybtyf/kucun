'use client';

// React相关

// 第三方库
import { AlertCircle, ArrowLeft, Package } from 'lucide-react';

// UI组件
import { ImageUpload } from '@/components/common/image-upload';
import { ProductBasicInfoForm } from '@/components/products/product-basic-info-form';
import { ProductDetailsForm } from '@/components/products/product-details-form';
import { ProductFormActions } from '@/components/products/product-form-actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { useProductForm } from '@/hooks/use-product-form';
import { type Product } from '@/lib/types/product';

interface ProductFormProps {
  mode: 'create' | 'edit';
  productId?: string;
  initialData?: Product;
  onSuccess?: (product: Product) => void;
  onCancel?: () => void;
  variant?: 'default' | 'erp';
}

export function ProductForm({
  mode,
  productId,
  initialData,
  onSuccess,
  onCancel,
  variant: _variant = 'default',
}: ProductFormProps) {
  const { form, isEdit, isLoading, submitError, onSubmit, handleCancel } =
    useProductForm({
      mode,
      productId,
      initialData,
      onSuccess,
      onCancel,
    });

  return (
    <div className="container mx-auto max-w-4xl py-6">
      {/* 页面标题 */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={handleCancel}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isEdit ? '编辑产品' : '新建产品'}
            </h1>
            <p className="text-muted-foreground">
              {isEdit ? '修改产品信息' : '创建新的产品记录'}
            </p>
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {submitError && (
        <Alert variant="destructive" className="mb-6">
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
            <CardContent>
              <ProductBasicInfoForm
                control={form.control}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>

          {/* 详细参数 */}
          <Card>
            <CardHeader>
              <CardTitle>详细参数</CardTitle>
              <CardDescription>产品的详细技术参数和规格信息</CardDescription>
            </CardHeader>
            <CardContent>
              <ProductDetailsForm
                control={form.control}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>

          {/* 产品图片 */}
          <Card>
            <CardHeader>
              <CardTitle>产品图片</CardTitle>
              <CardDescription>
                上传产品的展示图片，支持多张图片上传
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImageUpload
                value={form.watch('images') || []}
                onChange={urls => form.setValue('images', urls)}
                maxFiles={5}
                disabled={isLoading}
              />
            </CardContent>
          </Card>

          {/* 表单操作 */}
          <ProductFormActions
            mode={mode}
            isLoading={isLoading}
            onCancel={handleCancel}
          />
        </form>
      </Form>
    </div>
  );
}
