import { z } from 'zod';

// ✅ 与后端保持一致的收款方式枚举
export const PAYMENT_METHODS = [
  { value: 'cash', label: '现金' },
  { value: 'wechat_transfer', label: '微信转账' },
  { value: 'abc_qr', label: '农业银行收款码' },
  { value: 'icbc_qr', label: '工商银行收款码' },
  { value: 'ccb_qr', label: '建设银行收款码' },
  { value: 'cib_qr', label: '兴业银行收款码' },
] as const;

export const paymentSchema = z.object({
  paymentType: z.literal('order_payment').default('order_payment'),
  salesOrderId: z.string().min(1, { message: '销售订单ID不能为空' }),
  customerId: z.string().min(1, { message: '客户ID不能为空' }),
  // ✅ 与后端 lib/validations/payment.ts 保持一致
  paymentMethod: z.enum(
    ['cash', 'wechat_transfer', 'abc_qr', 'icbc_qr', 'ccb_qr', 'cib_qr'],
    {
      message: '请选择收款方式',
    }
  ),
  paymentAmount: z.number().min(0.01, { message: '收款金额必须大于0' }),
  actualPaymentAmount: z.number().min(0, { message: '实际收款金额不能为负' }),
  roundingAmount: z.number().default(0),
  paymentDate: z.string().min(1, { message: '请选择收款日期' }),
  bankInfo: z.string().optional().or(z.literal('')),
  remarks: z.string().optional().or(z.literal('')),
  receiptNumber: z.string().optional().or(z.literal('')),
});

export type PaymentFormData = z.infer<typeof paymentSchema>;

export interface OrderInfo {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  totalAmount: number;
  roundingAdjustment: number;
  paidAmount: number;
  remainingAmount: number;
}
