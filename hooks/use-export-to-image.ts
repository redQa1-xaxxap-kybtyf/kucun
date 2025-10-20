'use client';

import html2canvas from 'html2canvas';
import { useCallback, useState } from 'react';

interface ExportToImageOptions {
  /** 图片文件名,不包含扩展名 */
  filename?: string;
  /** 图片质量 0-1,默认0.95 */
  quality?: number;
  /** 图片背景色,默认白色 */
  backgroundColor?: string;
  /** 缩放比例,默认2(适合高清屏) */
  scale?: number;
}

interface ExportToImageResult {
  /** 执行导出的函数 */
  exportToImage: (
    element: HTMLElement,
    options?: ExportToImageOptions
  ) => Promise<void>;
  /** 是否正在导出 */
  isExporting: boolean;
  /** 错误信息 */
  error: Error | null;
}

/**
 * 将DOM元素导出为图片的Hook
 *
 * @example
 * ```tsx
 * const { exportToImage, isExporting, error } = useExportToImage();
 *
 * const handleExport = () => {
 *   const element = document.getElementById('sales-order-content');
 *   if (element) {
 *     exportToImage(element, { filename: '销售订单-SO202501001' });
 *   }
 * };
 * ```
 */
export function useExportToImage(): ExportToImageResult {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const exportToImage = useCallback(
    async (element: HTMLElement, options: ExportToImageOptions = {}) => {
      const {
        filename = 'export',
        quality = 0.95,
        backgroundColor = '#ffffff',
        scale = 2,
      } = options;

      setIsExporting(true);
      setError(null);

      try {
        // 生成canvas
        const canvas = await html2canvas(element, {
          scale,
          backgroundColor,
          useCORS: true, // 允许跨域图片
          allowTaint: false,
          logging: false, // 生产环境关闭日志
          imageTimeout: 15000, // 图片加载超时15秒
          removeContainer: true,
          windowWidth: element.scrollWidth,
          windowHeight: element.scrollHeight,
        });

        // 转换为Blob
        const blob = await new Promise<Blob | null>(resolve => {
          canvas.toBlob(resolve, 'image/png', quality);
        });

        if (!blob) {
          throw new Error('图片生成失败');
        }

        // 创建下载链接
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.png`;

        // 触发下载
        document.body.appendChild(link);
        link.click();

        // 清理
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('导出图片时发生未知错误');
        setError(error);
        throw error;
      } finally {
        setIsExporting(false);
      }
    },
    []
  );

  return {
    exportToImage,
    isExporting,
    error,
  };
}
