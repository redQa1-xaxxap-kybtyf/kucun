/**
 * 销售订单数据转换工具
 * 提供类型安全的表单数据与API数据之间的转换
 */

import type {
  SalesOrderCreateInput,
  SalesOrderItemCreateInput,
  SalesOrderStatus,
  SalesOrderUpdateInput,
  SalesOrderItemUpdateInput,
} from '@/lib/types/sales-order';

/**
 * 表单数据类型 - 包含UI层特有的字段
 */
export interface SalesOrderFormData {
  customerId: string;
  status?: SalesOrderStatus;
  orderType?: 'NORMAL' | 'TRANSFER';
  supplierId?: string;
  costAmount?: number;
  remarks?: string;
  items: SalesOrderFormItem[];
}

/**
 * 表单明细项类型 - 包含UI层特有的字段
 */
export interface SalesOrderFormItem {
  // 临时ID，用于React key
  tempId?: string;

  // 产品信息
  productId?: string;
  productCode?: string;
  batchNumber?: string;
  colorCode?: string;
  productionDate?: string;
  specification?: string;
  remarks?: string;

  // 数量和价格（可选，因为草稿状态允许为空）
  quantity?: number;
  unitPrice?: number;
  subtotal?: number;

  // UI层显示字段（用于件片转换）
  displayUnit?: '片' | '件';
  displayQuantity?: number;
  piecesPerUnit?: number;

  // 调货销售相关
  unitCost?: number;

  // 手动输入商品
  isManualProduct?: boolean;
  manualProductName?: string;
  manualSpecification?: string;
  manualWeight?: number;
  manualUnit?: string;

  // 产品关联信息（用于显示）
  product?: {
    id: string;
    name: string;
    code?: string;
    specification?: string;
    piecesPerBox?: number;
  };
}

/**
 * 转换表单数据为创建销售订单的API输入
 * @param formData 表单数据
 * @returns API创建输入数据
 */
export function transformFormDataToCreateInput(
  formData: SalesOrderFormData
): SalesOrderCreateInput {
  const items = formData.items
    .map(transformFormItemToCreateInput)
    .filter(item => {
      const hasPositiveQuantity =
        typeof item.quantity === 'number' && item.quantity > 0;
      const hasPositivePrice =
        typeof item.unitPrice === 'number' && item.unitPrice > 0;

      if (!hasPositiveQuantity || !hasPositivePrice) {
        return false;
      }

      if (item.isManualProduct) {
        return Boolean(item.manualProductName?.trim());
      }
      return Boolean(item.productId?.trim());
    });

  return {
    customerId: formData.customerId,
    status: formData.status || 'draft',
    orderType: formData.orderType || 'NORMAL',
    supplierId: formData.supplierId?.trim() || undefined,
    costAmount: formData.costAmount || undefined,
    remarks: formData.remarks?.trim() || undefined,
    items,
  };
}

/**
 * 转换表单明细项为创建明细项的API输入
 * @param formItem 表单明细项
 * @returns API创建明细项输入数据
 */
export function transformFormItemToCreateInput(
  formItem: SalesOrderFormItem
): SalesOrderItemCreateInput {
  // 手动输入商品的情况
  if (formItem.isManualProduct) {
    return {
      productId: formItem.productId?.trim() || undefined, // 手动商品可能没有productId
      productCode: formItem.productCode?.trim() || undefined,
      quantity: formItem.quantity ?? 0,
      unitPrice: formItem.unitPrice || 0,
      batchNumber: formItem.batchNumber?.trim() || undefined,
      colorCode: formItem.colorCode,
      productionDate: formItem.productionDate,
      unitCost: formItem.unitCost,
      displayUnit: formItem.displayUnit || '片',
      displayQuantity: formItem.displayQuantity ?? formItem.quantity ?? 0,
      piecesPerUnit: formItem.piecesPerUnit,
      specification:
        formItem.specification || formItem.manualSpecification || undefined,
      remarks: formItem.remarks?.trim() || undefined,
      isManualProduct: true,
      manualProductName: formItem.manualProductName?.trim() || undefined,
      manualSpecification: formItem.manualSpecification?.trim() || undefined,
      manualWeight: formItem.manualWeight,
      manualUnit: formItem.manualUnit?.trim() || undefined,
    };
  }

  // 普通商品的情况
  return {
    productId: formItem.productId?.trim() || '',
    productCode: formItem.productCode?.trim() || undefined,
    batchNumber: formItem.batchNumber?.trim() || undefined,
    quantity: formItem.quantity ?? 0,
    unitPrice: formItem.unitPrice || 0,
    colorCode: formItem.colorCode,
    productionDate: formItem.productionDate,
    unitCost: formItem.unitCost,
    displayUnit: formItem.displayUnit || '片',
    displayQuantity: formItem.displayQuantity ?? formItem.quantity ?? 0,
    piecesPerUnit: formItem.piecesPerUnit,
    specification:
      formItem.specification || formItem.product?.specification || undefined,
    remarks: formItem.remarks?.trim() || undefined,
    isManualProduct: false,
  };
}

/**
 * 转换表单数据为更新销售订单的API输入
 * @param orderId 订单ID
 * @param formData 表单数据
 * @returns API更新输入数据
 */
