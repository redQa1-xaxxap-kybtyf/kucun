/**
 * 销售订单数据转换工具
 * 提供类型安全的表单数据与API数据之间的转换
 */

import type {
  SalesOrderCreateInput,
  SalesOrderItemCreateInput,
  SalesOrderItemUpdateInput,
  SalesOrderStatus,
  SalesOrderUpdateInput,
  TransferFulfillmentMode,
} from '@/lib/types/sales-order';
import {
  FEE_TYPE_LABELS,
  getDefaultFeePaidBy,
  type SalesOrderFeeItem,
} from '@/lib/types/sales-order-fee';
import {
  DEFAULT_SAMPLE_SETTLEMENT_TYPE,
  type SampleSettlementType,
} from '@/lib/utils/sample-order';

/**
 * 表单数据类型 - 包含UI层特有的字段
 */
export interface SalesOrderFormData {
  customerId: string;
  status?: SalesOrderStatus;
  orderType?: 'NORMAL' | 'TRANSFER';
  transferMode?: TransferFulfillmentMode;
  orderDate?: string;
  isSampleOrder?: boolean;
  sampleSettlementType?: SampleSettlementType;
  supplierId?: string;
  costAmount?: number;
  remarks?: string;
  feeItems?: SalesOrderFeeItem[];
  items: SalesOrderFormItem[];
  roundingAdjustment?: number;
  usePrepayment?: boolean;
  prepaymentAmount?: number;
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
  localQuantity?: number;
  transferQuantity?: number;

