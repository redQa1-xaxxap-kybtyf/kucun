/**
 * 打印设计器 - 表格渲染器
 *
 * 渲染订单明细等列表数据
 */

'use client';

import {
  getTableColumnReactKey,
  type TableColumn,
  type TableElement,
} from '@/lib/print-designer/schemas';

import { formatValue, getNestedValue, mmToPx, ptToPx } from '../utils';

interface TableRendererProps {
  element: TableElement;
  data: Record<string, unknown>;
  scale: number;
}

export function TableRenderer({ element, data, scale }: TableRendererProps) {
  const { dataSource, columns, style, showSummary, summaryColumns, minRows } =
    element;

  // 获取数据源
  const items = (getNestedValue(data, dataSource) as unknown[]) || [];

  // 计算需要填充的空行
  const emptyRowsCount = minRows ? Math.max(0, minRows - items.length) : 0;
  const displayItems = [
    ...items,
    ...Array.from({ length: emptyRowsCount }, () => ({})),
  ];

  // 计算合计
  const summaryData: Record<string, number> = {};
  if (showSummary && summaryColumns) {
    summaryColumns.forEach(colKey => {
      summaryData[colKey] = items.reduce<number>((sum, item) => {
        const val = getNestedValue(item, colKey);
        return sum + (typeof val === 'number' ? val : 0);
      }, 0);
    });
  }

  // 渲染单元格内容
  const renderCellContent = (item: unknown, column: TableColumn): string => {
    const value = getNestedValue(item, column.key);
    if (value === null || value === undefined) return '';
    return formatValue(value, column.format);
  };

  // 计算列宽样式
  const getColumnWidth = (column: TableColumn): string => {
    if (column.widthUnit === '%') {
      return `${column.width}%`;
    }
    return `${mmToPx(column.width) * scale}px`;
  };

  const tableCellStyle = (
    align: 'left' | 'center' | 'right'
  ): React.CSSProperties => ({
    border: `${style.borderWidth}px solid ${style.borderColor}`,
    padding: `${2 * scale}px ${4 * scale}px`,
    textAlign: align,
    verticalAlign: 'middle',
  });

  return (
    <table
      style={{
        width: '100%',
        height: '100%',
        borderCollapse: 'collapse',
        fontSize: ptToPx(style.bodyFontSize) * scale,
        tableLayout: 'fixed',
      }}
    >
      <thead>
        <tr
          style={{
            backgroundColor: style.headerBgColor,
            color: style.headerTextColor,
            fontSize: ptToPx(style.headerFontSize) * scale,
            fontWeight: 'bold',
          }}
        >
          {columns.map((col, index) => (
            <th
              key={getTableColumnReactKey(col, index)}
              style={{
                ...tableCellStyle(col.align),
                width: getColumnWidth(col),
              }}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {displayItems.map((item, rowIndex) => (
          <tr
            key={rowIndex}
            style={{
              backgroundColor:
                style.stripedRows && rowIndex % 2 === 1
                  ? style.stripedColor
                  : undefined,
              height: mmToPx(style.rowHeight) * scale,
            }}
          >
            {columns.map((col, index) => (
              <td
                key={getTableColumnReactKey(col, index)}
                style={tableCellStyle(col.align)}
              >
                {renderCellContent(item, col)}
              </td>
            ))}
          </tr>
        ))}
        {showSummary && summaryColumns && summaryColumns.length > 0 && (
          <tr
            style={{
              backgroundColor: style.headerBgColor,
              fontWeight: 'bold',
            }}
          >
            {columns.map((col, idx) => (
              <td
                key={getTableColumnReactKey(col, idx)}
                style={tableCellStyle(col.align)}
              >
                {idx === 0
                  ? '合计'
                  : summaryColumns.includes(col.key)
                    ? formatValue(summaryData[col.key], col.format)
                    : ''}
              </td>
            ))}
          </tr>
        )}
      </tbody>
    </table>
  );
}