export function transformFormDataToUpdateInput(
  orderId: string,
  formData: SalesOrderFormData
): SalesOrderUpdateInput {
  const items = formData.items
    .map(transformFormItemToUpdateInput)
    .filter(item => {
      const hasPositiveQuantity =
        typeof item.quantity === 'number' && item.quantity > 0;
      const hasPositivePrice =
        typeof item.unitPrice === 'number' && item.unitPrice > 0;

      if (!hasPositiveQuantity || !hasPositivePrice) {
        return false;
      }

      if (item.isManualProduct) {
        return Boolean(item.manualProductName?.trim());
      }
      return Boolean(item.productId?.trim());
    });

  return {
    id: orderId,
    customerId: formData.customerId,
    status: formData.status,
    orderType: formData.orderType,
    supplierId: formData.supplierId?.trim() || undefined,
    costAmount: formData.costAmount ?? undefined,
    remarks: formData.remarks?.trim() || undefined,
    items,
  };
}

/**
 * 转换表单明细项为更新明细项的API输入
 * @param formItem 表单明细项
 * @returns API更新明细项输入数据
 */
export function transformFormItemToUpdateInput(
  formItem: SalesOrderFormItem
): SalesOrderItemUpdateInput {
  // 手动输入商品的情况
  if (formItem.isManualProduct) {
    return {
      productId: formItem.productId?.trim() || undefined,
      productCode: formItem.productCode?.trim() || undefined,
      quantity: formItem.quantity ?? 0,
      unitPrice: formItem.unitPrice || 0,
      batchNumber: formItem.batchNumber?.trim() || undefined,
      colorCode: formItem.colorCode,
      productionDate: formItem.productionDate,
      unitCost: formItem.unitCost ?? undefined,
      displayUnit: formItem.displayUnit || '片',
      displayQuantity: formItem.displayQuantity ?? formItem.quantity ?? 0,
      piecesPerUnit: formItem.piecesPerUnit,
      specification:
        formItem.specification || formItem.manualSpecification || undefined,
      remarks: formItem.remarks?.trim() || undefined,
      isManualProduct: true,
      manualProductName: formItem.manualProductName?.trim() || undefined,
      manualSpecification: formItem.manualSpecification?.trim() || undefined,
      manualWeight: formItem.manualWeight ?? undefined,
      manualUnit: formItem.manualUnit?.trim() || undefined,
    };
  }

  // 普通商品的情况
  return {
    productId: formItem.productId?.trim() || '',
    productCode: formItem.productCode?.trim() || undefined,
    batchNumber: formItem.batchNumber?.trim() || undefined,
    quantity: formItem.quantity ?? 0,
    unitPrice: formItem.unitPrice || 0,
    colorCode: formItem.colorCode,
    productionDate: formItem.productionDate,
    unitCost: formItem.unitCost ?? undefined,
    displayUnit: formItem.displayUnit || '片',
    displayQuantity: formItem.displayQuantity ?? formItem.quantity ?? 0,
    piecesPerUnit: formItem.piecesPerUnit,
    specification:
      formItem.specification || formItem.product?.specification || undefined,
    remarks: formItem.remarks?.trim() || undefined,
    isManualProduct: false,
  };
}

/**
 * 计算明细项小计
 * @param quantity 数量
 * @param unitPrice 单价
 * @returns 小计金额（保留两位小数）
 */
export function calculateItemSubtotal(
  quantity: number,
  unitPrice: number
): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}

/**
 * 计算订单总金额
 * @param items 订单明细项列表
 * @returns 总金额（保留两位小数）
 */
export function calculateOrderTotal(items: SalesOrderFormItem[]): number {
  const total = items.reduce((sum, item) => {
    const subtotal =
      item.subtotal ||
      calculateItemSubtotal(item.quantity ?? 0, item.unitPrice || 0);
    return sum + subtotal;
  }, 0);

  return Math.round(total * 100) / 100;
}

/**
 * 验证表单数据是否有效
 * @param formData 表单数据
 * @returns 验证结果
 */
export function validateFormData(formData: SalesOrderFormData): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 验证客户ID
  if (!formData.customerId?.trim()) {
    errors.push('请选择客户');
  }

  // 验证订单明细
  if (!formData.items || formData.items.length === 0) {
    errors.push('至少需要添加一个订单明细');
  }

  // 验证每个明细项
  formData.items.forEach((item, index) => {
    if (item.isManualProduct) {
      // 手动商品必须有商品名称
      if (!item.manualProductName?.trim()) {
        errors.push(`第${index + 1}个明细项：手动输入商品必须填写商品名称`);
      }
    } else {
      // 普通商品必须有productId
      if (!item.productId?.trim()) {
        errors.push(`第${index + 1}个明细项：请选择产品`);
      }
    }

    // 验证数量
    if (!item.quantity || item.quantity <= 0) {
      errors.push(`第${index + 1}个明细项：数量必须大于0`);
    }

    // 验证单价
    if (item.unitPrice === undefined || item.unitPrice < 0) {
      errors.push(`第${index + 1}个明细项：单价不能为负数`);
    }
  });

  // 验证调货销售特殊要求
  if (formData.orderType === 'TRANSFER') {
    if (!formData.supplierId?.trim()) {
      errors.push('调货销售必须选择供应商');
    }
    if (!formData.costAmount || formData.costAmount <= 0) {
      errors.push('调货销售必须填写成本金额');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
