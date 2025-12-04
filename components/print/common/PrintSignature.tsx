/**
 * PrintSignature - 通用打印签名区组件
 *
 * 功能：
 * - 显示签名栏
 * - 支持多个签名字段
 * - 自动计算签名线宽度
 *
 * 设计原则：
 * - 配置驱动：签名字段完全可配置
 * - 灵活布局：自动均匀分布
 * - 样式统一：符合打印规范
 */

'use client';

import React from 'react';

import type { SignatureSettings } from '@/lib/types/print-style';

/**
 * 组件属性
 */
export interface PrintSignatureProps {
  /**
   * 签名区样式配置
   */
  settings: SignatureSettings;

  /**
   * 额外的 className
   */
  className?: string;
}

/**
 * PrintSignature 组件
 *
 * @example
 * ```tsx
 * <PrintSignature
 *   settings={{
 *     show: true,
 *     fields: [
 *       { label: '制单人', width: 80 },
 *       { label: '审核人', width: 80 },
 *       { label: '客户签收', width: 80 },
 *     ],
 *     spacing: 32,
 *     fontSize: 12,
 *     lineColor: '#000000',
 *   }}
 * />
 * ```
 */
export function PrintSignature({
  settings,
  className = '',
}: PrintSignatureProps) {
  // 如果不显示签名区，返回 null
  if (!settings.show) {
    return null;
  }

  return (
    <div
      className={`print-signature ${className}`}
      style={{
        marginTop: `${settings.spacing}px`,
        display: 'flex',
        justifyContent: 'space-around',
        fontSize: `${settings.fontSize}px`,
      }}
    >
      {settings.fields.map((field, index) => (
        <div
          key={index}
          className="signature-field"
          style={{
            textAlign: 'center',
          }}
        >
          {/* 签名标签 */}
          <div className="signature-label">{field.label}：</div>

          {/* 签名线 */}
          <div
            className="signature-line"
            style={{
              width: `${field.width}mm`,
              borderBottom: `1px solid ${settings.lineColor}`,
              marginTop: '32px',
              display: 'inline-block',
            }}
          />
        </div>
      ))}
    </div>
  );
}
