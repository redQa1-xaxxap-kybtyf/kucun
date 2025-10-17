'use client';

import { AlertCircle, ArrowLeft, Package } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';

import { ProductBasicInfoForm } from '@/components/products/product-basic-info-form';
import { ProductDetailsForm } from '@/components/products/product-details-form';
import { ProductImageUpload } from '@/components/products/product-image-upload';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import {
  useProductForm,
  type ProductFormSuccessHandler,
} from '@/hooks/use-product-form';
import type { Product } from '@/lib/types/product';
import { cn } from '@/lib/utils';
import type {
  ProductCreateFormData,
  ProductUpdateFormData,
} from '@/lib/validations/product';

type ProductFormValues = ProductCreateFormData | ProductUpdateFormData;

interface ProductFormProps {
  mode: 'create' | 'edit';
  productId?: string;
  initialData?: Product;
  onSuccess?: ProductFormSuccessHandler;
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

  void _variant;

  return (
    <ProductFormLayout
      form={form}
      isEdit={isEdit}
      isLoading={isLoading}
      submitError={submitError}
      onSubmit={onSubmit}
      onCancel={handleCancel}
    />
  );
}

interface ProductFormLayoutProps {
  form: UseFormReturn<ProductFormValues>;
  isEdit: boolean;
  isLoading: boolean;
  submitError: string;
  onSubmit: (values: ProductFormValues) => void | Promise<void>;
  onCancel: () => void;
}

function ProductFormLayout({
  form,
  isEdit,
  isLoading,
  submitError,
  onSubmit,
  onCancel,
}: ProductFormLayoutProps) {
  return (
    <div className="flex h-full flex-col">
      <ProductFormHeader isEdit={isEdit} onCancel={onCancel} />
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          <ProductFormError message={submitError} />
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <ProductInfoCard form={form} isEdit={isEdit} isLoading={isLoading} />
              <ProductImagesCard form={form} isLoading={isLoading} />
              <ProductFormFooter
                isEdit={isEdit}
                isLoading={isLoading}
                onCancel={onCancel}
              />
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}

interface ProductFormHeaderProps {
  isEdit: boolean;
  onCancel: () => void;
}

function ProductFormHeader({ isEdit, onCancel }: ProductFormHeaderProps) {
  return (
    <div className="bg-background border-b px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
            <Package className="text-primary h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">
              {isEdit ? '编辑产品' : '新建产品'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isEdit ? '修改产品信息' : '填写必填信息即可快速创建'}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>
      </div>
    </div>
  );
}

function ProductFormError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

interface ProductInfoCardProps {
  form: UseFormReturn<ProductFormValues>;
  isEdit: boolean;
  isLoading: boolean;
}

function ProductInfoCard({ form, isEdit, isLoading }: ProductInfoCardProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center text-lg">
          <Package className="mr-2 h-4 w-4" />
          产品信息
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-muted-foreground mb-4 text-sm font-medium">基础信息</h3>
          <ProductBasicInfoForm
            control={form.control}
            isLoading={isLoading}
            isCreateMode={!isEdit}
            onCategoryChange={(categoryId, categoryName) => {
              void categoryId;
              const currentName = form.getValues('name');
              if (!currentName || currentName.trim() === '') {
                form.setValue('name', categoryName);
              }
            }}
          />
        </div>

        <Separator />

        <div>
          <h3 className="text-muted-foreground mb-4 text-sm font-medium">补充信息</h3>
          <ProductDetailsForm control={form.control} isLoading={isLoading} />
        </div>
      </CardContent>
    </Card>
  );
}

interface ProductImagesCardProps {
  form: UseFormReturn<ProductFormValues>;
  isLoading: boolean;
}

function ProductImagesCard({ form, isLoading }: ProductImagesCardProps) {
  const thumbnailUrl = form.watch('thumbnailUrl') || '';
  const images = form.watch('images') || [];

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">产品图片</CardTitle>
          <span className="text-muted-foreground text-sm">选填</span>
        </div>
      </CardHeader>
      <CardContent>
        <ProductImageUpload
          thumbnailUrl={thumbnailUrl}
          images={images}
          onThumbnailChange={url => form.setValue('thumbnailUrl', url)}
          onImagesChange={fileList => form.setValue('images', fileList)}
          disabled={isLoading}
          maxFiles={8}
          maxSize={5}
        />
      </CardContent>
    </Card>
  );
}

interface ProductFormFooterProps {
  isEdit: boolean;
  isLoading: boolean;
  onCancel: () => void;
}

function ProductFormFooter({ isEdit, isLoading, onCancel }: ProductFormFooterProps) {
  return (
    <div
      className={cn(
        'bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky bottom-0 z-10 border-t backdrop-blur',
        '-mx-6 px-6 py-4'
      )}
    >
      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          取消
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? '保存中...' : isEdit ? '保存修改' : '创建产品'}
        </Button>
      </div>
    </div>
  );
}
