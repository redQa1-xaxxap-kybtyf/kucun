import { notFound } from 'next/navigation';

import { ProductEditClient } from '@/components/products/product-edit-client';
import { getProductById } from '@/lib/api/handlers/products';

interface ProductEditPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * 产品编辑页面 - ERP风格
 * 符合中国ERP系统的界面标准和用户习惯
 */
export default async function ProductEditPage({
  params,
}: ProductEditPageProps) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
      <ProductEditClient productId={id} initialData={product} />
    </div>
  );
}
