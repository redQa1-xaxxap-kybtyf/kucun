import { requirePagePermission } from '@/lib/auth/page-permission';

/**
 * 库存调整页面布局
 * 在此处统一进行权限检查
 */
export default async function InventoryAdjustLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ✅ 权限检查：要求用户拥有库存调整权限
  await requirePagePermission('inventory:adjust');

  return <>{children}</>;
}
