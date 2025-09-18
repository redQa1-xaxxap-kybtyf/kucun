/**
 * 统一的样式类名工具
 * 避免在组件中重复定义相同的样式组合
 */

import { cn } from '@/lib/utils';

/**
 * 常用的布局样式组合
 */
export const layoutStyles = {
  // Flex 布局组合
  flexCenter: 'flex items-center justify-center',
  flexBetween: 'flex items-center justify-between',
  flexStart: 'flex items-center justify-start',
  flexEnd: 'flex items-center justify-end',
  flexCol: 'flex flex-col',
  flexColCenter: 'flex flex-col items-center justify-center',
  
  // 常用间距组合
  flexGap2: 'flex items-center gap-2',
  flexGap3: 'flex items-center gap-3',
  flexGap4: 'flex items-center gap-4',
  flexColGap2: 'flex flex-col gap-2',
  flexColGap3: 'flex flex-col gap-3',
  flexColGap4: 'flex flex-col gap-4',
  
  // 网格布局
  gridCols2: 'grid grid-cols-2 gap-4',
  gridCols3: 'grid grid-cols-3 gap-4',
  gridCols4: 'grid grid-cols-4 gap-4',
  gridResponsive: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
  
  // 容器样式
  container: 'container mx-auto px-4',
  containerSm: 'max-w-sm mx-auto px-4',
  containerMd: 'max-w-md mx-auto px-4',
  containerLg: 'max-w-lg mx-auto px-4',
  containerXl: 'max-w-xl mx-auto px-4',
  
  // 卡片样式
  card: 'bg-card text-card-foreground rounded-lg border shadow-sm',
  cardPadded: 'bg-card text-card-foreground rounded-lg border shadow-sm p-6',
  cardHover: 'bg-card text-card-foreground rounded-lg border shadow-sm hover:shadow-md transition-shadow',
} as const;

/**
 * 表单相关样式
 */
export const formStyles = {
  // 表单容器
  formContainer: 'space-y-6',
  formSection: 'space-y-4',
  formRow: 'grid grid-cols-1 md:grid-cols-2 gap-4',
  formRowFull: 'grid grid-cols-1 gap-4',
  
  // 表单字段
  fieldGroup: 'space-y-2',
  fieldLabel: 'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
  fieldError: 'text-sm font-medium text-destructive',
  fieldDescription: 'text-sm text-muted-foreground',
  
  // 按钮组
  buttonGroup: 'flex items-center gap-2',
  buttonGroupEnd: 'flex items-center justify-end gap-2',
  buttonGroupBetween: 'flex items-center justify-between gap-2',
} as const;

/**
 * 表格相关样式
 */
export const tableStyles = {
  // 表格容器
  tableContainer: 'rounded-md border',
  tableWrapper: 'relative w-full overflow-auto',
  
  // 表格头部
  tableHeader: 'border-b bg-muted/50',
  tableHeaderCell: 'h-12 px-4 text-left align-middle font-medium text-muted-foreground',
  
  // 表格行
  tableRow: 'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
  tableCell: 'p-4 align-middle',
  tableCellCenter: 'p-4 align-middle text-center',
  tableCellRight: 'p-4 align-middle text-right',
  
  // 表格状态
  tableEmpty: 'h-24 text-center text-muted-foreground',
  tableLoading: 'h-24 text-center',
} as const;

/**
 * 状态样式
 */
export const statusStyles = {
  // 成功状态
  success: 'text-green-600 bg-green-50 border-green-200',
  successBadge: 'bg-green-100 text-green-800 border-green-200',
  
  // 警告状态
  warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  warningBadge: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  
  // 错误状态
  error: 'text-red-600 bg-red-50 border-red-200',
  errorBadge: 'bg-red-100 text-red-800 border-red-200',
  
  // 信息状态
  info: 'text-blue-600 bg-blue-50 border-blue-200',
  infoBadge: 'bg-blue-100 text-blue-800 border-blue-200',
  
  // 中性状态
  neutral: 'text-gray-600 bg-gray-50 border-gray-200',
  neutralBadge: 'bg-gray-100 text-gray-800 border-gray-200',
} as const;

/**
 * 动画样式
 */
export const animationStyles = {
  // 过渡动画
  transition: 'transition-all duration-200 ease-in-out',
  transitionFast: 'transition-all duration-150 ease-in-out',
  transitionSlow: 'transition-all duration-300 ease-in-out',
  
  // 悬停效果
  hoverScale: 'hover:scale-105 transition-transform duration-200',
  hoverShadow: 'hover:shadow-lg transition-shadow duration-200',
  hoverOpacity: 'hover:opacity-80 transition-opacity duration-200',
  
  // 焦点效果
  focusRing: 'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  focusVisible: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
} as const;

/**
 * 响应式样式
 */
export const responsiveStyles = {
  // 隐藏/显示
  hiddenMobile: 'hidden md:block',
  hiddenDesktop: 'block md:hidden',
  hiddenTablet: 'hidden lg:block',
  
  // 文本大小
  textResponsive: 'text-sm md:text-base',
  textLargeResponsive: 'text-base md:text-lg',
  textSmallResponsive: 'text-xs md:text-sm',
  
  // 间距
  paddingResponsive: 'p-4 md:p-6',
  marginResponsive: 'm-4 md:m-6',
  gapResponsive: 'gap-2 md:gap-4',
} as const;

/**
 * 组合样式工具函数
 */
export const combineStyles = {
  /**
   * 创建带有基础样式的组合
   */
  withBase: (baseStyle: string, additionalStyles?: string) => 
    cn(baseStyle, additionalStyles),
    
  /**
   * 创建条件样式
   */
  conditional: (condition: boolean, trueStyle: string, falseStyle?: string) =>
    condition ? trueStyle : (falseStyle || ''),
    
  /**
   * 创建变体样式
   */
  variant: <T extends string>(
    variants: Record<T, string>,
    selectedVariant: T,
    baseStyle?: string
  ) => cn(baseStyle, variants[selectedVariant]),
};

// 导出所有样式类型
export type LayoutStyle = keyof typeof layoutStyles;
export type FormStyle = keyof typeof formStyles;
export type TableStyle = keyof typeof tableStyles;
export type StatusStyle = keyof typeof statusStyles;
export type AnimationStyle = keyof typeof animationStyles;
export type ResponsiveStyle = keyof typeof responsiveStyles;
