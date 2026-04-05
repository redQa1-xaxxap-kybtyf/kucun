'use client';

import { ProductForm } from '@/components/products/product-form';
import { useToast } from '@/components/ui/use-toast';
import type { Product } from '@/lib/types/product';

/**
 * 产品创建客户端组件
 * 处理产品创建成功后的提示
 */
export function ProductCreateClient() {
  const { toast } = useToast();

  const handleSuccess = (product: Product) => {
    toast({
      title: '创建成功',
      description: `产品编码 "${product.code}" 创建成功！`,
      variant: 'success',
    });
  };

  return <ProductForm mode="create" variant="erp" onSuccess={handleSuccess} />;
}
