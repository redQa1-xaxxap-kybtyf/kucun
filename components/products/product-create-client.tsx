'use client';

import { useRouter } from 'next/navigation';

import { ProductForm } from '@/components/products/product-form';
import { useToast } from '@/hooks/use-toast';
import type { Product } from '@/lib/types/product';

/**
 * 产品创建客户端组件
 * 处理产品创建成功后的提示和跳转
 */
export function ProductCreateClient() {
  const router = useRouter();
  const { toast } = useToast();

  const handleSuccess = (product: Product) => {
    // 显示成功提示
    toast({
      title: '创建成功',
      description: `产品编码 "${product.code}" 创建成功！`,
      variant: 'success',
    });

    // 延迟跳转，让用户看到成功提示
    setTimeout(() => {
      router.push('/products');
    }, 1500);
  };

  return <ProductForm mode="create" variant="erp" onSuccess={handleSuccess} />;
}
