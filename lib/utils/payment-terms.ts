/**
 * 付款条款和应收账款业务逻辑工具
 * 支持不同客户的个性化付款条款和逾期判断
 */

export interface PaymentTerms {
  /** 付款期限（天数） */
  paymentDays: number;
  /** 宽限期（天数） */
  gracePeriod: number;
  /** 早付折扣率（%） */
  earlyPaymentDiscount?: number;
  /** 早付期限（天数） */
  earlyPaymentDays?: number;
  /** 滞纳金率（%/天） */
  lateFeeRate?: number;
}

export interface CustomerPaymentTerms extends PaymentTerms {
  customerId: string;
  /** 信用额度 */
  creditLimit?: number;
  /** 风险等级 */
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * 默认付款条款配置
 */
export const DEFAULT_PAYMENT_TERMS: PaymentTerms = {
  paymentDays: 30,
  gracePeriod: 3,
  earlyPaymentDiscount: 2,
  earlyPaymentDays: 10,
  lateFeeRate: 0.05,
};

/**
 * 常用付款条款预设
 */
export const COMMON_PAYMENT_TERMS = {
  NET_15: { paymentDays: 15, gracePeriod: 2 },
  NET_30: { paymentDays: 30, gracePeriod: 3 },
  NET_45: { paymentDays: 45, gracePeriod: 5 },
  NET_60: { paymentDays: 60, gracePeriod: 7 },
  COD: { paymentDays: 0, gracePeriod: 0 }, // 货到付款
  PREPAID: { paymentDays: -1, gracePeriod: 0 }, // 预付款
} as const;

/**
 * 计算订单到期日期
 */
export function calculateDueDate(
  orderDate: Date,
  paymentTerms: PaymentTerms = DEFAULT_PAYMENT_TERMS
): Date {
  const dueDate = new Date(orderDate);
  dueDate.setDate(dueDate.getDate() + paymentTerms.paymentDays);
  return dueDate;
}

/**
 * 计算早付截止日期
 */
export function calculateEarlyPaymentDate(
  orderDate: Date,
  paymentTerms: PaymentTerms = DEFAULT_PAYMENT_TERMS
): Date | null {
  if (!paymentTerms.earlyPaymentDays) return null;
  
  const earlyDate = new Date(orderDate);
  earlyDate.setDate(earlyDate.getDate() + paymentTerms.earlyPaymentDays);
  return earlyDate;
}

/**
 * 判断付款状态
 */
export function getPaymentStatus(
  totalAmount: number,
  paidAmount: number,
  orderDate: Date,
  paymentTerms: PaymentTerms = DEFAULT_PAYMENT_TERMS
): {
  status: 'unpaid' | 'partial' | 'paid' | 'overdue' | 'overpaid';
  isOverdue: boolean;
  overdueDays: number;
  remainingAmount: number;
  overpaidAmount: number;
} {
  const dueDate = calculateDueDate(orderDate, paymentTerms);
  const gracePeriodEnd = new Date(dueDate);
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + paymentTerms.gracePeriod);
  
