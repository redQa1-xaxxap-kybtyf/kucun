/**
 * 打印设计器 - 单位转换工具
 *
 * mm <-> px 转换，用于屏幕显示与打印尺寸映射
 */

/** 标准屏幕 DPI */
const SCREEN_DPI = 96;

/** 每英寸毫米数 */
const MM_PER_INCH = 25.4;

/**
 * 毫米转像素
 * @param mm - 毫米值
 * @param dpi - DPI (默认 96)
 */
export function mmToPx(mm: number, dpi = SCREEN_DPI): number {
  return (mm / MM_PER_INCH) * dpi;
}

/**
 * 像素转毫米
 * @param px - 像素值
 * @param dpi - DPI (默认 96)
 */
export function pxToMm(px: number, dpi = SCREEN_DPI): number {
  return (px / dpi) * MM_PER_INCH;
}

/**
 * 磅转像素 (用于字体大小)
 * 1pt = 1/72 inch
 * @param pt - 磅值
 * @param dpi - DPI (默认 96)
 */
export function ptToPx(pt: number, dpi = SCREEN_DPI): number {
  return (pt / 72) * dpi;
}

/**
 * 像素转磅
 * @param px - 像素值
 * @param dpi - DPI (默认 96)
 */
export function pxToPt(px: number, dpi = SCREEN_DPI): number {
  return (px / dpi) * 72;
}
