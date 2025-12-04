/**
 * PrintSummary - 通用打印汇总区组件
 *
 * 功能：
 * - 显示订单/单据的汇总信息
 * - 支持高亮显示总计
 * - 支持中文大写金额
 *
 * 设计原则：
 * - 配置驱动：样式通过配置控制
 * - 格式化支持：自动应用字段格式化
 * - 灵活布局：支持不同对齐方式
 */

'use client';

import React from 'react';

import type {
  PrintConfig,
  PrintFieldDefinition,
} from '@/lib/types/print-config';
import type { SummarySettings } from '@/lib/types/print-style';

/**
 * 组件属性
 */
export interface PrintSummaryProps {
  /**
   * 汇总区样式配置
   */
  settings: SummarySettings;

  /**
   * 打印配置（用于获取字段定义）
   */
  printConfig: PrintConfig;

  /**
   * 要显示的汇总字段 key 列表
   */
  selectedFields: string[];

  /**
   * 汇总数据对象
   */
  data: Record<string, unknown>;

  /**
   * 额外的 className
   */
  className?: string;
}

/**
 * PrintSummary 组件
 *
 * @example
 * ```tsx
 * <PrintSummary
 *   settings={styleConfig.summary}
 *   printConfig={salesOrderPrintConfig}
 *   selectedFields={['totalQuantity', 'totalAmount', 'totalAmountChinese']}
 *   data={{
 *     totalQuantity: 100,
 *     totalAmount: 12345.67,
 *     totalAmountChinese: '壹万贰仟叁佰肆拾伍元陆角柒分',
 *   }}
 * />
 * ```
 */
export function PrintSummary({
  settings,
  printConfig,
  selectedFields,
  data,
  className = '',
}: PrintSummaryProps) {
  // 获取字段配置
  const getFieldConfig = (key: string): PrintFieldDefinition | undefined =>
    printConfig.fields.find(f => f.key === key);

  // 格式化字段值
  const formatFieldValue = (key: string, value: unknown): string => {
    const field = getFieldConfig(key);
    if (field?.format) {
      return field.format(value);
    }
    return String(value ?? '-');
  };

  // 判断是否为总金额字段（用于高亮）
  const isTotalAmountField = (key: string): boolean =>
    key.toLowerCase().includes('totalamount') && !key.includes('Chinese');

  return (
    <div
      className={`print-summary ${className}`}
      style={{
        textAlign: settings.alignment,
        fontSize: `${settings.fontSize}px`,
        fontWeight: settings.fontWeight,
        padding: `${settings.padding}px`,
        marginBottom: '16px',
        border:
          settings.showBorder &&
          settings.borderWidth &&
          settings.borderWidth > 0
            ? `${settings.borderWidth}px solid ${settings.borderColor || '#000000'}`
            : 'none',
      }}
    >
      {selectedFields.map(key => {
        const field = getFieldConfig(key);
        if (!field) return null;

        const shouldHighlight =
          settings.highlightTotal && isTotalAmountField(key);

        // 获取字段特定颜色（优先级高于高亮色）
        const fieldColor = settings.fieldColors?.[key];

        return (
          <div
            key={key}
            className="summary-item"
            style={{
              backgroundColor: shouldHighlight
                ? settings.highlightColor
                : 'transparent',
              display: 'inline-block',
              padding: '4px 8px',
              margin: '2px 8px',
            }}
          >
            <span className="summary-label">{field.label}：</span>
            <span
              className="summary-value"
              style={{
                color: fieldColor || 'inherit',
                fontWeight: fieldColor ? 'bold' : 'inherit',
              }}
            >
              {formatFieldValue(key, data[key])}
            </span>
          </div>
        );
      })}
    </div>
  );
}
