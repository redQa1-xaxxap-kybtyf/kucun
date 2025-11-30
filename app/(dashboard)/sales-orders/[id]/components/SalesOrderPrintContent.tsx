/**
 * SalesOrderPrintContent - 销售订单打印内容组件
 *
 * 功能：
 * - 支持DIY样式配置
 * - 支持字段选择
 * - 保留原有数据处理逻辑
 *
 * 设计原则：
 * - 单一职责：仅负责渲染打印内容
 * - 数据驱动：通过props接收样式和字段配置
 */

'use client';

import React, { useMemo } from 'react';

import { PrintLayout } from '@/components/print/PrintLayout';
import { salesOrderPrintConfig } from '@/lib/config/print-fields/sales-order-fields';
import type { FieldSelection } from '@/lib/types/print-config';
import type { PrintStyleConfig } from '@/lib/types/print-style';

import type { SalesOrderDetail } from './types';

/**
 * 组件属性
 */
export interface SalesOrderPrintContentProps {
  /**
   * 订单数据
   */
  order: SalesOrderDetail;

  /**
   * 样式配置
   */
  styleConfig: PrintStyleConfig;

  /**
   * 字段选择
   */
  fieldSelection: FieldSelection;
}

/**
 * 数字转中文大写
 */
function numberToChinese(num: number): string {
  if (isNaN(num) || num < 0) return '零';

  const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  const units = ['', '拾', '佰', '仟'];
  const bigUnits = ['', '万', '亿'];

  if (num === 0) return '零';
  if (num < 0.01) return '零';

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  let result = '';

  // 转换整数部分
  if (integerPart === 0) {
    result = '零';
  } else {
    const numStr = integerPart.toString();
    const len = numStr.length;

    for (let i = 0; i < len; i++) {
      const digit = parseInt(numStr[i]);
      const pos = len - 1 - i;
      const unitIndex = pos % 4;
      const bigUnitIndex = Math.floor(pos / 4);

      if (digit === 0) {
        if (result.slice(-1) !== '零' && i < len - 1) {
          result += '零';
        }
      } else {
        result += digits[digit] + units[unitIndex];
      }

      if (unitIndex === 0 && bigUnitIndex > 0 && digit !== 0) {
        result += bigUnits[bigUnitIndex];
      }
    }

    result = result.replace(/零+$/, '');
  }

  // 添加小数部分
  if (decimalPart > 0) {
    const tenthsDigit = Math.floor(decimalPart / 10);
    const hundredthsDigit = decimalPart % 10;

    if (tenthsDigit > 0) {
      result += `${digits[tenthsDigit]}角`;
    }
    if (hundredthsDigit > 0) {
      result += `${digits[hundredthsDigit]}分`;
    }
  }

  return result || '零';
}

/**
 * 计算总重量
 */
function calculateTotalWeight(
  items: SalesOrderDetail['items'] | undefined
): number {
  if (!items || items.length === 0) {
    return 0;
  }

  const totalWeight = items.reduce((sum, item) => {
    const weight = item.manualWeight ?? item.product?.weight ?? 0;
    return sum + weight * item.quantity;
  }, 0);

  // 转换为吨
  return totalWeight / 1000;
}

/**
 * SalesOrderPrintContent 组件
 */
