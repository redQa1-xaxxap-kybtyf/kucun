'use client';

import { useRouter } from 'next/navigation';

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
  const router = useRouter();
  const { toast } = useToast();

  const handleSuccess = (product: Product) => {
    // 显示成功提示
    toast({
      title: '更新成功',
      description: `产品编码 "${product.code}" 更新成功！所有修改已保存。`,
      variant: 'success',
    });

    // 延迟跳转，让用户看到成功提示
    setTimeout(() => {
      router.push('/products');
    }, 1500);
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
