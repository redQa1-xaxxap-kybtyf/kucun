import { ProductCreateClient } from '@/components/products/product-create-client';

/**
 * 新建产品页面 - ERP风格
 * 符合中国ERP系统的界面标准和用户习惯
 */
export default async function CreateProductPage() {
  return (
    <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
      <ProductCreateClient />
    </div>
  );
}
