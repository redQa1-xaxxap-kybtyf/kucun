'use client';

import { ProductForm } from '@/components/products/product-form';
import { useToast } from '@/components/ui/use-toast';
import type { Product } from '@/lib/types/product';

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
