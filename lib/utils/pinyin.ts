import { pinyin } from 'pinyin-pro';

/**
 * 中文转拼音大写
 * KISS原则: 简单直接的转换逻辑
 *
 * @param text 输入文本(可能包含中文、英文、数字)
 * @returns 大写拼音字符串
 *
 * @example
 * chineseToPinyinUppercase('广州') // => 'GUANGZHOU'
 * chineseToPinyinUppercase('sf123') // => 'SF123'
 * chineseToPinyinUppercase('广州SF123') // => 'GUANGZHOUSF123'
 */
export function chineseToPinyinUppercase(text: string): string {
  if (!text) {
    return '';
  }

  // 如果已经是纯英文数字,直接转大写
  if (/^[A-Za-z0-9]+$/.test(text)) {
    return text.toUpperCase();
  }

  // 转换为拼音(不带声调)
  const pinyinText = pinyin(text, {
    toneType: 'none', // 不带声调
    type: 'array', // 返回数组
  }).join('');

  return pinyinText.toUpperCase();
}

/**
 * 中文转拼音首字母大写
 * 用于首字母匹配搜索体验优化
 */
export function chineseToPinyinInitialsUppercase(text: string): string {
  if (!text) {
    return '';
  }

  const initials = pinyin(text, {
    pattern: 'first',
  });

  if (!initials) {
    return '';
  }

  return initials.replace(/\s+/g, '').toUpperCase();
}
