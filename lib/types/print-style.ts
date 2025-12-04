/**
 * 打印样式配置类型定义
 *
 * 用于 DIY 打印模板的样式自定义
 * 支持页面、表头、表格、汇总、页脚、签名区等全方位样式配置
 */

import type { DocumentType } from './print-config';

/**
 * 纸张大小
 */
export type PageSize = 'A4' | 'A5' | 'Letter';

/**
 * 页面方向
 */
export type PageOrientation = 'portrait' | 'landscape';

/**
 * 边框样式
 */
export type BorderStyle = 'none' | 'solid' | 'dashed' | 'dotted';

/**
 * 字重
 */
export type FontWeight = 'normal' | 'bold';

/**
 * 对齐方式
 */
export type Alignment = 'left' | 'center' | 'right';

/**
 * 布局列数
 */
export type ColumnLayout = 'single-column' | 'two-column' | 'three-column';

/**
 * 页边距配置
 */
export interface PageMargin {
  top: number; // mm
  right: number; // mm
  bottom: number; // mm
  left: number; // mm
}

/**
 * 页面设置
 */
export interface PageSettings {
  /**
   * 纸张大小
   */
  size: PageSize;

  /**
   * 页面方向
   */
  orientation: PageOrientation;

  /**
   * 页边距
   */
  margin: PageMargin;

  /**
   * 页面外边框颜色（可选）
   * 不设置或边框宽度为 0 时不显示外边框
   */
  borderColor?: string;

  /**
   * 页面外边框宽度（px，可选）
   */
  borderWidth?: number;
}

/**
 * 订单编号配置
 */
export interface OrderNumberConfig {
  /**
   * 是否显示订单编号
   */
  show: boolean;

  /**
   * 订单编号位置
   */
  position: 'top-right' | 'top-left' | 'inline';

  /**
   * 订单编号标签
   */
  label: string;

  /**
   * 字体大小（px）
   */
  fontSize: number;

  /**
   * 字重
   */
  fontWeight: FontWeight;
}

/**
 * 表头设置
 */
export interface HeaderSettings {
  /**
   * 是否显示 Logo
   */
  showLogo: boolean;

  /**
   * Logo URL（支持相对路径或绝对路径）
   */
  logoUrl?: string;

  /**
   * Logo 宽度（px）
   */
  logoWidth?: number;

  /**
   * Logo 高度（px）
   */
  logoHeight?: number;

  /**
   * 公司名称
   */
  companyName: string;

  /**
   * 公司名称字体大小（px）
   */
  companyNameFontSize: number;

  /**
   * 副标题（如"销售订单"）
   */
  subtitle?: string;

  /**
   * 副标题字体大小（px）
   */
  subtitleFontSize: number;

  /**
   * 对齐方式
   */
  alignment: Alignment;

  /**
   * 是否显示边框
   */
  showBorder: boolean;

  /**
   * 边框颜色
   */
  borderColor?: string;

  /**
   * 边框宽度（px，可选）
   */
  borderWidth?: number;

  /**
   * 背景颜色
   */
  backgroundColor?: string;

  /**
   * 内边距（px）
   */
  padding?: number;

  /**
   * 订单编号配置
   */
  orderNumber?: OrderNumberConfig;
}

/**
 * 信息区设置（客户信息、订单信息等）
 */
export interface InfoSectionSettings {
  /**
   * 布局方式
   */
  layout: ColumnLayout;

  /**
   * 标签字体大小（px）
   */
  labelFontSize: number;

  /**
   * 值字体大小（px）
   */
  valueFontSize: number;

  /**
   * 标签颜色
   */
  labelColor: string;

  /**
   * 值颜色
   */
  valueColor: string;

  /**
   * 行间距（px）
   */
  rowSpacing: number;

  /**
   * 标签宽度（对于双列/三列布局）
   */
  labelWidth?: string;
}

/**
 * 表格设置
 */
export interface TableSettings {
  /**
   * 表头背景色
   */
  headerBgColor: string;

  /**
   * 表头文字颜色
   */
  headerTextColor: string;

  /**
   * 表头字体大小（px）
   */
  headerFontSize: number;

  /**
   * 表头字重
   */
  headerFontWeight: FontWeight;

  /**
   * 表体行字体大小（px）
   */
  rowFontSize: number;

  /**
   * 行高（px）
   */
  rowHeight: number;

