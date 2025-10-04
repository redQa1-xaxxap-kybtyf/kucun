import { ERPCustomerForm } from '@/components/customers/erp-customer-form';

/**
 * 新建客户页面 - Server Component
 * 负责数据获取和 SEO 优化
 * 严格遵循前端架构规范：三级组件架构
 */
export default function CreateCustomerPage() {
  return (
    <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
      <ERPCustomerForm mode="create" />
    </div>
  );
}
