'use client';

import { useCallback, useState } from 'react';

type Html2Canvas = (
  element: HTMLElement,
  options?: {
    scale?: number;
    backgroundColor?: string;
    useCORS?: boolean;
    allowTaint?: boolean;
    logging?: boolean;
    imageTimeout?: number;
    removeContainer?: boolean;
    windowWidth?: number;
    windowHeight?: number;
  }
) => Promise<HTMLCanvasElement>;

declare global {
  interface Window {
    html2canvas?: Html2Canvas;
  }
}

const HTML2CANVAS_CDN =
  'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';

let html2canvasPromise: Promise<Html2Canvas> | null = null;

function loadHtml2canvas(): Promise<Html2Canvas> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('html2canvas 只能在浏览器环境使用'));
  }

  if (typeof window.html2canvas === 'function') {
    return Promise.resolve(window.html2canvas);
  }

  if (!html2canvasPromise) {
    const loadPromise = new Promise<Html2Canvas>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[data-lib="html2canvas"]'
      );

      if (existingScript) {
        existingScript.addEventListener('load', () => {
          if (typeof window.html2canvas === 'function') {
            resolve(window.html2canvas);
          } else {
            reject(new Error('html2canvas 脚本加载失败'));
          }
        });
        existingScript.addEventListener('error', () =>
          reject(new Error('html2canvas 脚本加载失败'))
        );
        return;
      }

      const script = document.createElement('script');
      script.src = HTML2CANVAS_CDN;
      script.async = true;
      script.dataset.lib = 'html2canvas';
      script.onload = () => {
        if (typeof window.html2canvas === 'function') {
          resolve(window.html2canvas);
        } else {
          reject(new Error('html2canvas 未正确加载'));
        }
      };
      script.onerror = () => {
        script.remove();
        reject(new Error('html2canvas 脚本加载失败'));
      };
      document.head.appendChild(script);
    });

    html2canvasPromise = loadPromise.catch(error => {
      html2canvasPromise = null;
      throw error;
    });
  }

  return html2canvasPromise;
}

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
        const html2canvas = await loadHtml2canvas();

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
