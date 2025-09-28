/**
 * 付款条款管理工具
 * 支持个性化付款条款和宽限期管理
 */

export interface PaymentTerm {
  id: string;
  name: string;
  description: string;
  daysToPayment: number;
  gracePeriodDays: number;
  isDefault: boolean;
  isActive: boolean;
}

export interface CustomerPaymentTerm {
  customerId: string;
  paymentTermId: string;
  effectiveDate: Date;
  notes?: string;
}

// 标准付款条款
export const STANDARD_PAYMENT_TERMS: PaymentTerm[] = [
  {
    id: 'net-30',
    name: 'Net 30',
    description: '30天内付款',
    daysToPayment: 30,
    gracePeriodDays: 5,
    isDefault: true,
    isActive: true,
  },
  {
    id: 'net-15',
    name: 'Net 15',
    description: '15天内付款',
    daysToPayment: 15,
    gracePeriodDays: 3,
    isDefault: false,
    isActive: true,
  },
  {
    id: 'net-60',
    name: 'Net 60',
    description: '60天内付款',
    daysToPayment: 60,
    gracePeriodDays: 7,
    isDefault: false,
    isActive: true,
  },
  {
    id: 'immediate',
    name: '即时付款',
    description: '立即付款',
    daysToPayment: 0,
    gracePeriodDays: 0,
    isDefault: false,
    isActive: true,
  },
];

/**
 * 获取默认付款条款
 */
export function getDefaultPaymentTerm(): PaymentTerm {
  return STANDARD_PAYMENT_TERMS.find(term => term.isDefault) || STANDARD_PAYMENT_TERMS[0];
}

/**
 * 根据ID获取付款条款
 */
export function getPaymentTermById(id: string): PaymentTerm | undefined {
  return STANDARD_PAYMENT_TERMS.find(term => term.id === id);
}

/**
 * 获取所有活跃的付款条款
 */
export function getActivePaymentTerms(): PaymentTerm[] {
  return STANDARD_PAYMENT_TERMS.filter(term => term.isActive);
}

/**
 * 计算付款到期日
 */
export function calculateDueDate(
  orderDate: Date,
  paymentTerm: PaymentTerm
): Date {
  const dueDate = new Date(orderDate);
  dueDate.setDate(dueDate.getDate() + paymentTerm.daysToPayment);
  return dueDate;
}

/**
 * 计算宽限期结束日期
 */
export function calculateGracePeriodEndDate(
  dueDate: Date,
  paymentTerm: PaymentTerm
): Date {
  const gracePeriodEndDate = new Date(dueDate);
  gracePeriodEndDate.setDate(gracePeriodEndDate.getDate() + paymentTerm.gracePeriodDays);
  return gracePeriodEndDate;
}

/**
 * 判断是否逾期
 */
export function isOverdue(
  dueDate: Date,
  paymentTerm: PaymentTerm,
  currentDate: Date = new Date()
): boolean {
  const gracePeriodEndDate = calculateGracePeriodEndDate(dueDate, paymentTerm);
  return currentDate > gracePeriodEndDate;
}

/**
 * 计算逾期天数
 */
export function calculateOverdueDays(
  dueDate: Date,
  paymentTerm: PaymentTerm,
  currentDate: Date = new Date()
): number {
  const gracePeriodEndDate = calculateGracePeriodEndDate(dueDate, paymentTerm);
  
  if (currentDate <= gracePeriodEndDate) {
    return 0;
  }
  
  const diffTime = currentDate.getTime() - gracePeriodEndDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 获取客户的付款条款
 * 如果客户没有特定条款，返回默认条款
 */
export function getCustomerPaymentTerm(
  _customerId: string,
  customerPaymentTerms: CustomerPaymentTerm[] = []
): PaymentTerm {
  // 这里可以根据客户ID查找特定的付款条款
  // 目前返回默认条款
  const customerTerm = customerPaymentTerms.find(
    term => term.customerId === _customerId
  );
  
  if (customerTerm) {
    const paymentTerm = getPaymentTermById(customerTerm.paymentTermId);
    if (paymentTerm) {
      return paymentTerm;
    }
  }
  
  return getDefaultPaymentTerm();
}

/**
 * 格式化付款条款显示文本
 */
export function formatPaymentTermDisplay(paymentTerm: PaymentTerm): string {
  if (paymentTerm.daysToPayment === 0) {
    return '即时付款';
  }
  
  const graceText = paymentTerm.gracePeriodDays > 0 
    ? ` (宽限期${paymentTerm.gracePeriodDays}天)` 
    : '';
    
  return `${paymentTerm.daysToPayment}天内付款${graceText}`;
}

/**
 * 获取付款状态文本
 */
export function getPaymentStatusText(
  dueDate: Date,
  paymentTerm: PaymentTerm,
  isPaid: boolean = false,
  currentDate: Date = new Date()
): string {
  if (isPaid) {
    return '已付款';
  }
  
  if (isOverdue(dueDate, paymentTerm, currentDate)) {
    const overdueDays = calculateOverdueDays(dueDate, paymentTerm, currentDate);
    return `逾期 ${overdueDays} 天`;
  }
  
  const daysUntilDue = Math.ceil(
    (dueDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (daysUntilDue <= 0) {
    return '今日到期';
  } else if (daysUntilDue <= 3) {
    return `${daysUntilDue}天后到期`;
  } else {
    return '未到期';
  }
}

/**
 * 获取付款风险等级
 */
export function getPaymentRiskLevel(
  dueDate: Date,
  paymentTerm: PaymentTerm,
  isPaid: boolean = false,
  currentDate: Date = new Date()
): 'low' | 'medium' | 'high' | 'critical' {
  if (isPaid) {
    return 'low';
  }
  
  if (isOverdue(dueDate, paymentTerm, currentDate)) {
    const overdueDays = calculateOverdueDays(dueDate, paymentTerm, currentDate);
    if (overdueDays > 30) {
      return 'critical';
    } else if (overdueDays > 7) {
      return 'high';
    } else {
      return 'medium';
    }
  }
  
  const daysUntilDue = Math.ceil(
    (dueDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (daysUntilDue <= 3) {
    return 'medium';
  }
  
  return 'low';
}
