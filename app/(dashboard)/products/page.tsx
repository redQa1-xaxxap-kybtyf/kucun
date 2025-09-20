'use client';

import { useRouter } from 'next/navigation';

// Components
import { ERPProductList } from '@/components/products/erp-product-list';

/**
 * 产品管理页面
 * 严格遵循全栈项目统一约定规范
 */
function ProductsPage() {
  const router = useRouter();

  // 产品选择处理
  const handleProductSelect = (productId: string) => {
    router.push(`/products/${productId}`);
  };

  return (
    <div className="mx-auto max-w-none px-4 py-4 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <ERPProductList onProductSelect={handleProductSelect} />
      </div>
    </div>
  );
}

export default ProductsPage;
