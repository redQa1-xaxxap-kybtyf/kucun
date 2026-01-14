import type { Prisma } from '@prisma/client';

import { allocateExpensesByValue } from '@/lib/services/sales-order-expense-service';
import type { SalesOrderFeeItem } from '@/lib/types/sales-order-fee';

import type { CreateInput } from './types';

const roundCurrency = (value: number) => Math.round((value ?? 0) * 100) / 100;

type AllocationSource = {
  id: string;
  subtotal: number;
  costSubtotal: number;
  unitCost: number;
  quantity: number;
};

const buildAllocationSources = (
  data: CreateInput,
  transferMode: CreateInput['transferMode']
): AllocationSource[] =>
  data.items.map((item, index) => {
    const quantity = item.quantity ?? 0;
    const unitPrice = item.unitPrice ?? 0;
    const subtotal = roundCurrency(item.subtotal ?? quantity * unitPrice);
    const effectiveTransferQuantity =
      data.orderType === 'TRANSFER' && transferMode === 'MIXED'
        ? (item.transferQuantity ?? 0)
        : quantity;
    const unitCost = item.unitCost ?? 0;
    const costSubtotal = unitCost * effectiveTransferQuantity;

    return {
      id: String(index),
      subtotal,
      costSubtotal,
      unitCost,
      quantity,
    };
  });

export function calculateCustomerPaidFees(
  feeItems: SalesOrderFeeItem[] = []
): number {
  return feeItems
    .filter(fee => (fee.paidBy ?? 'customer') === 'customer')
    .reduce((sum, fee) => sum + (fee.feeAmount ?? 0), 0);
}

export function calculateCompanyPaidFees(
  feeItems: SalesOrderFeeItem[] = []
): number {
  return feeItems
    .filter(fee => fee.paidBy === 'company')
    .reduce((sum, fee) => sum + (fee.feeAmount ?? 0), 0);
}

const calculateItemTotals = (
  data: CreateInput,
  transferMode: CreateInput['transferMode']
) => {
  const allocationSources = buildAllocationSources(data, transferMode);
  const itemsAmount = roundCurrency(
    allocationSources.reduce((sum, item) => sum + item.subtotal, 0)
  );
  const costAmount = roundCurrency(
    allocationSources.reduce((sum, item) => sum + item.costSubtotal, 0)
  );
  const profitAmount = roundCurrency(itemsAmount - costAmount);

  return { itemsAmount, costAmount, profitAmount, allocationSources };
};

export const normalizeTransferMode = (data: CreateInput) =>
  data.orderType === 'TRANSFER'
    ? (data.transferMode ?? 'SUPPLIER_ONLY')
    : 'SUPPLIER_ONLY';

export const calculateFinancials = (
  data: CreateInput,
  transferMode: CreateInput['transferMode']
) => {
  const { itemsAmount, allocationSources } = calculateItemTotals(
    data,
    transferMode
  );
  const customerPaidFees = roundCurrency(
    calculateCustomerPaidFees(data.feeItems || [])
  );
  const companyPaidFees = roundCurrency(
    calculateCompanyPaidFees(data.feeItems || [])
  );

  // 客户承担费用计入应收；公司承担费用计入成本
  const additionalFees = customerPaidFees;
  const roundingAdjustment = roundCurrency(data.roundingAdjustment ?? 0);

  // ✅ 修复：利润口径与明细一致（避免舍入误差累积）
  // 明细利润已在 allocateExpensesByValue 内做了“最后一项差额兜底”，这里按明细汇总口径回填订单利润
  const allocationResults = allocateExpensesByValue(
    allocationSources,
    companyPaidFees
  );
  const profitAmountWithExpense = roundCurrency(
    allocationResults.reduce((sum, row) => sum + (row.profitAmount ?? 0), 0)
  );
  const costAmountWithExpense = roundCurrency(itemsAmount - profitAmountWithExpense);

  // totalAmount 不包含抹零；实际应收 = totalAmount + roundingAdjustment
  const totalAmount = roundCurrency(itemsAmount + additionalFees);

  return {
    itemsAmount,
    costAmount: costAmountWithExpense,
    profitAmount: profitAmountWithExpense,
    additionalFees,
    expenseAmount: companyPaidFees,
    roundingAdjustment,
    totalAmount,
  };
};

export const buildOrderItemsInput = (
  data: CreateInput,
  transferMode: CreateInput['transferMode'],
  temporaryProductIds?: Map<number, string>
): Prisma.SalesOrderItemUncheckedCreateWithoutSalesOrderInput[] => {
  // 计算公司承担的费用总额
  const companyPaidFees = roundCurrency(
    calculateCompanyPaidFees(data.feeItems || [])
  );

  // 组装用于费用分摊的临时项（保持顺序一致）
  const allocationSources = buildAllocationSources(data, transferMode);

  // 执行按销售金额分摊（若费用为0则结果全为0）
  const allocationResults = allocateExpensesByValue(
    allocationSources,
    companyPaidFees
  );

  // 生成用于创建的订单项输入
  return data.items.map((item, index) => {
    const quantity = item.quantity ?? 0;
    const subtotal = roundCurrency(
      item.subtotal ?? quantity * (item.unitPrice ?? 0)
    );

    // 本地数量：只有调货订单的混合模式才有本地发货
    const localQuantity =
      data.orderType === 'TRANSFER' && transferMode === 'MIXED'
        ? (item.localQuantity ?? 0)
        : 0;
    // 调货数量：调货订单根据模式设置，普通订单为0
    const transferQuantity =
      data.orderType === 'TRANSFER'
        ? transferMode === 'MIXED'
          ? (item.transferQuantity ?? 0)
          : quantity
        : 0;

    const allocation = allocationResults[index];
    const allocatedExpense = allocation?.allocatedExpense ?? 0;
    const costSubtotalWithExpense =
      allocation?.totalCost ?? item.costSubtotal ?? null;
    const profitAmount = allocation?.profitAmount ?? item.profitAmount ?? null;
    const profitMargin = allocation?.profitMargin ?? null;

    return {
      productId: item.productId ?? null,
      temporaryProductId: temporaryProductIds?.get(index) ?? null,
      variantId: item.variantId ?? null,
      productCode: item.productCode ?? null,
      batchNumber: item.batchNumber || null,
      colorCode: item.colorCode ?? null,
      productionDate: item.productionDate ?? null,
      quantity,
      unitPrice: item.unitPrice ?? 0,
      subtotal,
      unitCost: item.unitCost ?? null,
      localQuantity,
      transferQuantity,
      allocatedExpense,
      costSubtotal: costSubtotalWithExpense,
      profitAmount,
      profitMargin,
      displayUnit: item.displayUnit || '片',
      displayQuantity: item.displayQuantity ?? quantity,
      piecesPerUnit: item.piecesPerUnit ?? null,
      specification: item.specification || null,
      remarks: item.remarks || null,
      isManualProduct: item.isManualProduct ?? null,
      manualProductName: item.manualProductName ?? null,
      manualSpecification: item.manualSpecification ?? null,
      manualWeight: item.manualWeight ?? null,
      manualUnit: item.manualUnit ?? null,
    } satisfies Prisma.SalesOrderItemUncheckedCreateWithoutSalesOrderInput;
  });
};

export const buildFeeItemsInput = (data: CreateInput) =>
  data.feeItems?.map(fee => ({
    feeType: fee.feeType,
    feeName: fee.feeName,
    feeAmount: fee.feeAmount,
    paidBy: fee.paidBy ?? 'customer',
    remarks: fee.remarks || null,
  })) ?? [];
