/**
 * 打印设计器 - 条码渲染器
 *
 * 渲染条形码和二维码
 * 注意：需要安装 jsbarcode 或 qrcode 库
 */

'use client';

import { useEffect, useRef } from 'react';

import type { BarcodeElement } from '@/lib/print-designer/schemas';

import { getNestedValue, ptToPx } from '../utils';

interface BarcodeRendererProps {
  element: BarcodeElement;
  data: Record<string, unknown>;
  scale: number;
}

export function BarcodeRenderer({
  element,
  data,
  scale,
}: BarcodeRendererProps) {
  const { field, format, showText } = element;
  const svgRef = useRef<SVGSVGElement>(null);

  // 获取条码值
  const value = (getNestedValue(data, field) as string) || '';

  useEffect(() => {
    if (!svgRef.current || !value) return;

    // 动态导入 JsBarcode 以避免 SSR 问题
    // 如果项目中未安装 jsbarcode，则显示占位内容
    const renderBarcode = async () => {
      try {
        // @ts-expect-error -- jsbarcode is an optional dependency
        const JsBarcode = (await import('jsbarcode')).default;

        if (format === 'QR') {
          // QR 码需要使用其他库，这里暂时显示占位
          return;
        }

        JsBarcode(svgRef.current, value, {
          format: format === 'CODE128' ? 'CODE128' : 'CODE39',
          width: 2 * scale,
          height: 50 * scale,
          displayValue: showText,
          fontSize: ptToPx(10) * scale,
          margin: 0,
        });
      } catch {
        // JsBarcode 未安装，保持占位显示
      }
    };

    renderBarcode();
  }, [value, format, showText, scale]);

  if (!value) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
          color: '#999',
          fontSize: 12 * scale,
          border: '1px dashed #ccc',
        }}
      >
        无条码数据
      </div>
    );
  }

  if (format === 'QR') {
    // QR 码占位
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fff',
          border: '1px solid #ccc',
          fontSize: 10 * scale,
        }}
      >
        QR: {value}
      </div>
    );
  }

  return (
    <svg
      ref={svgRef}
      style={{
        width: '100%',
        height: '100%',
      }}
    />
  );
}
