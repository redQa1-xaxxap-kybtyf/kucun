'use client';

// React相关

// 第三方库
import { AlertCircle, ArrowLeft, Package } from 'lucide-react';

// UI组件
import { ProductBasicInfoForm } from '@/components/products/product-basic-info-form';
import { ProductDetailsForm } from '@/components/products/product-details-form';
import { ProductFormActions } from '@/components/products/product-form-actions';
import { ProductImageUpload } from '@/components/products/product-image-upload';
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
  variant = 'default',
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
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
      {/* 页面标题卡片 */}
      <Card
        className="overflow-hidden border border-[hsl(var(--color-border-primary))]"
        style={{ boxShadow: 'var(--shadow-medium)' }}
      >
        <CardContent className="bg-[hsl(var(--color-bg-secondary))] p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] text-[hsl(var(--color-text-on-primary))]"
                style={{ boxShadow: 'var(--shadow-light)' }}
              >
                <Package className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                  {isEdit ? '编辑产品' : '新建产品'}
                </h1>
                <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                  {isEdit ? '修改产品信息' : '创建新的产品记录'}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleCancel}
              className="h-11 gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              返回
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 错误提示 */}
      {submitError && (
        <Alert variant="destructive" className="shadow-[var(--shadow-light)]">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* 基础信息 */}
          <Card
            className="overflow-hidden border border-[hsl(var(--color-border-primary))]"
            style={{ boxShadow: 'var(--shadow-medium)' }}
          >
            <CardHeader className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))]">
              <CardTitle className="flex items-center text-[hsl(var(--color-text-primary))]">
                <Package className="mr-2 h-5 w-5 text-[hsl(var(--color-primary))]" />
                基础信息
              </CardTitle>
              <CardDescription>
                产品的基本信息，包括编码、名称、规格等
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <ProductBasicInfoForm
                control={form.control}
                isLoading={isLoading}
                isCreateMode={mode === 'create'}
              />
            </CardContent>
          </Card>

          {/* 详细参数 */}
          <Card
            className="overflow-hidden border border-[hsl(var(--color-border-primary))]"
            style={{ boxShadow: 'var(--shadow-medium)' }}
          >
            <CardHeader className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))]">
              <CardTitle className="text-[hsl(var(--color-text-primary))]">
                详细参数
              </CardTitle>
              <CardDescription>产品的详细技术参数和规格信息</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <ProductDetailsForm
                control={form.control}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>

          {/* 产品图片 */}
          <Card
            className="overflow-hidden border border-[hsl(var(--color-border-primary))]"
            style={{ boxShadow: 'var(--shadow-medium)' }}
          >
            <CardHeader className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))]">
              <CardTitle className="text-[hsl(var(--color-text-primary))]">
                产品图片
              </CardTitle>
              <CardDescription>
                上传产品的缩略图、主图和效果图，支持多张图片上传
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <ProductImageUpload
                thumbnailUrl={form.watch('thumbnailUrl') || ''}
                images={form.watch('images') || []}
                onThumbnailChange={url => form.setValue('thumbnailUrl', url)}
                onImagesChange={images => form.setValue('images', images)}
                disabled={isLoading}
                maxFiles={8}
                maxSize={5}
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
    </div>
  );
}
