import { ERPInboundForm } from '@/components/inventory/erp-inbound-form';
import { requirePagePermission } from '@/lib/auth/page-permission';

/**
 * 产品入库页面
 * 使用ERP风格的紧凑布局，符合中国用户习惯
 * ✅ 符合产品模块UI风格规范
 */
export default async function CreateInboundPage() {
  // ✅ 权限检查：要求用户拥有入库操作权限
  await requirePagePermission('inventory:inbound');

  return <ERPInboundForm />;
}
