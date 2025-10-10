import { ERPCustomerForm } from '@/components/customers/erp-customer-form';

/**
 * 新建客户页面 - Server Component
 * 负责数据获取和 SEO 优化
 * 严格遵循前端架构规范：三级组件架构
 */
export default function CreateCustomerPage() {
  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 表单组件包含标题卡片 */}
        <ERPCustomerForm mode="create" />
      </div>
    </div>
  );
}
