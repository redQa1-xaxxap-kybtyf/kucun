import { ERPProductList } from '@/components/products/erp-product-list';

/**
 * 产品管理页面
 * 严格遵循全栈项目统一约定规范
 */
export default async function ProductsPage() {
  return (
    <div className="mx-auto max-w-none px-4 py-4 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <ERPProductList />
      </div>
    </div>
  );
}
