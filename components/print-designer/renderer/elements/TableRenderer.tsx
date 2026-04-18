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
import {
  formatTableRowNumber,
  isRowNumberColumn,
} from '@/lib/print-designer/table-column-presets';

import { formatValue, getNestedValue, mmToPx, ptToPx } from '../utils';

interface TableRendererProps {
  element: TableElement;
  data: Record<string, unknown>;
  scale: number;
}

type TableCellSection = 'header' | 'body' | 'summary';

export function TableRenderer({ element, data, scale }: TableRendererProps) {
  const {
    dataSource,
    title,
    titleBarStyle,
    titleAlign,
    footerNote,
    footerNoteStyle,
    columns,
    style,
    rowNumberMode,
    summaryLabel,
    showSummary,
    summaryColumns,
    minRows,
  } = element;
  const trimmedTitle = title?.trim();
  const trimmedFooterNote = footerNote?.trim();
  const effectiveSummaryLabel = summaryLabel?.trim() || '合计';
  const titleFontSize = ptToPx(Math.min(style.headerFontSize + 1, 18)) * scale;
  const footerFontSize = ptToPx(Math.max(8, style.bodyFontSize - 1)) * scale;
  const effectiveTitleBarStyle = titleBarStyle ?? 'plain';
  const effectiveTitleAlign = titleAlign ?? 'center';
  const effectiveFooterNoteStyle = footerNoteStyle ?? 'plain';
  const effectiveBorderMode = style.borderMode ?? 'full';
  const borderValue = `${style.borderWidth}px solid ${style.borderColor}`;
  const filledFooterBgColor =
    style.headerBgColor === '#ffffff' ? '#f8fafc' : style.headerBgColor;

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
  const renderCellContent = (
    item: unknown,
    column: TableColumn,
    rowIndex: number
  ): string => {
    if (isRowNumberColumn(column)) {
      return rowIndex < items.length
        ? formatTableRowNumber(rowIndex, rowNumberMode ?? 'numeric')
        : '';
    }

    const value = getNestedValue(item, column.key);
    if (value === null || value === undefined) return '';
    return formatValue(value, column.format);
  };

  const summaryLabelColumnIndex = (() => {
    const preferredIndex = columns.findIndex(
      column =>
        !isRowNumberColumn(column) && !summaryColumns?.includes(column.key)
    );
    if (preferredIndex >= 0) {
      return preferredIndex;
    }

    const rowNumberColumnIndex = columns.findIndex(column =>
      isRowNumberColumn(column)
    );
    if (rowNumberColumnIndex >= 0) {
      return rowNumberColumnIndex;
    }

    const firstContentColumnIndex = columns.findIndex(
      column => !isRowNumberColumn(column)
    );
    return firstContentColumnIndex >= 0 ? firstContentColumnIndex : 0;
  })();

  // 计算列宽样式
  const getColumnWidth = (column: TableColumn): string => {
    if (column.widthUnit === '%') {
      return `${column.width}%`;
    }
    return `${mmToPx(column.width) * scale}px`;
  };

  const buildBorderStyle = (
    section: TableCellSection,
    rowIndex: number,
    colIndex: number,
    rowCount: number
  ): React.CSSProperties => {
    const isFirstCol = colIndex === 0;
    const isLastCol = colIndex === columns.length - 1;
    const isLastBodyRow = section === 'body' && rowIndex === rowCount - 1;
    const hasSummaryRow = Boolean(showSummary && summaryColumns?.length);

    if (effectiveBorderMode === 'row') {
      return {
        borderTop:
          section === 'header' || section === 'summary' ? borderValue : '0',
        borderBottom: borderValue,
        borderLeft: isFirstCol ? borderValue : '0',
        borderRight: isLastCol ? borderValue : '0',
      };
    }

    if (effectiveBorderMode === 'outer') {
      return {
        borderTop:
          section === 'header' || section === 'summary' ? borderValue : '0',
        borderBottom:
          section === 'header'
            ? borderValue
            : section === 'summary' || (isLastBodyRow && !hasSummaryRow)
              ? borderValue
              : '0',
        borderLeft: isFirstCol ? borderValue : '0',
        borderRight: isLastCol ? borderValue : '0',
      };
    }

    return {
      border: borderValue,
    };
  };

  const tableCellStyle = (
    align: 'left' | 'center' | 'right',
    section: TableCellSection,
    rowIndex: number,
    rowCount: number,
    colIndex: number
  ): React.CSSProperties => ({
    ...buildBorderStyle(section, rowIndex, colIndex, rowCount),
    padding: `${2 * scale}px ${4 * scale}px`,
    textAlign: align,
    verticalAlign: 'middle',
  });

  const summaryCellStyle = (
    align: 'left' | 'center' | 'right',
    colIndex: number
  ): React.CSSProperties => ({
    ...tableCellStyle(align, 'summary', 0, 1, colIndex),
    backgroundColor:
      style.headerBgColor === '#ffffff' ? '#f8fafc' : style.headerBgColor,
    fontWeight: 700,
    borderTopWidth: Math.min(style.borderWidth + 0.3, 1.5),
    borderBottomWidth: Math.min(style.borderWidth + 0.3, 1.5),
  });

  const titleStyle: React.CSSProperties =
    effectiveTitleBarStyle === 'filled'
      ? {
          flexShrink: 0,
          marginBottom: `${4 * scale}px`,
          padding: `${4 * scale}px ${8 * scale}px`,
          textAlign: effectiveTitleAlign,
          color: style.headerTextColor,
          backgroundColor: style.headerBgColor,
          border: borderValue,
          fontSize: titleFontSize,
          fontWeight: 600,
          lineHeight: 1.2,
        }
      : effectiveTitleBarStyle === 'outlined'
        ? {
            flexShrink: 0,
            marginBottom: `${4 * scale}px`,
            padding: `${4 * scale}px ${8 * scale}px`,
            textAlign: effectiveTitleAlign,
            color: style.headerTextColor,
            backgroundColor: '#ffffff',
            border: borderValue,
            fontSize: titleFontSize,
            fontWeight: 600,
            lineHeight: 1.2,
          }
        : {
            flexShrink: 0,
            paddingBottom: `${3 * scale}px`,
            textAlign: effectiveTitleAlign,
            color: style.headerTextColor,
            fontSize: titleFontSize,
            fontWeight: 600,
            lineHeight: 1.2,
          };

  const footerNoteStyleValue: React.CSSProperties =
    effectiveFooterNoteStyle === 'filled'
      ? {
          flexShrink: 0,
          marginTop: `${4 * scale}px`,
          padding: `${4 * scale}px ${6 * scale}px`,
          color: style.headerTextColor,
          backgroundColor: filledFooterBgColor,
          border: borderValue,
          fontSize: footerFontSize,
          lineHeight: 1.35,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }
      : effectiveFooterNoteStyle === 'outlined'
        ? {
            flexShrink: 0,
            marginTop: `${4 * scale}px`,
            padding: `${4 * scale}px ${6 * scale}px`,
            color: '#475569',
            backgroundColor: '#ffffff',
            border: borderValue,
            fontSize: footerFontSize,
            lineHeight: 1.35,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
          }
        : {
            flexShrink: 0,
            marginTop: `${4 * scale}px`,
            color: '#475569',
            fontSize: footerFontSize,
            lineHeight: 1.35,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
          };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {trimmedTitle ? <div style={titleStyle}>{trimmedTitle}</div> : null}

      <div style={{ flex: '1 1 auto', minHeight: 0 }}>
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
                    ...tableCellStyle(col.align, 'header', 0, 1, index),
                    width: getColumnWidth(col),
                    whiteSpace: 'pre-line',
                    lineHeight: 1.25,
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
                    style={tableCellStyle(
                      col.align,
                      'body',
                      rowIndex,
                      displayItems.length,
                      index
                    )}
                  >
                    {renderCellContent(item, col, rowIndex)}
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
                    style={summaryCellStyle(col.align, idx)}
                  >
                    {idx === summaryLabelColumnIndex
                      ? effectiveSummaryLabel
                      : summaryColumns.includes(col.key)
                        ? formatValue(summaryData[col.key], col.format)
                        : ''}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {trimmedFooterNote ? (
        <div style={footerNoteStyleValue}>{trimmedFooterNote}</div>
      ) : null}
    </div>
  );
}
