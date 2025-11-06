/**
 * 供应商展示相关的纯函数工具
 * 仅包含无副作用的格式化与校验逻辑，可安全在客户端使用
 */

/**
 * 格式化供应商状态显示
 */
export function formatSupplierStatus(status: string): string {
  switch (status) {
    case 'active':
      return '活跃';
    case 'inactive':
      return '停用';
    case 'suspended':
      return '暂停';
    default:
      return '未知';
  }
}

/**
 * 验证供应商名称（前端预检查）
 */
export function validateSupplierName(name: string): boolean {
  return name.length >= 1 && name.length <= 100;
}

/**
 * 格式化供应商电话显示
 */
export function formatSupplierPhone(phone?: string): string {
  if (!phone) {
    return '-';
  }
  return phone;
}

/**
 * 格式化供应商地址显示
 */
export function formatSupplierAddress(address?: string): string {
  if (!address) {
    return '-';
  }
  return address.length > 50 ? `${address.substring(0, 50)}...` : address;
}
