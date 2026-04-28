/**
 * 打印设计器 - 字体回退栈
 *
 * 为常见中文打印字体补上跨平台回退，减少不同机器上的排版偏差。
 */

import type { FontFamily } from '@/lib/print-designer/schemas';

const FONT_FAMILY_STACK: Record<FontFamily, string> = {
  SimSun:
    '"SimSun","Songti SC","STSong","Noto Serif CJK SC","Source Han Serif SC",serif',
  SimHei:
    '"SimHei","Heiti SC","STHeiti","Noto Sans CJK SC","Source Han Sans SC",sans-serif',
  'Microsoft YaHei':
    '"Microsoft YaHei","PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Source Han Sans SC",sans-serif',
  Arial: 'Arial,"Helvetica Neue",Helvetica,sans-serif',
  'Times New Roman':
    '"Times New Roman","Noto Serif CJK SC","Source Han Serif SC",serif',
};

export function resolveFontFamilyStack(fontFamily: FontFamily): string {
  return FONT_FAMILY_STACK[fontFamily] ?? FONT_FAMILY_STACK.SimSun;
}