  /**
   * 边框样式
   */
  borderStyle: BorderStyle;

  /**
   * 边框颜色
   */
  borderColor: string;

  /**
   * 边框宽度（px）
   */
  borderWidth: number;

  /**
   * 表头底部边框宽度（px，可选）
   * 未设置时使用 borderWidth
   */
  headerBottomBorderWidth?: number;

  /**
   * 最后一行底部边框宽度（px，可选）
   * 未设置时使用 borderWidth
   */
  lastRowBottomBorderWidth?: number;

  /**
   * 是否显示斑马纹
   */
  stripedRows: boolean;

  /**
   * 斑马纹颜色（奇数行背景色）
   */
  stripedColor: string;

  /**
   * 单元格内边距（px）
   */
  cellPadding: number;
}

/**
 * 汇总区设置
 */
export interface SummarySettings {
  /**
   * 对齐方式
   */
  alignment: Alignment;

  /**
   * 字体大小（px）
   */
  fontSize: number;

  /**
   * 字重
   */
  fontWeight: FontWeight;

  /**
   * 是否显示中文大写金额
   */
  showChineseAmount: boolean;

  /**
   * 是否高亮总计行
   */
  highlightTotal: boolean;

  /**
   * 高亮颜色
   */
  highlightColor: string;

  /**
   * 内边距（px）
   */
  padding?: number;

  /**
   * 字段颜色配置
   * 键为字段key,值为颜色(支持hex/rgb/颜色名称)
   * @example { totalAmount: '#ff0000', totalWeight: '#00ff00' }
   */
  fieldColors?: Record<string, string>;

  /**
   * 是否显示汇总区域外边框
   */
  showBorder?: boolean;

  /**
   * 汇总区域外边框颜色
   */
  borderColor?: string;

  /**
   * 汇总区域外边框宽度（px）
   */
  borderWidth?: number;
}

/**
 * 页脚设置
 */
export interface FooterSettings {
  /**
   * 是否显示页脚
   */
  show: boolean;

  /**
   * 页脚内容模板
   * 支持变量：{pageNumber}, {totalPages}, {date}, {time}
   * @example '第 {pageNumber} 页，共 {totalPages} 页 | 打印日期：{date}'
   */
  content: string;

  /**
   * 字体大小（px）
   */
  fontSize: number;

  /**
   * 对齐方式
   */
  alignment: Alignment;

  /**
   * 文字颜色
   */
  textColor?: string;
}

/**
 * 签名字段定义
 */
export interface SignatureField {
  /**
   * 字段标签
   * @example '制单人' | '审核人' | '客户签收'
   */
  label: string;

  /**
   * 签名线宽度（mm）
   */
  width: number;
}

/**
 * 签名区设置
 */
export interface SignatureSettings {
  /**
   * 是否显示签名区
   */
  show: boolean;

  /**
   * 签名字段列表
   */
  fields: SignatureField[];

  /**
   * 签名区与表格的间距（px）
   */
  spacing: number;

  /**
   * 字体大小（px）
   */
  fontSize?: number;

  /**
   * 签名线颜色
   */
  lineColor?: string;
}

/**
 * 完整的打印样式配置
 */
export interface PrintStyleConfig {
  /**
   * 模板 ID（保存时生成）
   */
  id?: string;

  /**
   * 模板名称
   */
  name: string;

  /**
   * 文档类型
   */
  documentType: DocumentType;

  /**
   * 页面设置
   */
  page: PageSettings;

  /**
   * 表头设置
   */
  header: HeaderSettings;

  /**
   * 信息区设置
   */
  infoSection: InfoSectionSettings;

  /**
   * 表格设置
   */
  table: TableSettings;

  /**
   * 汇总区设置
   */
  summary: SummarySettings;

  /**
   * 页脚设置
   */
  footer: FooterSettings;

  /**
   * 签名区设置
   */
  signature: SignatureSettings;

  /**
   * 创建时间
   */
  createdAt?: string;

  /**
   * 更新时间
   */
  updatedAt?: string;
}

/**
 * 预设样式类型
 */
export type PresetStyleType =
  | 'classic'
  | 'modern'
  | 'compact'
  | 'tianjin-haoxing';

/**
 * 预设样式配置（部分配置）
 */
export type PresetStyleConfig = Partial<PrintStyleConfig>;

