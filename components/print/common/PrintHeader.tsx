/**
 * PrintHeader - 通用打印表头组件
 *
 * 功能：
 * - 统一的表头样式
 * - 支持 Logo 显示
 * - 公司名称和副标题
 * - 完全由样式配置驱动
 *
 * 设计原则：
 * - 单一职责：仅负责渲染表头
 * - 配置驱动：所有样式通过 props 传入
 * - 无业务逻辑：纯展示组件
 */

'use client';

import React from 'react';

import type { HeaderSettings } from '@/lib/types/print-style';

/**
 * 组件属性
 */
export interface PrintHeaderProps {
  /**
   * 表头样式配置
   */
  settings: HeaderSettings;

  /**
   * 副标题（可覆盖配置中的副标题）
   */
  subtitle?: string;

  /**
   * 订单编号
   */
  orderNumber?: string;

  /**
   * 额外的 className
   */
  className?: string;
}

/**
 * PrintHeader 组件
 *
 * @example
 * ```tsx
 * <PrintHeader
 *   settings={styleConfig.header}
 *   subtitle="销售订单"
 * />
 * ```
 */
export function PrintHeader({
  settings,
  subtitle,
  orderNumber,
  className = '',
}: PrintHeaderProps) {
  const displaySubtitle = subtitle || settings.subtitle;
  const orderNumberConfig = settings.orderNumber;

  return (
    <div
      className={`print-header ${className}`}
      style={{
        position: 'relative',
        textAlign: settings.alignment,
        borderBottom: settings.showBorder
          ? `${settings.borderWidth ?? 2}px solid ${settings.borderColor}`
          : 'none',
        backgroundColor: settings.backgroundColor,
        padding: `${settings.padding}px`,
        marginBottom: '16px',
      }}
    >
      {/* 订单编号 - 右上角 */}
      {orderNumber &&
        orderNumberConfig?.show &&
        orderNumberConfig.position === 'top-right' && (
          <div
            style={{
              position: 'absolute',
              top: `${settings.padding}px`,
              right: `${settings.padding}px`,
              fontSize: `${orderNumberConfig.fontSize}px`,
              fontWeight: orderNumberConfig.fontWeight,
            }}
          >
            {orderNumberConfig.label}: {orderNumber}
          </div>
        )}

      {/* 订单编号 - 左上角 */}
      {orderNumber &&
        orderNumberConfig?.show &&
        orderNumberConfig.position === 'top-left' && (
          <div
            style={{
              position: 'absolute',
              top: `${settings.padding}px`,
              left: `${settings.padding}px`,
              fontSize: `${orderNumberConfig.fontSize}px`,
              fontWeight: orderNumberConfig.fontWeight,
            }}
          >
            {orderNumberConfig.label}: {orderNumber}
          </div>
        )}

      {/* Logo */}
      {settings.showLogo && settings.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={settings.logoUrl}
          alt="Logo"
          style={{
            width: settings.logoWidth,
            height: settings.logoHeight,
            marginBottom: '8px',
          }}
        />
      )}

      {/* 公司名称 */}
      <h1
        style={{
          fontSize: `${settings.companyNameFontSize}px`,
          margin: '8px 0',
          fontWeight: 'bold',
        }}
      >
        {settings.companyName}
      </h1>

      {/* 副标题 */}
      {displaySubtitle && (
        <h2
          style={{
            fontSize: `${settings.subtitleFontSize}px`,
            margin: '4px 0',
            fontWeight: 'normal',
          }}
        >
          {displaySubtitle}
        </h2>
      )}

      {/* 订单编号 - 内联显示 */}
      {orderNumber &&
        orderNumberConfig?.show &&
        orderNumberConfig.position === 'inline' && (
          <div
            style={{
              marginTop: '8px',
              fontSize: `${orderNumberConfig.fontSize}px`,
              fontWeight: orderNumberConfig.fontWeight,
            }}
          >
            {orderNumberConfig.label}: {orderNumber}
          </div>
        )}
    </div>
  );
}
