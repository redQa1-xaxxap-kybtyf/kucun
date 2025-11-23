/**
 * 打印服务
 *
 * 功能：
 * - HTML 打印（window.print）
 * - PDF 导出（html2canvas + jsPDF）
 *
 * 设计原则：
 * - 单一职责：仅负责打印和 PDF 导出的核心逻辑
 * - 依赖注入：jsPDF 动态加载，减少初始包体积
 */

import type { PageOrientation } from '@/lib/types/print-style';

/**
 * PDF 导出选项
 */
export interface PDFExportOptions {
  /**
   * 页面方向
   */
  orientation?: PageOrientation;

  /**
   * 文件名
   */
  filename?: string;

  /**
   * 图片质量 (0-1)
   * @default 0.95
   */
  quality?: number;

  /**
   * 缩放比例
   * @default 2
   */
  scale?: number;

  /**
   * 纸张格式
   * @default 'a4'
   */
  format?: 'a4' | 'a5' | 'letter';
}

/**
 * html2canvas 类型定义
 */
type Html2CanvasFunction = (
  element: HTMLElement,
  options?: {
    scale?: number;
    useCORS?: boolean;
    logging?: boolean;
    backgroundColor?: string | null;
  }
) => Promise<HTMLCanvasElement>;

/**
 * 打印服务错误类
 */
export class PrintServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrintServiceError';
  }
}

/**
 * 打印服务
 *
 * 提供 HTML 打印和 PDF 导出功能
 */
export class PrintService {
  /**
   * html2canvas 实例缓存
   */
  private static html2canvasInstance: Html2CanvasFunction | null = null;

  /**
   * 动态加载 html2canvas（CDN 加载）
   *
   * @returns html2canvas 函数
   */
  private static async loadHtml2canvas(): Promise<Html2CanvasFunction> {
    // 检查缓存
    if (this.html2canvasInstance) {
      return this.html2canvasInstance;
    }

    // 检查全局对象
    if (typeof window !== 'undefined' && (window as never)['html2canvas']) {
      const cachedHtml2canvas = (window as never)['html2canvas'];
      this.html2canvasInstance = cachedHtml2canvas;
      return this.html2canvasInstance;
    }

    // 动态加载
    const HTML2CANVAS_CDN =
      'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = HTML2CANVAS_CDN;
      script.async = true;

      script.onload = () => {
        const loadedHtml2canvas = (window as never)['html2canvas'];
        if (loadedHtml2canvas) {
          this.html2canvasInstance = loadedHtml2canvas;
          resolve(this.html2canvasInstance);
        } else {
          reject(new PrintServiceError('html2canvas 加载失败：全局对象未定义'));
        }
      };

      script.onerror = () => {
        reject(new PrintServiceError('html2canvas 加载失败：网络错误'));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * HTML 打印（主方案）
   *
   * 使用浏览器原生 window.print()
   * 依赖 @media print CSS 规则
   */
  static print(): void {
    if (typeof window === 'undefined') {
      throw new PrintServiceError('打印功能仅在浏览器环境中可用');
    }

    window.print();
  }

  /**
   * PDF 导出（备选方案）
   *
   * 使用 html2canvas 渲染为图片，再通过 jsPDF 生成 PDF
   *
   * @param element - 要导出的 DOM 元素
   * @param options - 导出选项
   */
  static async exportToPDF(
    element: HTMLElement,
    options: PDFExportOptions = {}
  ): Promise<void> {
    if (typeof window === 'undefined') {
      throw new PrintServiceError('PDF 导出功能仅在浏览器环境中可用');
    }

    const {
      orientation = 'landscape',
      filename = `print_${Date.now()}.pdf`,
      quality = 0.95,
      scale = 2,
      format = 'a4',
    } = options;

    try {
      // 加载 html2canvas
      const html2canvas = await this.loadHtml2canvas();

      // 渲染为 Canvas
      const canvas = await html2canvas(element, {
        scale,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      // 转换为图片数据
      const imgData = canvas.toDataURL('image/jpeg', quality);

      // 动态导入 jsPDF
      const { jsPDF } = await import('jspdf');

      // 创建 PDF
      const pdf = new jsPDF({
        orientation,
        unit: 'mm',
        format,
      });

      // 计算图片尺寸以适应 PDF 页面
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

      const finalWidth = imgWidth * ratio;
      const finalHeight = imgHeight * ratio;

      // 居中放置
      const x = (pdfWidth - finalWidth) / 2;
      const y = (pdfHeight - finalHeight) / 2;

      // 添加图片到 PDF
      pdf.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight);

      // 保存 PDF
      pdf.save(filename);
    } catch (error) {
      if (error instanceof Error) {
        throw new PrintServiceError(`PDF 导出失败: ${error.message}`);
      }
      throw new PrintServiceError('PDF 导出失败: 未知错误');
    }
  }

  /**
   * 获取打印预览 URL
   *
   * 生成一个可用于预览的 Blob URL
   *
   * @param element - 要预览的 DOM 元素
   * @param options - 导出选项
   * @returns Blob URL
   */
  static async getPrintPreviewUrl(
    element: HTMLElement,
    options: PDFExportOptions = {}
  ): Promise<string> {
    const {
      orientation = 'landscape',
      quality = 0.95,
      scale = 2,
      format = 'a4',
    } = options;

    try {
      const html2canvas = await this.loadHtml2canvas();
      const canvas = await html2canvas(element, {
        scale,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/jpeg', quality);
      const { jsPDF } = await import('jspdf');

      const pdf = new jsPDF({
        orientation,
        unit: 'mm',
        format,
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth * ratio, imgHeight * ratio);

      const blob = pdf.output('blob');
      return URL.createObjectURL(blob);
    } catch (error) {
      if (error instanceof Error) {
        throw new PrintServiceError(`生成预览失败: ${error.message}`);
      }
      throw new PrintServiceError('生成预览失败: 未知错误');
    }
  }

  /**
   * 清理 Blob URL
   *
   * @param url - 通过 getPrintPreviewUrl 生成的 URL
   */
  static revokePrintPreviewUrl(url: string): void {
    if (typeof window !== 'undefined' && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }
}
