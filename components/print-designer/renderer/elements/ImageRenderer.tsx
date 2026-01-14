/**
 * 打印设计器 - 图片渲染器
 *
 * 渲染静态图片或动态绑定的图片
 */

'use client';

import type { ImageElement } from '@/lib/print-designer/schemas';

import { getNestedValue } from '../utils';

interface ImageRendererProps {
  element: ImageElement;
  data: Record<string, unknown>;
  scale: number;
}

export function ImageRenderer({ element, data, scale }: ImageRendererProps) {
  const { src, isDynamic, fit } = element;

  // 获取图片源
  const imageSrc = isDynamic
    ? (getNestedValue(data, src) as string) || ''
    : src;

  if (!imageSrc) {
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
        无图片
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageSrc}
      alt=""
      style={{
        width: '100%',
        height: '100%',
        objectFit: fit,
      }}
    />
  );
}
