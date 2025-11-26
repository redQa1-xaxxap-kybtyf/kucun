/**
 * 销售订单打印模板 - 天津豪星陶瓷发货单样式
 */
'use client';

import { formatCurrency, formatDate } from '@/lib/utils/format';

import type { SalesOrderDetail } from './types';

interface Props {
  order: SalesOrderDetail;
}

export function SalesOrderPrintTemplate({ order }: Props) {
  // 计算订单汇总信息
  const totalQuantity =
    order.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const totalAmount =
    order.items?.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    ) ?? 0;

  // 获取公司名称(从环境变量或使用默认值)
  const companyName = '天津豪星陶瓷';
  const shippingAddress =
    order.shippingAddress ?? order.customer.address ?? '逐鹿';

  return (
    <div
      className="sales-order-print-template"
      style={{
        width: '297mm',
        minHeight: '210mm',
        padding: '10mm',
        backgroundColor: '#ffffff',
        fontFamily: '"SimHei", "Microsoft YaHei", "黑体", Arial, sans-serif',
        fontSize: '12pt',
        color: '#000000',
        boxSizing: 'border-box',
        border: '3px solid #c00',
      }}
    >
      {/* 标题栏 */}
      <div
        style={{
          position: 'relative',
          textAlign: 'center',
          marginBottom: '8px',
          paddingBottom: '8px',
          borderBottom: '2px solid #c00',
        }}
      >
        <h1
          style={{
            fontSize: '32pt',
            fontWeight: 'bold',
            margin: 0,
            letterSpacing: '10px',
            display: 'inline-block',
          }}
        >
          {companyName}发货单
        </h1>
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            fontSize: '14pt',
            fontWeight: 'normal',
          }}
        >
          编号：{order.orderNumber}
        </div>
      </div>

      {/* 客户信息栏 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '8px',
          paddingBottom: '8px',
          borderBottom: '2px solid #c00',
          fontSize: '14pt',
        }}
      >
        <div style={{ flex: '0 0 auto' }}>
          客户：
          <span style={{ fontWeight: 'bold' }}>
            {order.customer?.name || '未知客户'}
          </span>
        </div>
        <div style={{ flex: '1', paddingLeft: '40px' }}>
          地址：{shippingAddress}
        </div>
        <div style={{ flex: '0 0 auto' }}>
          日期：{formatDate(order.createdAt, 'date')}
        </div>
      </div>

      {/* 订单明细表格 */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginBottom: '8px',
          fontSize: '13pt',
          border: '2px solid #c00',
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#ffffff', height: '40px' }}>
            <th style={tableHeaderStyle}>产品编号</th>
            <th style={tableHeaderStyle}>规格型号</th>
            <th style={tableHeaderStyle}>单位</th>
            <th style={tableHeaderStyle}>数量</th>
            <th style={tableHeaderStyle}>每件片数</th>
            <th style={tableHeaderStyle}>单价</th>
            <th style={tableHeaderStyle}>金额</th>
            <th style={tableHeaderStyle}>备注</th>
          </tr>
        </thead>
        <tbody>
          {(order.items ?? []).map((item, _index) => {
            // 从备注中提取每件片数信息
            const piecesPerPackage =
              item.remarks?.match(/(\d+)片\/件/)?.[1] ||
              item.remarks?.match(/(\d+)件(\d+)片/)?.[1] ||
              item.piecesPerUnit ||
              item.product?.piecesPerUnit ||
              '-';

            // 处理产品编码显示
            const productCode = item.isManualProduct
              ? item.productCode || '-'
              : item.product?.code || '-';

            return (
              <tr key={item.id} style={{ height: '35px' }}>
                <td style={tableCellStyle}>{productCode}</td>
                <td style={tableCellStyle}>
                  {item.specification || item.product?.specification || '-'}
                </td>
                <td style={tableCellStyle}>
                  {item.displayUnit || item.product?.unit || '-'}
                </td>
                <td style={tableCellStyle}>
                  {(() => {
                    const qty = (item.displayQuantity ?? item.quantity) || 0;
                    const ppu =
                      item.piecesPerUnit ?? item.product?.piecesPerUnit;
                    if (typeof ppu === 'number' && ppu > 0) {
                      const units = Math.floor(qty / ppu);
                      const pieces = Math.floor(qty % ppu);
                      const main = `${qty}片`;
                      const approx =
                        units > 0 || pieces > 0
                          ? ` (约${units > 0 ? `${units}件` : ''}${pieces > 0 ? `${pieces}片` : ''})`
                          : '';
                      return `${main}${approx}`;
                    }
                    return `${qty}片`;
                  })()}
                </td>
                <td style={tableCellStyle}>{piecesPerPackage}</td>
                <td style={tableCellStyle}>{formatCurrency(item.unitPrice)}</td>
                <td style={tableCellStyle}>{formatCurrency(item.subtotal)}</td>
                <td style={tableCellStyle}>{item.remarks || ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* 汇总信息栏 */}
      <div
        style={{
          padding: '12px 15px',
          border: '2px solid #c00',
          fontSize: '15pt',
          fontWeight: 'bold',
          backgroundColor: '#ffffff',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            合计金额（大写）：
            <span style={{ textDecoration: 'none' }}>
              {numberToChinese(totalAmount)}元整
            </span>
          </div>
          <div style={{ display: 'flex', gap: '50px', alignItems: 'center' }}>
            <span>合计数量：{totalQuantity}</span>
            <span>
              总重量：
              <span style={{ color: '#00aa00', fontWeight: 'bold' }}>
                {calculateTotalWeight(order.items)}吨
              </span>
            </span>
            <span>
              合计金额：
              <span style={{ color: '#ff0000', fontWeight: 'bold' }}>
                {formatCurrency(totalAmount)}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// 表格样式常量
const tableHeaderStyle: React.CSSProperties = {
  border: '2px solid #c00',
  padding: '10px 6px',
  textAlign: 'center',
  fontWeight: 'bold',
  backgroundColor: '#ffffff',
  fontSize: '13pt',
};

const tableCellStyle: React.CSSProperties = {
  border: '1px solid #c00',
  padding: '8px 6px',
  textAlign: 'center',
  fontSize: '12pt',
};

// 数字转中文大写
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
        // 处理零的情况
        if (result.slice(-1) !== '零' && i < len - 1) {
          result += '零';
        }
      } else {
        result += digits[digit] + units[unitIndex];
      }

      // 添加万、亿
      if (unitIndex === 0 && bigUnitIndex > 0 && digit !== 0) {
        result += bigUnits[bigUnitIndex];
      }
    }

    // 清理末尾的零
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

// 计算总重量(示例实现,实际需要根据产品数据)
function calculateTotalWeight(
  items: SalesOrderDetail['items'] | undefined
): string {
  if (!items || items.length === 0) {
    return '0.0';
  }

  // 这里需要根据实际的产品重量数据计算
  // 示例: 假设每个产品都有weight属性
  const totalWeight = items.reduce((sum, item) => {
    const weight = item.manualWeight ?? item.product?.weight ?? 0;
    return sum + weight * item.quantity;
  }, 0);

  // 转换为吨并保留1位小数
  return (totalWeight / 1000).toFixed(1);
}
