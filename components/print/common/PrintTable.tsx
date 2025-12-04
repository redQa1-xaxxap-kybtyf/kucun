/**
 * PrintTable - 通用打印表格组件
 *
 * 功能：
 * - 渲染订单明细表格
 * - 自动应用样式配置
 * - 支持斑马纹、边框等样式
 * - 支持字段格式化
 *
 * 设计原则：
 * - 泛型支持：适配不同的明细数据类型
 * - 配置驱动：样式和字段完全可配置
 * - 性能优化：使用 React.memo 避免不必要的重渲染
 */

'use client';

import React from 'react';

import type {
  PrintConfig,
  PrintFieldDefinition,
} from '@/lib/types/print-config';
import type { TableSettings } from '@/lib/types/print-style';

/**
 * 组件属性
 */
export interface PrintTableProps<T> {
  /**
   * 表格样式配置
   */
  settings: TableSettings;

  /**
   * 打印配置（用于获取字段定义）
   */
  printConfig: PrintConfig;

  /**
   * 要显示的列字段 key 列表
   */
  selectedColumns: string[];

  /**
   * 表格数据
   */
  data: T[];

  /**
   * 行数据转换函数
   * 将明细对象转换为打印所需的数据格式
   */
  rowDataMapper: (item: T) => Record<string, unknown>;

  /**
   * 额外的 className
   */
  className?: string;
}

/**
 * PrintTable 组件
 *
 * @example
 * ```tsx
 * <PrintTable
 *   settings={styleConfig.table}
 *   printConfig={salesOrderPrintConfig}
 *   selectedColumns={['productCode', 'productName', 'quantity', 'unitPrice']}
 *   data={order.items}
 *   rowDataMapper={(item) => ({
 *     productCode: item.product?.code || '-',
 *     productName: item.product?.name || '-',
 *     quantity: item.quantity,
 *     unitPrice: item.unitPrice,
 *   })}
 * />
 * ```
 */
export function PrintTable<T>({
  settings,
  printConfig,
  selectedColumns,
  data,
  rowDataMapper,
  className = '',
}: PrintTableProps<T>) {
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

  // 表格边框样式
  const borderStyle =
    settings.borderStyle !== 'none'
      ? `${settings.borderWidth}px ${settings.borderStyle} ${settings.borderColor}`
      : 'none';

  return (
    <table
      className={`print-table ${className}`}
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        marginBottom: '16px',
        border: borderStyle,
      }}
    >
      {/* 表头 */}
      <thead>
        <tr
          style={{
            backgroundColor: settings.headerBgColor,
            color: settings.headerTextColor,
            fontSize: `${settings.headerFontSize}px`,
            fontWeight: settings.headerFontWeight,
          }}
        >
          {selectedColumns.map(key => {
            const field = getFieldConfig(key);
            if (!field) return null;

            return (
              <th
                key={key}
                style={{
                  padding: `${settings.cellPadding}px`,
                  borderTop: borderStyle,
                  borderLeft: borderStyle,
                  borderRight: borderStyle,
                  borderBottom:
                    settings.borderStyle !== 'none'
                      ? `${settings.headerBottomBorderWidth ?? settings.borderWidth}px ${settings.borderStyle} ${settings.borderColor}`
                      : 'none',
                  textAlign: field.align || 'left',
                  width: field.width,
                }}
              >
                {field.label}
              </th>
            );
          })}
        </tr>
      </thead>

      {/* 表体 */}
      <tbody>
        {data.map((item, index) => {
          const rowData = rowDataMapper(item);

          return (
            <tr
              key={index}
              style={{
                backgroundColor:
                  settings.stripedRows && index % 2 === 1
                    ? settings.stripedColor
                    : 'transparent',
                fontSize: `${settings.rowFontSize}px`,
                height: `${settings.rowHeight}px`,
              }}
            >
              {selectedColumns.map(key => {
                const field = getFieldConfig(key);
                if (!field) return null;

                return (
                  <td
                    key={key}
                    style={{
                      padding: `${settings.cellPadding}px`,
                      borderTop: borderStyle,
                      borderLeft: borderStyle,
                      borderRight: borderStyle,
                      borderBottom:
                        settings.borderStyle !== 'none'
                          ? `${
                              index === data.length - 1 &&
                              settings.lastRowBottomBorderWidth
                                ? settings.lastRowBottomBorderWidth
                                : settings.borderWidth
                            }px ${settings.borderStyle} ${settings.borderColor}`
                          : 'none',
                      textAlign: field.align || 'left',
                      width: field.width,
                    }}
                  >
                    {formatFieldValue(key, rowData[key])}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// 使用 React.memo 优化性能
export const MemoizedPrintTable = React.memo(PrintTable) as typeof PrintTable;
