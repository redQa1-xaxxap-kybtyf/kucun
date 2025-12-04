/**
 * PrintInfoSection - 通用打印信息区组件
 *
 * 功能：
 * - 显示订单/单据的基本信息
 * - 支持单列、双列、三列布局
 * - 标签-值对格式
 *
 * 设计原则：
 * - 数据驱动：通过字段配置和数据渲染
 * - 灵活布局：支持多种列布局
 * - 格式化支持：自动应用字段格式化函数
 */

'use client';

import React from 'react';

import type {
  PrintConfig,
  PrintFieldDefinition,
} from '@/lib/types/print-config';
import type { InfoSectionSettings } from '@/lib/types/print-style';

/**
 * 组件属性
 */
export interface PrintInfoSectionProps {
  /**
   * 信息区样式配置
   */
  settings: InfoSectionSettings;

  /**
   * 打印配置（用于获取字段定义）
   */
  printConfig: PrintConfig;

  /**
   * 要显示的字段 key 列表
   */
  selectedFields: string[];

  /**
   * 数据对象
   */
  data: Record<string, unknown>;

  /**
   * 额外的 className
   */
  className?: string;
}

/**
 * PrintInfoSection 组件
 *
 * @example
 * ```tsx
 * <PrintInfoSection
 *   settings={styleConfig.infoSection}
 *   printConfig={salesOrderPrintConfig}
 *   selectedFields={['orderNumber', 'customerName', 'createdAt']}
 *   data={{
 *     orderNumber: 'SO-2025-001',
 *     customerName: '张三',
 *     createdAt: new Date(),
 *   }}
 * />
 * ```
 */
export function PrintInfoSection({
  settings,
  printConfig,
  selectedFields,
  data,
  className = '',
}: PrintInfoSectionProps) {
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

  // 计算网格列数
  const gridColumns =
    settings.layout === 'single-column'
      ? '1fr'
      : settings.layout === 'two-column'
        ? '1fr 1fr'
        : '1fr 1fr 1fr';

  return (
    <div
      className={`print-info-section ${className}`}
      style={{
        marginBottom: '16px',
        display: 'grid',
        gridTemplateColumns: gridColumns,
        gap: `${settings.rowSpacing}px`,
      }}
    >
      {selectedFields.map(key => {
        const field = getFieldConfig(key);
        if (!field) return null;

        return (
          <div key={key} className="info-field">
            <span
              className="info-label"
              style={{
                color: settings.labelColor,
                fontSize: `${settings.labelFontSize}px`,
                fontWeight: 'normal',
                width: settings.labelWidth,
                display: 'inline-block',
              }}
            >
              {field.label}：
            </span>
            <span
              className="info-value"
              style={{
                color: settings.valueColor,
                fontSize: `${settings.valueFontSize}px`,
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
