'use client';

import dynamic from 'next/dynamic';

import { useToast } from '@/components/ui/use-toast';
import type { Product } from '@/lib/types/product';

const ProductForm = dynamic(
  () =>
    import('@/components/products/product-form').then(mod => mod.ProductForm),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
        表单加载中...
      </div>
    ),
  }
);

interface ProductEditClientProps {
  productId: string;
  initialData: Product;
}

export function ProductEditClient({
  productId,
  initialData,
}: ProductEditClientProps) {
  const { toast } = useToast();

  const handleSuccess = (product: Product) => {
    toast({
      title: '更新成功',
      description: `产品编码 "${product.code}" 更新成功！所有修改已保存。`,
      variant: 'success',
    });
  };

  return (
    <ProductForm
      mode="edit"
      productId={productId}
      initialData={initialData}
      variant="erp"
      onSuccess={handleSuccess}
    />
  );
}
