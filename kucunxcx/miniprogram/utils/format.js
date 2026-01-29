'use strict';
// 格式化工具函数
Object.defineProperty(exports, '__esModule', { value: true });
exports.formatUnit = formatUnit;
exports.formatAmount = formatAmount;
exports.formatDate = formatDate;
exports.formatDateTime = formatDateTime;
exports.formatQuantity = formatQuantity;
exports.formatStockStatus = formatStockStatus;
/**
 * 单位中英文映射表
 * 将英文单位转换为中文显示
 */
const UNIT_MAP = {
  // 通用单位
  piece: '件',
  pieces: '件',
  box: '箱',
  boxes: '箱',
  pcs: '个',
  pc: '个',
  // 重量单位
  kg: '千克',
  g: '克',
  ton: '吨',
  // 长度单位
  m: '米',
  cm: '厘米',
  mm: '毫米',
  // 面积和体积
  sqm: '平方米',
  cbm: '立方米',
  // 其他单位
  set: '套',
  sets: '套',
  pair: '对',
  pairs: '对',
  dozen: '打',
  pack: '包',
  packs: '包',
  bag: '袋',
  bags: '袋',
  bottle: '瓶',
  bottles: '瓶',
  can: '罐',
  cans: '罐',
  roll: '卷',
  rolls: '卷',
  sheet: '张',
  sheets: '张',
};
/**
 * 格式化单位 - 将英文单位转换为中文
 * @param unit 英文单位（如 pieces, box, kg 等）
 * @returns 中文单位（如 件、箱、千克等）
 */
function formatUnit(unit) {
  if (!unit) return '';
  return UNIT_MAP[unit.toLowerCase()] || unit;
}
/**
 * 格式化金额 - 使用人民币符号和千分位分隔符
 * @param amount 金额数字
 * @returns 格式化后的金额字符串（如 ￥1,234.56）
 */
function formatAmount(amount) {
  return `￥${amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
/**
 * 格式化日期 - YYYY-MM-DD 格式
 * @param date 日期字符串或Date对象
 * @returns 格式化后的日期字符串
 */
function formatDate(date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
/**
 * 格式化日期时间 - YYYY-MM-DD HH:mm 格式
 * @param date 日期字符串或Date对象
 * @returns 格式化后的日期时间字符串
 */
function formatDateTime(date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
/**
 * 格式化数量显示 - 自动添加中文单位
 * @param quantity 数量
 * @param unit 单位（英文）
 * @param piecesPerUnit 每件包含的片数（可选，用于显示“X件Y片”）
 * @returns 格式化后的数量字符串（如 3件2片 / 100件）
 */
function formatQuantity(quantity, unit, piecesPerUnit) {
  const safeQuantity =
    typeof quantity === 'number' && !Number.isNaN(quantity) ? quantity : 0;
  if (piecesPerUnit && piecesPerUnit > 0) {
    const units = Math.floor(safeQuantity / piecesPerUnit);
    const pieces = safeQuantity % piecesPerUnit;
    if (units === 0) {
      return `${pieces}片`;
    }
    if (pieces === 0) {
      return `${units}件`;
    }
    return `${units}件${pieces}片`;
  }
  return `${safeQuantity}${formatUnit(unit)}`;
}
/**
 * 格式化库存状态
 * @param quantity 库存数量
 * @returns 库存状态文本和颜色类型
 */
function formatStockStatus(quantity) {
  if (quantity > 20) {
    return { text: '充足', type: 'success' };
  } else if (quantity > 0) {
    return { text: '偏低', type: 'warning' };
  } else {
    return { text: '缺货', type: 'error' };
  }
}
