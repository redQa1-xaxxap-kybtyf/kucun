import { notFound } from 'next/navigation';

import { ProductForm } from '@/components/products/product-form';
import { getProductById } from '@/lib/api/handlers/products';

interface ProductEditPageProps {
  params: {
    id: string;
  };
}

/**
 * 产品编辑页面 - ERP风格
 * 符合中国ERP系统的界面标准和用户习惯
 */
export default async function ProductEditPage({
  params,
}: ProductEditPageProps) {
  const product = await getProductById(params.id);

  if (!product) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
      <ProductForm
        mode="edit"
        productId={params.id}
        initialData={product}
        variant="erp"
      />
    </div>
  );
}
