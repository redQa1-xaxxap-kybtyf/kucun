/**
 * 通用验证辅助函数
 * 统一管理项目中的验证逻辑，避免重复定义
 */

/**
 * 生产日期验证
 * @param dateString 日期字符串
 * @returns 是否有效
 */
export const validateProductionDate = (dateString: string): boolean => {
  if (!dateString) return true; // 可选字段

  try {
    const date = new Date(dateString);
    const now = new Date();

    // 生产日期不能是未来日期
    if (date > now) return false;

    // 生产日期不能太久远（比如超过10年）
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(now.getFullYear() - 10);
    if (date < tenYearsAgo) return false;

    return true;
  } catch {
    return false;
  }
};

/**
 * 色号验证
 * @param colorCode 色号字符串
 * @returns 是否有效
 */
export const validateColorCode = (colorCode: string): boolean => {
  if (!colorCode) return true; // 可选字段

  // 色号格式：字母+数字组合，长度3-20
  const colorCodeRegex = /^[A-Z0-9]{3,20}$/;
  return colorCodeRegex.test(colorCode.toUpperCase());
};

/**
 * 支付金额验证
 * @param amount 金额
 * @param maxAmount 最大金额
 * @returns 是否有效
 */
export const validatePaymentAmount = (
  amount: number,
  maxAmount: number
): boolean => amount > 0 && amount <= maxAmount;