  const now = new Date();
  const isOverdue = now > gracePeriodEnd && paidAmount < totalAmount;
  const overdueDays = isOverdue 
    ? Math.floor((now.getTime() - gracePeriodEnd.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  
  const remainingAmount = Math.max(0, totalAmount - paidAmount);
  const overpaidAmount = Math.max(0, paidAmount - totalAmount);
  
  let status: 'unpaid' | 'partial' | 'paid' | 'overdue' | 'overpaid';
  
  if (paidAmount === 0) {
    status = isOverdue ? 'overdue' : 'unpaid';
  } else if (paidAmount >= totalAmount) {
    status = overpaidAmount > 0 ? 'overpaid' : 'paid';
  } else {
    status = isOverdue ? 'overdue' : 'partial';
  }
  
  return {
    status,
    isOverdue,
    overdueDays,
    remainingAmount,
    overpaidAmount,
  };
}

/**
 * 计算早付折扣金额
 */
export function calculateEarlyPaymentDiscount(
  totalAmount: number,
  paymentDate: Date,
  orderDate: Date,
  paymentTerms: PaymentTerms = DEFAULT_PAYMENT_TERMS
): number {
  if (!paymentTerms.earlyPaymentDiscount || !paymentTerms.earlyPaymentDays) {
    return 0;
  }
  
  const earlyPaymentDate = calculateEarlyPaymentDate(orderDate, paymentTerms);
  if (!earlyPaymentDate || paymentDate > earlyPaymentDate) {
    return 0;
  }
  
  return totalAmount * (paymentTerms.earlyPaymentDiscount / 100);
}

/**
 * 计算滞纳金
 */
export function calculateLateFee(
  remainingAmount: number,
  overdueDays: number,
  paymentTerms: PaymentTerms = DEFAULT_PAYMENT_TERMS
): number {
  if (!paymentTerms.lateFeeRate || overdueDays <= 0) {
    return 0;
  }
  
  return remainingAmount * (paymentTerms.lateFeeRate / 100) * overdueDays;
}

/**
 * 获取客户付款条款（模拟从数据库获取）
 * 实际项目中应该从数据库的客户表或付款条款表中获取
 */
export function getCustomerPaymentTerms(customerId: string): PaymentTerms {
  // 这里可以根据客户ID从数据库获取个性化付款条款
  // 暂时返回默认条款
  return DEFAULT_PAYMENT_TERMS;
}

/**
 * 批量计算应收账款状态
 */
export function calculateReceivablesStatus(orders: Array<{
  id: string;
  customerId: string;
  totalAmount: number;
  paidAmount: number;
  createdAt: Date;
}>) {
  return orders.map(order => {
    const paymentTerms = getCustomerPaymentTerms(order.customerId);
    const paymentStatus = getPaymentStatus(
      order.totalAmount,
      order.paidAmount,
      order.createdAt,
      paymentTerms
    );
    
    return {
      ...order,
      ...paymentStatus,
      dueDate: calculateDueDate(order.createdAt, paymentTerms),
      paymentTerms,
    };
  });
}

/**
 * 风险评估
 */
export function assessPaymentRisk(
  customerId: string,
  overdueDays: number,
  overdueAmount: number,
  totalOutstanding: number
): {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  recommendations: string[];
} {
  let riskScore = 0;
  const recommendations: string[] = [];
  
  // 逾期天数评分
  if (overdueDays > 90) {
    riskScore += 40;
    recommendations.push('客户逾期超过90天，建议立即催收');
  } else if (overdueDays > 60) {
    riskScore += 30;
    recommendations.push('客户逾期超过60天，建议加强催收');
  } else if (overdueDays > 30) {
    riskScore += 20;
    recommendations.push('客户逾期超过30天，建议及时跟进');
  }
  
  // 逾期金额占比评分
  const overdueRatio = totalOutstanding > 0 ? (overdueAmount / totalOutstanding) * 100 : 0;
  if (overdueRatio > 80) {
    riskScore += 30;
    recommendations.push('逾期金额占比过高，建议暂停新订单');
  } else if (overdueRatio > 50) {
    riskScore += 20;
    recommendations.push('逾期金额占比较高，建议控制信用额度');
  }
  
  // 绝对逾期金额评分
  if (overdueAmount > 100000) {
    riskScore += 20;
    recommendations.push('逾期金额较大，建议法务介入');
  } else if (overdueAmount > 50000) {
    riskScore += 10;
    recommendations.push('逾期金额较大，建议高级管理层关注');
  }
  
  // 确定风险等级
  let riskLevel: 'low' | 'medium' | 'high' | 'critical';
  if (riskScore >= 70) {
    riskLevel = 'critical';
  } else if (riskScore >= 50) {
    riskLevel = 'high';
  } else if (riskScore >= 30) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }
  
  return {
    riskLevel,
    riskScore,
    recommendations,
  };
}