/**
 * 工具函数：合并样式配置
 * 用于将预设样式与自定义配置合并
 */
export function mergeStyleConfig(
  base: PrintStyleConfig,
  overrides: PresetStyleConfig
): PrintStyleConfig {
  return {
    ...base,
    ...overrides,
    page: { ...base.page, ...overrides.page },
    header: { ...base.header, ...overrides.header },
    infoSection: { ...base.infoSection, ...overrides.infoSection },
    table: { ...base.table, ...overrides.table },
    summary: { ...base.summary, ...overrides.summary },
    footer: { ...base.footer, ...overrides.footer },
    signature: { ...base.signature, ...overrides.signature },
  };
}

/**
 * 工具函数：验证样式配置完整性
 */
export function validateStyleConfig(config: Partial<PrintStyleConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.name) {
    errors.push('模板名称不能为空');
  }

  if (!config.documentType) {
    errors.push('文档类型不能为空');
  }

  if (!config.page) {
    errors.push('页面设置不能为空');
  }

  if (!config.header?.companyName) {
    errors.push('公司名称不能为空');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 工具函数：创建默认样式配置
 */
export function createDefaultStyleConfig(
  documentType: DocumentType,
  companyName: string = '公司名称'
): PrintStyleConfig {
  return {
    name: '默认模板',
    documentType,
    page: {
      size: 'A4',
      orientation: 'landscape',
      margin: {
        top: 10,
        right: 10,
        bottom: 10,
        left: 10,
      },
      // 默认不绘制页面外边框，由各预设或用户在样式编辑器中自行配置
      borderColor: '#000000',
      borderWidth: 0,
    },
    header: {
      showLogo: false,
      companyName,
      companyNameFontSize: 24,
      subtitleFontSize: 18,
      alignment: 'center',
      showBorder: true,
      borderColor: '#000000',
      backgroundColor: '#ffffff',
      padding: 16,
    },
    infoSection: {
      layout: 'two-column',
      labelFontSize: 12,
      valueFontSize: 12,
      labelColor: '#666666',
      valueColor: '#000000',
      rowSpacing: 8,
      labelWidth: '120px',
    },
    table: {
      headerBgColor: '#f5f5f5',
      headerTextColor: '#000000',
      headerFontSize: 12,
      headerFontWeight: 'bold',
      rowFontSize: 11,
      rowHeight: 32,
      borderStyle: 'solid',
      borderColor: '#000000',
      borderWidth: 1,
      stripedRows: true,
      stripedColor: '#fafafa',
      cellPadding: 8,
    },
    summary: {
      alignment: 'right',
      fontSize: 12,
      fontWeight: 'bold',
      showChineseAmount: true,
      highlightTotal: true,
      highlightColor: '#fef3c7',
      padding: 16,
      showBorder: false,
      borderColor: '#000000',
      borderWidth: 0,
    },
    footer: {
      show: true,
      content: '第 {pageNumber} 页，共 {totalPages} 页 | 打印日期：{date}',
      fontSize: 10,
      alignment: 'center',
      textColor: '#666666',
    },
    signature: {
      show: true,
      fields: [
        { label: '制单人', width: 80 },
        { label: '审核人', width: 80 },
        { label: '客户签收', width: 80 },
      ],
      spacing: 32,
      fontSize: 12,
      lineColor: '#000000',
    },
  };
}

/**
 * 预设样式：经典样式
 */
export function createClassicStylePreset(
  documentType: DocumentType,
  companyName: string = '公司名称'
): PrintStyleConfig {
  const base = createDefaultStyleConfig(documentType, companyName);
  return {
    ...base,
    name: '经典样式',
    header: {
      ...base.header,
      showBorder: true,
      borderColor: '#000000',
      backgroundColor: '#ffffff',
    },
    table: {
      ...base.table,
      headerBgColor: '#f5f5f5',
      borderStyle: 'solid',
      stripedRows: true,
    },
  };
}

/**
 * 预设样式：现代样式
 */
export function createModernStylePreset(
  documentType: DocumentType,
  companyName: string = '公司名称'
): PrintStyleConfig {
  const base = createDefaultStyleConfig(documentType, companyName);
  return {
    ...base,
    name: '现代样式',
    header: {
      ...base.header,
      showBorder: false,
      backgroundColor: '#3b82f6',
      companyNameFontSize: 28,
    },
    table: {
      ...base.table,
      headerBgColor: '#3b82f6',
      headerTextColor: '#ffffff',
      borderStyle: 'none',
      stripedRows: false,
    },
    summary: {
      ...base.summary,
      highlightColor: '#dbeafe',
    },
  };
}

/**
 * 预设样式：紧凑样式
 */
export function createCompactStylePreset(
  documentType: DocumentType,
  companyName: string = '公司名称'
): PrintStyleConfig {
  const base = createDefaultStyleConfig(documentType, companyName);
  return {
    ...base,
    name: '紧凑样式',
    page: {
      ...base.page,
      margin: {
        top: 5,
        right: 5,
        bottom: 5,
        left: 5,
      },
    },
    header: {
      ...base.header,
      companyNameFontSize: 18,
      subtitleFontSize: 14,
      padding: 8,
    },
    infoSection: {
      ...base.infoSection,
      labelFontSize: 10,
      valueFontSize: 10,
      rowSpacing: 4,
    },
    table: {
      ...base.table,
      headerFontSize: 10,
      rowFontSize: 9,
      rowHeight: 24,
      cellPadding: 4,
    },
    summary: {
      ...base.summary,
      fontSize: 10,
      padding: 8,
    },
    signature: {
      ...base.signature,
      spacing: 16,
      fontSize: 10,
    },
  };
}

/**
 * 预设样式：天津豪星陶瓷样式
 */
export function createTianjinHaoxingStylePreset(
  documentType: DocumentType,
  companyName: string = '天津豪星陶瓷'
): PrintStyleConfig {
  const base = createDefaultStyleConfig(documentType, companyName);
  return {
    ...base,
    name: '天津豪星陶瓷样式',
    page: {
      ...base.page,
      // 整页红色粗边框，接近天津豪星发货单效果
      borderColor: '#ff0000',
      borderWidth: 3,
    },
    header: {
      ...base.header,
      showLogo: false,
      companyName: `${companyName}发货单`,
      companyNameFontSize: 24,
      subtitleFontSize: 0, // 不显示副标题
      alignment: 'center',
      showBorder: true,
      borderColor: '#ff0000', // 红色边框
      borderWidth: 2,
      backgroundColor: '#ffffff',
      padding: 12,
      orderNumber: {
        show: true,
        position: 'top-right',
        label: '编号',
        fontSize: 12,
        fontWeight: 'normal',
      },
    },
    infoSection: {
      ...base.infoSection,
      layout: 'single-column', // 单行布局
      labelFontSize: 12,
      valueFontSize: 12,
      labelColor: '#000000',
      valueColor: '#000000',
      rowSpacing: 6,
    },
    table: {
      ...base.table,
      headerBgColor: '#f5f5f5',
      headerTextColor: '#000000',
      headerFontSize: 12,
      headerFontWeight: 'bold',
      rowFontSize: 11,
      rowHeight: 30,
      borderStyle: 'solid',
      borderColor: '#ff0000', // 红色边框
      borderWidth: 2,
      stripedRows: false, // 不要斑马纹
      cellPadding: 6,
    },
    summary: {
      ...base.summary,
      alignment: 'left',
      fontSize: 12,
      fontWeight: 'bold',
      showChineseAmount: true,
      highlightTotal: false, // 不要整体高亮
      highlightColor: '#ffffff',
      padding: 12,
      showBorder: true,
      borderColor: '#ff0000',
      borderWidth: 2,
      fieldColors: {
        totalAmount: '#ff0000', // 红色
        totalWeight: '#00aa00', // 绿色
      },
    },
    footer: {
      ...base.footer,
      show: false, // 不显示页脚
    },
    signature: {
      ...base.signature,
      show: false, // 不显示签名区
    },
  };
}

/**
 * 获取预设样式
 */
export function getPresetStyle(
  preset: PresetStyleType,
  documentType: DocumentType,
  companyName?: string
): PrintStyleConfig {
  switch (preset) {
    case 'classic':
      return createClassicStylePreset(documentType, companyName);
    case 'modern':
      return createModernStylePreset(documentType, companyName);
    case 'compact':
      return createCompactStylePreset(documentType, companyName);
    case 'tianjin-haoxing':
      return createTianjinHaoxingStylePreset(documentType, companyName);
    default:
      return createDefaultStyleConfig(documentType, companyName);
  }
}
