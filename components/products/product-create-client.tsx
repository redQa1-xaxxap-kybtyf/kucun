'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { ProductForm } from '@/components/products/product-form';
import { useToast } from '@/components/ui/use-toast';
import { productQueryKeys } from '@/lib/api/products';
import type { Product } from '@/lib/types/product';

/**
 * 产品创建客户端组件
 * 处理产品创建成功后的提示和跳转
 */
export function ProductCreateClient() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSuccess = async (product: Product) => {
    // 显示成功提示
    toast({
      title: '创建成功',
      description: `产品编码 "${product.code}" 创建成功！`,
      variant: 'success',
    });

    // 失效产品列表缓存，确保列表数据最新
    await queryClient.invalidateQueries({
      queryKey: productQueryKeys.all,
      refetchType: 'active',
    });

    // 跳转到产品列表
    router.push('/products');
  };

  return <ProductForm mode="create" variant="erp" onSuccess={handleSuccess} />;
}