export function SalesOrderPrintContent({
  order,
  styleConfig,
  fieldSelection,
}: SalesOrderPrintContentProps) {
  // 计算汇总数据
  const summaryData = useMemo(() => {
    const items = order.items ?? [];

    const totalQuantity = items.reduce(
      (sum, item) => sum + (item.quantity || 0),
      0
    );

    // ✅ 金额优先：优先使用行小计 subtotal，避免 quantity * unitPrice 带来的四舍五入误差
    const totalAmount = items.reduce(
      (sum, item) =>
        sum +
        (typeof item.subtotal === 'number'
          ? item.subtotal
          : (item.quantity || 0) * (item.unitPrice || 0)),
      0
    );

    const totalWeight = calculateTotalWeight(items);
    const totalAmountChinese = numberToChinese(totalAmount);

    return {
      totalQuantity,
      totalAmount,
      totalWeight,
      totalAmountChinese,
    };
  }, [order.items]);

  // 获取字段配置
  const getFieldConfig = (key: string) =>
    salesOrderPrintConfig.fields.find(f => f.key === key);

  // 格式化字段值
  const formatFieldValue = (key: string, value: unknown) => {
    const field = getFieldConfig(key);
    if (field?.format) {
      return field.format(value);
    }
    return String(value ?? '-');
  };

  // 准备表头数据
  const headerData: Record<string, unknown> = {
    orderNumber: order.orderNumber,
    customerName: order.customer?.name || '未知客户',
    customerPhone: order.customer?.phone || '-',
    customerAddress: order.customer?.address || '-',
    shippingAddress: order.shippingAddress ?? order.customer?.address ?? '逐鹿',
    transferMode: order.transferMode || '-',
    createdAt: order.createdAt,
    status: order.status,
    remarks: order.remarks || '-',
  };

  return (
    <PrintLayout
      size={styleConfig.page.size}
      orientation={styleConfig.page.orientation}
      margin={styleConfig.page.margin}
    >
      {/* 表头 */}
      <div
        className="print-header"
        style={{
          textAlign: styleConfig.header.alignment,
          borderBottom: styleConfig.header.showBorder
            ? `2px solid ${styleConfig.header.borderColor}`
            : 'none',
          backgroundColor: styleConfig.header.backgroundColor,
          padding: `${styleConfig.header.padding}px`,
          marginBottom: '16px',
        }}
      >
        {styleConfig.header.showLogo && styleConfig.header.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={styleConfig.header.logoUrl}
            alt="Logo"
            style={{
              width: styleConfig.header.logoWidth,
              height: styleConfig.header.logoHeight,
              marginBottom: '8px',
            }}
          />
        )}
        <h1
          style={{
            fontSize: `${styleConfig.header.companyNameFontSize}px`,
            margin: '8px 0',
          }}
        >
          {styleConfig.header.companyName}
        </h1>
        {styleConfig.header.subtitle && (
          <h2
            style={{
              fontSize: `${styleConfig.header.subtitleFontSize}px`,
              margin: '4px 0',
            }}
          >
            {styleConfig.header.subtitle}
          </h2>
        )}
      </div>

      {/* 订单信息区 */}
      <div
        className="info-section"
        style={{
          marginBottom: '16px',
          display: 'grid',
          gridTemplateColumns:
            styleConfig.infoSection.layout === 'single-column'
              ? '1fr'
              : styleConfig.infoSection.layout === 'two-column'
                ? '1fr 1fr'
                : '1fr 1fr 1fr',
          gap: `${styleConfig.infoSection.rowSpacing}px`,
        }}
      >
        {fieldSelection.headerKeys.map(key => {
          const field = getFieldConfig(key);
          if (!field) return null;

          return (
            <div key={key}>
              <span
                style={{
                  color: styleConfig.infoSection.labelColor,
                  fontSize: `${styleConfig.infoSection.labelFontSize}px`,
                }}
              >
                {field.label}：
              </span>
              <span
                style={{
                  color: styleConfig.infoSection.valueColor,
                  fontSize: `${styleConfig.infoSection.valueFontSize}px`,
                }}
              >
                {formatFieldValue(key, headerData[key])}
              </span>
            </div>
          );
        })}
      </div>

      {/* 订单明细表格 */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginBottom: '16px',
          border:
            styleConfig.table.borderStyle !== 'none'
              ? `${styleConfig.table.borderWidth}px ${styleConfig.table.borderStyle} ${styleConfig.table.borderColor}`
              : 'none',
        }}
      >
        <thead>
          <tr
            style={{
              backgroundColor: styleConfig.table.headerBgColor,
              color: styleConfig.table.headerTextColor,
              fontSize: `${styleConfig.table.headerFontSize}px`,
              fontWeight: styleConfig.table.headerFontWeight,
            }}
          >
            {fieldSelection.itemKeys.map(key => {
              const field = getFieldConfig(key);
              if (!field) return null;

              return (
                <th
                  key={key}
                  style={{
                    padding: `${styleConfig.table.cellPadding}px`,
                    border:
                      styleConfig.table.borderStyle !== 'none'
                        ? `${styleConfig.table.borderWidth}px ${styleConfig.table.borderStyle} ${styleConfig.table.borderColor}`
                        : 'none',
                    textAlign: field.align,
                  }}
                >
                  {field.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {(order.items ?? []).map((item, index) => {
            // 显示单位与数量（优先使用销售员录入的显示单位/数量）
            const displayUnit = item.displayUnit || item.product?.unit || '-';
            const piecesPerUnit =
              item.piecesPerUnit ?? item.product?.piecesPerUnit ?? 0;
            const quantityDisplay =
              typeof item.displayQuantity === 'number' &&
              item.displayQuantity > 0
                ? item.displayQuantity
                : item.quantity;

            // ✅ 打印单价：与详情页/Excel 导出一致
            // - 按件销售：单价 = 行小计 ÷ 件数（如果可用），否则用 片价 × 每件片数近似
            // - 其他情况：直接使用片单价
            let displayUnitPrice = item.unitPrice;
            if (displayUnit === '件') {
              const units =
                typeof item.displayQuantity === 'number' &&
                item.displayQuantity > 0
                  ? item.displayQuantity
                  : piecesPerUnit > 0 && item.quantity
                    ? item.quantity / piecesPerUnit
                    : undefined;

              if (units && item.subtotal) {
                const perUnit = item.subtotal / units;
                if (Number.isFinite(perUnit)) {
                  displayUnitPrice = perUnit;
                }
              } else if (piecesPerUnit > 0 && item.unitPrice) {
                displayUnitPrice = item.unitPrice * piecesPerUnit;
              }
            }

            // 准备明细数据
            const itemData: Record<string, unknown> = {
              productCode: item.isManualProduct
                ? item.productCode || '-'
                : item.product?.code || '-',
              productName: item.isManualProduct
                ? item.manualProductName || '-'
                : item.product?.name || '-',
              specification:
                item.specification || item.product?.specification || '-',
              unit: displayUnit,
              quantity: quantityDisplay,
              piecesPerUnit:
                item.piecesPerUnit || item.product?.piecesPerUnit || '-',
              unitPrice: displayUnitPrice,
              subtotal: item.subtotal,
              remarks: item.remarks || '',
              batchNumber: item.batchNumber || '-',
              weight: item.manualWeight ?? item.product?.weight ?? 0,
            };

            return (
              <tr
                key={item.id}
                style={{
                  backgroundColor:
                    styleConfig.table.stripedRows && index % 2 === 1
                      ? styleConfig.table.stripedColor
                      : 'transparent',
                  fontSize: `${styleConfig.table.rowFontSize}px`,
                  height: `${styleConfig.table.rowHeight}px`,
                }}
              >
                {fieldSelection.itemKeys.map(key => {
                  const field = getFieldConfig(key);
                  if (!field) return null;

                  return (
                    <td
                      key={key}
                      style={{
                        padding: `${styleConfig.table.cellPadding}px`,
                        border:
                          styleConfig.table.borderStyle !== 'none'
                            ? `${styleConfig.table.borderWidth}px ${styleConfig.table.borderStyle} ${styleConfig.table.borderColor}`
                            : 'none',
                        textAlign: field.align,
                      }}
                    >
                      {formatFieldValue(key, itemData[key])}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* 汇总区 */}
      <div
        className="summary-section"
        style={{
          textAlign: styleConfig.summary.alignment,
          fontSize: `${styleConfig.summary.fontSize}px`,
          fontWeight: styleConfig.summary.fontWeight,
          padding: `${styleConfig.summary.padding}px`,
          marginBottom: '16px',
        }}
      >
        {fieldSelection.summaryKeys.map(key => {
          const field = getFieldConfig(key);
          if (!field) return null;

          return (
            <div
              key={key}
              style={{
                backgroundColor:
                  styleConfig.summary.highlightTotal && key === 'totalAmount'
                    ? styleConfig.summary.highlightColor
                    : 'transparent',
                display: 'inline-block',
                padding: '4px 8px',
                margin: '2px 8px',
              }}
            >
              {field.label}：
              {formatFieldValue(
                key,
                summaryData[key as keyof typeof summaryData]
              )}
            </div>
          );
        })}
      </div>

      {/* 签名区 */}
      {styleConfig.signature.show && (
        <div
          className="signature-section"
          style={{
            marginTop: `${styleConfig.signature.spacing}px`,
            display: 'flex',
            justifyContent: 'space-around',
            fontSize: `${styleConfig.signature.fontSize}px`,
          }}
        >
          {styleConfig.signature.fields.map((field, index) => (
            <div key={index} style={{ textAlign: 'center' }}>
              <div>{field.label}：</div>
              <div
                style={{
                  width: `${field.width}mm`,
                  borderBottom: `1px solid ${styleConfig.signature.lineColor}`,
                  marginTop: '32px',
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* 页脚 */}
      {styleConfig.footer.show && (
        <div
          className="footer-section"
          style={{
            marginTop: '32px',
            textAlign: styleConfig.footer.alignment,
            fontSize: `${styleConfig.footer.fontSize}px`,
            color: styleConfig.footer.textColor,
          }}
        >
          {styleConfig.footer.content
            .replace('{pageNumber}', '1')
            .replace('{totalPages}', '1')
            .replace('{date}', new Date().toLocaleDateString())
            .replace('{time}', new Date().toLocaleTimeString())}
        </div>
      )}
    </PrintLayout>
  );
}
