import type { CreateInput, Tx } from './types';

export const maybeCreatePayable = async (
  tx: Tx,
  data: CreateInput,
  costAmount: number,
  userId: string,
  salesOrder: {
    id: string;
    orderNumber: string;
  }
) => {
  if (
    data.orderType !== 'TRANSFER' ||
    !data.supplierId ||
    costAmount <= 0 ||
    data.status !== 'confirmed'
  ) {
    return;
  }

  const payableNumber = `PAY-${Date.now()}-${salesOrder.id.slice(-6)}`;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  await tx.payableRecord.create({
    data: {
      payableNumber,
      supplierId: data.supplierId,
      userId,
      sourceType: 'sales_order',
      sourceId: salesOrder.id,
      sourceNumber: salesOrder.orderNumber,
      payableAmount: costAmount,
      remainingAmount: costAmount,
      dueDate,
      status: 'pending',
      paymentTerms: '30天',
      description: `调货销售订单 ${salesOrder.orderNumber} 自动生成应付款`,
      remarks: `关联销售订单：${salesOrder.orderNumber}，成本金额：￥${costAmount.toFixed(2)}`,
    },
  });
};
