'use client';

import { AlertCircle, ArrowLeft, Package } from 'lucide-react';

import { ProductBasicInfoForm } from '@/components/products/product-basic-info-form';
import { ProductDetailsForm } from '@/components/products/product-details-form';
import { ProductImageUpload } from '@/components/products/product-image-upload';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { useProductForm } from '@/hooks/use-product-form';
import { cn } from '@/lib/utils';
import { type Product } from '@/lib/types/product';

interface ProductFormProps {
  mode: 'create' | 'edit';
  productId?: string;
  initialData?: Product;
  onSuccess?: (product: Product) => void;
  onCancel?: () => void;
  variant?: 'default' | 'erp';
}

/**
 * 优化版产品表单
 *
 * 优化要点:
 * 1. 减少卡片层级,信息更紧凑
 * 2. 合并基础信息和详细参数到一个卡片
 * 3. 移除冗余的CardDescription
 * 4. 使用Separator分隔区域,替代多个卡片
 * 5. 悬浮操作栏,无需滚动即可保存
 */
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

  void _variant;

  return (
    <div className="flex h-full flex-col">
      {/* 精简的页面标题 */}
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">
                {isEdit ? '编辑产品' : '新建产品'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isEdit ? '修改产品信息' : '填写必填信息即可快速创建'}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancel}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
        </div>
      </div>

      {/* 表单内容区 */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          {/* 错误提示 */}
          {submitError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* 核心信息区 - 合并基础信息和详细参数 */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center text-lg">
                    <Package className="mr-2 h-4 w-4" />
                    产品信息
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* 基础信息 */}
                  <div>
                    <h3 className="mb-4 text-sm font-medium text-muted-foreground">
                      基础信息
                    </h3>
                    <ProductBasicInfoForm
                      control={form.control}
                      isLoading={isLoading}
                      isCreateMode={mode === 'create'}
                    />
                  </div>

                  <Separator />

                  {/* 详细参数 */}
                  <div>
                    <h3 className="mb-4 text-sm font-medium text-muted-foreground">
                      补充信息
                    </h3>
                    <ProductDetailsForm
                      control={form.control}
                      isLoading={isLoading}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 产品图片 - 可选区域 */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">产品图片</CardTitle>
                    <span className="text-sm text-muted-foreground">选填</span>
                  </div>
                </CardHeader>
                <CardContent>
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

              {/* 悬浮操作栏 */}
              <div
                className={cn(
                  'sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
                  'px-6 py-4 -mx-6'
                )}
              >
                <div className="flex items-center justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isLoading}
                  >
                    取消
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading
                      ? '保存中...'
                      : isEdit
                        ? '保存修改'
                        : '创建产品'}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