  // 手动输入产品
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

const toNumberOrDefault = (value: unknown, defaultValue = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return defaultValue;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const QUANTITY_EPSILON = 0.01;

const hasMeaningfulItemContent = (item: SalesOrderFormItem): boolean => {
  const fieldsToCheck: Array<unknown> = [
    item.productId,
    item.productCode,
    item.batchNumber,
    item.colorCode,
    item.productionDate,
    item.specification,
    item.remarks,
    item.quantity,
    item.unitPrice,
    item.displayQuantity,
    item.piecesPerUnit,
    item.unitCost,
    item.localQuantity,
    item.transferQuantity,
    item.manualProductName,
    item.manualSpecification,
    item.manualWeight,
    item.manualUnit,
  ];

  return fieldsToCheck.some(value => {
    if (typeof value === 'number') {
      return Number.isFinite(value) && Math.abs(value) > QUANTITY_EPSILON;
    }
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    return Boolean(value);
  });
};

const shouldIncludeTransformedItem = (
  source: SalesOrderFormItem,
  transformed: SalesOrderItemCreateInput | SalesOrderItemUpdateInput,
  isDraft: boolean
): boolean => {
  if (!isDraft) {
    const hasPositiveQuantity =
      typeof transformed.quantity === 'number' && transformed.quantity > 0;
    const hasPositivePrice =
      typeof transformed.unitPrice === 'number' && transformed.unitPrice > 0;

    if (!hasPositiveQuantity || !hasPositivePrice) {
      return false;
    }

    if (transformed.isManualProduct) {
      return Boolean(
        transformed.manualProductName?.trim() || transformed.productCode?.trim()
      );
    }
    return Boolean(transformed.productId?.trim());
  }

  if (!hasMeaningfulItemContent(source)) {
    return false;
  }

  if (source.isManualProduct) {
    return Boolean(
      source.manualProductName?.trim() || source.productCode?.trim()
    );
  }

  return Boolean(source.productId?.trim());
};

function sanitizeFeeItems(feeItems?: SalesOrderFeeItem[]): SalesOrderFeeItem[] {
  if (!Array.isArray(feeItems)) {
    return [];
  }

  return feeItems
    .map(item => {
      const feeAmount = toNumberOrDefault(item.feeAmount, 0);
      const trimmedName = item.feeName?.trim() ?? '';

      return {
        id: item.id,
        feeType: item.feeType ?? 'other',
        feeName:
          trimmedName.length > 0
            ? trimmedName
            : FEE_TYPE_LABELS[item.feeType ?? 'other'],
        feeAmount: feeAmount < 0 ? 0 : Number(feeAmount.toFixed(2)),
        paidBy: item.paidBy ?? getDefaultFeePaidBy(item.feeType),
        remarks: item.remarks?.trim() || undefined,
      };
    })
    .filter(item => item.feeName.length > 0 && item.feeAmount >= 0);
}

/**
 * 转换表单数据为创建销售订单的API输入
 * @param formData 表单数据
 * @returns API创建输入数据
 */
export function transformFormDataToCreateInput(
  formData: SalesOrderFormData
): SalesOrderCreateInput {
  const isDraft = (formData.status ?? 'draft') === 'draft';
  const items: SalesOrderItemCreateInput[] = [];

  formData.items.forEach(formItem => {
    const transformed = transformFormItemToCreateInput(formItem);
    if (shouldIncludeTransformedItem(formItem, transformed, isDraft)) {
      items.push(transformed);
    }
  });

  const sanitizedFeeItems = sanitizeFeeItems(formData.feeItems);
  const effectiveOrderType = formData.orderType || 'NORMAL';
  const transferMode: TransferFulfillmentMode | undefined =
    effectiveOrderType === 'TRANSFER'
      ? (formData.transferMode ?? 'SUPPLIER_ONLY')
      : undefined;

  return {
    customerId: formData.customerId,
    status: formData.status || 'draft',
    orderType: effectiveOrderType,
    transferMode,
    orderDate: formData.orderDate?.trim() || undefined,
    isSampleOrder: formData.isSampleOrder ?? false,
    sampleSettlementType:
      formData.sampleSettlementType ?? DEFAULT_SAMPLE_SETTLEMENT_TYPE,
    supplierId: formData.supplierId?.trim() || undefined,
    costAmount: formData.costAmount || undefined,
    remarks: formData.remarks?.trim() || undefined,
    items,
    feeItems: sanitizedFeeItems.length ? sanitizedFeeItems : undefined,
    roundingAdjustment: formData.roundingAdjustment ?? undefined,
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
  const quantity = toNumberOrDefault(formItem.quantity, 0);
  const rawUnitPrice = toNumberOrDefault(formItem.unitPrice, 0);
  const displayUnit = formItem.displayUnit || '片';
  const piecesPerUnit = toOptionalNumber(formItem.piecesPerUnit);
  const unitCost = toOptionalNumber(formItem.unitCost);
  const localQuantity = toOptionalNumber(formItem.localQuantity);
  const transferQuantity = toOptionalNumber(formItem.transferQuantity);

  // 统一单价语义：数据库内部仍按“片单价”存储，但行小计必须与销售员录入的单位/单价严格一致
  // 1) displayUnit === '件' 时：
  //    - 销售员录入的是“每件单价”
  //    - 行小计 = 件数 * 每件单价（严格保留两位小数）
  //    - 片单价 = 行小计 / 总片数（用于内部成本/统计，允许出现四舍五入差异）
  // 2) 其他情况：
  //    - 行小计 = 片数 * 片单价
  let normalizedUnitPrice = rawUnitPrice;
  let displayQuantity = toOptionalNumber(formItem.displayQuantity);
  if (displayQuantity === undefined) {
    displayQuantity =
      displayUnit === '件' && piecesPerUnit && piecesPerUnit > 0
        ? quantity / piecesPerUnit
        : quantity;
  }
  let subtotal: number;

  if (displayUnit === '件' && piecesPerUnit && piecesPerUnit > 0) {
    // 件数：优先使用 displayQuantity，否则从片数反推
    const units =
      displayQuantity > 0 ? displayQuantity : quantity / piecesPerUnit;
    // 行小计按照“每件单价”计算，确保与销售员输入一致
    subtotal = calculateItemSubtotal(units, rawUnitPrice);

    // 为了兼容后端内部“片单价”逻辑，这里推导一个近似的片单价存入 unitPrice
    const safeQuantity = quantity > 0 ? quantity : units * piecesPerUnit;
    const piecePrice =
      safeQuantity > 0 ? subtotal / safeQuantity : rawUnitPrice;
    normalizedUnitPrice = Math.round(piecePrice * 100) / 100;

    // 如果 displayQuantity 之前为空，这里补回计算出的件数，便于后续展示
    displayQuantity = units;
  } else {
    // 显示单位为“片”或未知：直接按片单价计算小计
    subtotal = calculateItemSubtotal(quantity, rawUnitPrice);
    normalizedUnitPrice = rawUnitPrice;
  }

  // 手动输入产品的情况
  if (formItem.isManualProduct) {
    return {
      productId: formItem.productId?.trim() || undefined,
      productCode: formItem.productCode?.trim() || undefined,
      quantity,
      unitPrice: normalizedUnitPrice,
      batchNumber: formItem.batchNumber?.trim() || undefined,
      colorCode: formItem.colorCode,
      productionDate: formItem.productionDate,
      unitCost,
      localQuantity,
      transferQuantity,
      displayUnit,
      displayQuantity,
      piecesPerUnit,
      specification:
        formItem.specification || formItem.manualSpecification || undefined,
      remarks: formItem.remarks?.trim() || undefined,
      isManualProduct: true,
      manualProductName: formItem.manualProductName?.trim() || undefined,
      manualSpecification: formItem.manualSpecification?.trim() || undefined,
      manualWeight: toOptionalNumber(formItem.manualWeight),
      manualUnit: formItem.manualUnit?.trim() || undefined,
    };
  }

  // 普通产品的情况
  return {
    productId: formItem.productId?.trim() || undefined,
    productCode: formItem.productCode?.trim() || undefined,
    batchNumber: formItem.batchNumber?.trim() || undefined,
    quantity,
    unitPrice: normalizedUnitPrice,
    colorCode: formItem.colorCode,
    productionDate: formItem.productionDate,
    unitCost,
    localQuantity,
    transferQuantity,
    displayUnit,
    displayQuantity,
    piecesPerUnit,
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
  const isDraft = (formData.status ?? 'draft') === 'draft';
  const items: SalesOrderItemUpdateInput[] = [];

  formData.items.forEach(formItem => {
    const transformed = transformFormItemToUpdateInput(formItem);
    if (shouldIncludeTransformedItem(formItem, transformed, isDraft)) {
      items.push(transformed);
    }
  });

  const sanitizedFeeItems = sanitizeFeeItems(formData.feeItems);
  const effectiveOrderType = formData.orderType;
  const transferMode: TransferFulfillmentMode | undefined =
    effectiveOrderType === 'TRANSFER'
      ? (formData.transferMode ?? 'SUPPLIER_ONLY')
      : undefined;

  return {
    id: orderId,
    customerId: formData.customerId,
    status: formData.status,
    orderType: effectiveOrderType,
    transferMode,
    orderDate: formData.orderDate?.trim() || undefined,
    isSampleOrder: formData.isSampleOrder ?? false,
    sampleSettlementType:
      formData.sampleSettlementType ?? DEFAULT_SAMPLE_SETTLEMENT_TYPE,
    supplierId: formData.supplierId?.trim() || undefined,
    costAmount: formData.costAmount ?? undefined,
    remarks: formData.remarks?.trim() || undefined,
    items,
    feeItems: sanitizedFeeItems.length ? sanitizedFeeItems : undefined,
    roundingAdjustment: formData.roundingAdjustment ?? undefined,
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
  const quantity = toNumberOrDefault(formItem.quantity, 0);
  const rawUnitPrice = toNumberOrDefault(formItem.unitPrice, 0);
  const displayUnit = formItem.displayUnit || '片';
  const piecesPerUnit = toOptionalNumber(formItem.piecesPerUnit);
  const unitCost = toOptionalNumber(formItem.unitCost);
  const localQuantity = toOptionalNumber(formItem.localQuantity);
  const transferQuantity = toOptionalNumber(formItem.transferQuantity);

  // 与创建逻辑保持一致：保证行小计与销售员录入的单位/单价一致
  let normalizedUnitPrice = rawUnitPrice;
  let displayQuantity = toOptionalNumber(formItem.displayQuantity);
  if (displayQuantity === undefined) {
    displayQuantity =
      displayUnit === '件' && piecesPerUnit && piecesPerUnit > 0
        ? quantity / piecesPerUnit
        : quantity;
  }
  let subtotal: number | undefined;

  if (displayUnit === '件' && piecesPerUnit && piecesPerUnit > 0) {
    const units =
      displayQuantity > 0 ? displayQuantity : quantity / piecesPerUnit;
    subtotal = calculateItemSubtotal(units, rawUnitPrice);

    const safeQuantity = quantity > 0 ? quantity : units * piecesPerUnit;
    const piecePrice =
      safeQuantity > 0 ? subtotal / safeQuantity : rawUnitPrice;
    normalizedUnitPrice = Math.round(piecePrice * 100) / 100;

    displayQuantity = units;
  } else {
    subtotal = calculateItemSubtotal(quantity, rawUnitPrice);
    normalizedUnitPrice = rawUnitPrice;
  }

  // 手动输入产品的情况
  if (formItem.isManualProduct) {
    return {
      productId: formItem.productId?.trim() || undefined,
      productCode: formItem.productCode?.trim() || undefined,
      quantity,
      unitPrice: normalizedUnitPrice,
      batchNumber: formItem.batchNumber?.trim() || undefined,
      colorCode: formItem.colorCode,
      productionDate: formItem.productionDate,
      unitCost,
      localQuantity,
      transferQuantity,
      displayUnit,
      displayQuantity,
      piecesPerUnit,
      specification:
        formItem.specification || formItem.manualSpecification || undefined,
      remarks: formItem.remarks?.trim() || undefined,
      isManualProduct: true,
      manualProductName: formItem.manualProductName?.trim() || undefined,
      manualSpecification: formItem.manualSpecification?.trim() || undefined,
      manualWeight: toOptionalNumber(formItem.manualWeight),
      manualUnit: formItem.manualUnit?.trim() || undefined,
    };
  }

  // 普通产品的情况
  return {
    productId: formItem.productId?.trim() || undefined,
    productCode: formItem.productCode?.trim() || undefined,
    batchNumber: formItem.batchNumber?.trim() || undefined,
    quantity,
    unitPrice: normalizedUnitPrice,
    colorCode: formItem.colorCode,
    productionDate: formItem.productionDate,
    unitCost,
    localQuantity,
    transferQuantity,
    displayUnit,
    displayQuantity,
    piecesPerUnit,
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

function deriveTransferMode(
  formData: SalesOrderFormData
): TransferFulfillmentMode | undefined {
  if (formData.orderType !== 'TRANSFER') {
    return undefined;
  }
  return formData.transferMode ?? 'SUPPLIER_ONLY';
}

function validateCustomer(formData: SalesOrderFormData) {
  const errors: string[] = [];

  if (!formData.customerId?.trim()) {
    errors.push('请选择客户');
  }

  return errors;
}

function validateItems(
  items: SalesOrderFormItem[],
  formData: SalesOrderFormData,
  transferMode?: TransferFulfillmentMode
) {
  const errors: string[] = [];

  if (items.length === 0) {
    errors.push('至少需要添加一个订单明细');
    return errors;
  }

  items.forEach((item, index) => {
    const position = index + 1;

    if (item.isManualProduct) {
      const manualCode = item.productCode?.trim() ?? '';
      if (!manualCode) {
        errors.push(`第${position}个明细项：手动输入产品必须填写产品编码`);
      }
    } else if (!item.productId?.trim()) {
      errors.push(`第${position}个明细项：请选择产品`);
    }

    const itemQuantity = toNumberOrDefault(item.quantity, 0);
    if (itemQuantity <= 0) {
      errors.push(`第${position}个明细项：数量必须大于0`);
    }

    if (item.unitPrice === undefined || item.unitPrice < 0) {
      errors.push(`第${position}个明细项：单价不能为负数`);
    }

    if (formData.orderType === 'TRANSFER') {
      const effectiveMode = transferMode ?? 'SUPPLIER_ONLY';
      const localQuantity = toNumberOrDefault(item.localQuantity, 0);
      const transferQuantity =
        effectiveMode === 'MIXED'
          ? toNumberOrDefault(item.transferQuantity, 0)
          : toNumberOrDefault(item.transferQuantity, itemQuantity);

      if (effectiveMode === 'MIXED') {
        if (localQuantity < 0) {
          errors.push(`第${position}个明细项：本地发货数量不能为负数`);
        }
        if (transferQuantity < 0) {
          errors.push(`第${position}个明细项：调货数量不能为负数`);
        }
        if (
          Math.abs(localQuantity + transferQuantity - itemQuantity) >
          QUANTITY_EPSILON
        ) {
          errors.push(
            `第${position}个明细项：本地发货数量与调货数量之和必须等于系统数量`
          );
        }
      } else {
        if (Math.abs(localQuantity) > QUANTITY_EPSILON) {
          errors.push(
            `第${position}个明细项：调货模式下本地发货数量应为0，请检查`
          );
        }
        if (Math.abs(transferQuantity - itemQuantity) > QUANTITY_EPSILON) {
          errors.push(
            `第${position}个明细项：调货模式下调货数量必须等于系统数量`
          );
        }
      }

      const unitCost = toOptionalNumber(item.unitCost);
      if (unitCost !== undefined && unitCost < 0) {
        errors.push(`第${position}个明细项：成本单价不能为负数`);
      }
    }
  });

  return errors;
}

function validateTransferRequirements(
  formData: SalesOrderFormData,
  transferMode?: TransferFulfillmentMode
) {
  if (formData.orderType !== 'TRANSFER') {
    return [];
  }

  const errors: string[] = [];
  const allowedModes: TransferFulfillmentMode[] = ['SUPPLIER_ONLY', 'MIXED'];

  if (!formData.supplierId?.trim()) {
    errors.push('调货销售必须选择供应商');
  }
  if (!formData.transferMode) {
    errors.push('请选择调货履约模式');
  } else if (!allowedModes.includes(formData.transferMode)) {
    errors.push('请选择有效的调货履约模式');
  } else if (transferMode && !allowedModes.includes(transferMode)) {
    errors.push('请选择有效的调货履约模式');
  }

  return errors;
}

function validateFeeItems(feeItems?: SalesOrderFeeItem[]) {
  const errors: string[] = [];

  (feeItems ?? []).forEach((feeItem, index) => {
    const trimmedName = feeItem.feeName?.trim() ?? '';
    if (!trimmedName) {
      errors.push(`第${index + 1}个费用项：费用名称不能为空`);
    }

    const amount = toNumberOrDefault(feeItem.feeAmount, 0);
    if (amount < 0) {
      errors.push(`第${index + 1}个费用项：费用金额不能为负数`);
    }
  });

  return errors;
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
  const isDraft = (formData.status ?? 'draft') === 'draft';
  if (isDraft) {
    return { valid: true, errors: [] };
  }

  const items = Array.isArray(formData.items) ? formData.items : [];
  const transferMode = deriveTransferMode(formData);

  const errors = [
    ...validateCustomer(formData),
    ...validateItems(items, formData, transferMode),
    ...validateTransferRequirements(formData, transferMode),
    ...validateFeeItems(formData.feeItems),
  ];

  return {
    valid: errors.length === 0,
    errors,
  };
}
