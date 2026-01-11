/**
 * 统一响应式断点系统
 * 
 * 遵循项目设计规范，提供一致的断点定义和工具函数
 * 与 Tailwind CSS 默认断点保持一致
 * 
 * 使用方式:
 * - CSS/Tailwind: 使用 BREAKPOINT_QUERIES 或直接使用 Tailwind 类
 * - JavaScript: 使用 isBreakpoint() 或 useBreakpoint() Hook
 */

// ============================================================================
// 断点定义
// ============================================================================

/**
 * 断点尺寸（px）
 * 与 Tailwind CSS 默认断点保持一致
 */
export const BREAKPOINTS = {
  /** 小屏手机 */
  xs: 480,
  /** 大屏手机 / 小平板 */
  sm: 640,
  /** 平板竖屏 */
  md: 768,
  /** 平板横屏 / 小笔记本 */
  lg: 1024,
  /** 笔记本 / 桌面 */
  xl: 1280,
  /** 大屏幕 */
  '2xl': 1536,
} as const;

export type BreakpointKey = keyof typeof BREAKPOINTS;

/**
 * 断点媒体查询字符串
 * 用于 CSS-in-JS 或 useMediaQuery Hook
 */
export const BREAKPOINT_QUERIES = {
  /** max-width 查询 (mobile-first 的反向) */
  maxXs: `(max-width: ${BREAKPOINTS.xs - 1}px)`,
  maxSm: `(max-width: ${BREAKPOINTS.sm - 1}px)`,
  maxMd: `(max-width: ${BREAKPOINTS.md - 1}px)`,
  maxLg: `(max-width: ${BREAKPOINTS.lg - 1}px)`,
  maxXl: `(max-width: ${BREAKPOINTS.xl - 1}px)`,
  max2xl: `(max-width: ${BREAKPOINTS['2xl'] - 1}px)`,

  /** min-width 查询 (mobile-first) */
  xs: `(min-width: ${BREAKPOINTS.xs}px)`,
  sm: `(min-width: ${BREAKPOINTS.sm}px)`,
  md: `(min-width: ${BREAKPOINTS.md}px)`,
  lg: `(min-width: ${BREAKPOINTS.lg}px)`,
  xl: `(min-width: ${BREAKPOINTS.xl}px)`,
  '2xl': `(min-width: ${BREAKPOINTS['2xl']}px)`,

  /** 范围查询 */
  xsOnly: `(min-width: ${BREAKPOINTS.xs}px) and (max-width: ${BREAKPOINTS.sm - 1}px)`,
  smOnly: `(min-width: ${BREAKPOINTS.sm}px) and (max-width: ${BREAKPOINTS.md - 1}px)`,
  mdOnly: `(min-width: ${BREAKPOINTS.md}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`,
  lgOnly: `(min-width: ${BREAKPOINTS.lg}px) and (max-width: ${BREAKPOINTS.xl - 1}px)`,
  xlOnly: `(min-width: ${BREAKPOINTS.xl}px) and (max-width: ${BREAKPOINTS['2xl'] - 1}px)`,

  /** 语义化别名 */
  mobile: `(max-width: ${BREAKPOINTS.md - 1}px)`,
  tablet: `(min-width: ${BREAKPOINTS.md}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`,
  desktop: `(min-width: ${BREAKPOINTS.lg}px)`,
  largeScreen: `(min-width: ${BREAKPOINTS.xl}px)`,
} as const;

export type BreakpointQuery = keyof typeof BREAKPOINT_QUERIES;

// ============================================================================
// 设备类型
// ============================================================================

export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'largeScreen';

/**
 * 根据屏幕宽度判断设备类型
 */
export function getDeviceType(width: number): DeviceType {
  if (width < BREAKPOINTS.md) return 'mobile';
  if (width < BREAKPOINTS.lg) return 'tablet';
  if (width < BREAKPOINTS.xl) return 'desktop';
  return 'largeScreen';
}

// ============================================================================
// 服务端/构建时工具
// ============================================================================

/**
 * 检查屏幕宽度是否满足断点条件
 * 可用于服务端渲染或构建时逻辑
 * 
 * @example
 * isBreakpoint(1200, 'lg') // true (>= 1024px)
 * isBreakpoint(600, 'md') // false (< 768px)
 */
export function isBreakpoint(
  width: number,
  breakpoint: BreakpointKey,
  direction: 'min' | 'max' = 'min'
): boolean {
  const breakpointValue = BREAKPOINTS[breakpoint];
  return direction === 'min' ? width >= breakpointValue : width < breakpointValue;
}

/**
 * 获取当前断点名称
 * 
 * @example
 * getCurrentBreakpoint(800) // 'md'
 * getCurrentBreakpoint(1200) // 'lg'
 */
export function getCurrentBreakpoint(width: number): BreakpointKey {
  if (width >= BREAKPOINTS['2xl']) return '2xl';
  if (width >= BREAKPOINTS.xl) return 'xl';
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.md) return 'md';
  if (width >= BREAKPOINTS.sm) return 'sm';
  if (width >= BREAKPOINTS.xs) return 'xs';
  return 'xs';
}

// ============================================================================
// CSS 变量生成（用于 globals.css）
// ============================================================================

/**
 * 生成 CSS 自定义属性（用于主题或动态样式）
 * 
 * 输出示例:
 * --breakpoint-xs: 480px;
 * --breakpoint-sm: 640px;
 * ...
 */
export function generateBreakpointCSSVariables(): string {
  return Object.entries(BREAKPOINTS)
    .map(([key, value]) => `  --breakpoint-${key}: ${value}px;`)
    .join('\n');
}

// ============================================================================
// Tailwind 配置辅助
// ============================================================================

/**
 * 用于扩展 Tailwind 配置的断点对象
 * 
 * @example
 * // tailwind.config.js
 * module.exports = {
 *   theme: {
 *     screens: getTailwindScreens(),
 *   },
 * };
 */
export function getTailwindScreens(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(BREAKPOINTS).map(([key, value]) => [key, `${value}px`])
  );
}
