import { notFound } from 'next/navigation';

import { ERPProductDetail } from '@/components/products/erp-product-detail';
import { getProductById } from '@/lib/api/handlers/products';

interface ProductDetailPageProps {
  params: {
    id: string;
  };
}

/**
 * 产品详情页面 - ERP风格
 * 符合中国ERP系统的界面标准和用户习惯
 */
export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const product = await getProductById(params.id);

  if (!product) {
    notFound();
  }

  return <ERPProductDetail product={product} />;
}
