/**
 * 导出服务 - 提供图片和Excel导出功能
 *
 * 严格遵循全栈项目统一约定规范：
 * - 客户端代码使用客户端 logger，避免导入服务端依赖
 * - 使用动态导入加载大型库（html2canvas），不依赖外网 CDN
 */

import { saveAs } from 'file-saver';
import { useCallback, useState } from 'react';

import { clientLogger as logger } from '@/lib/logger/client';

// HTML2Canvas 动态导入类型
type Html2CanvasFunction = (
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
    html2canvas?: Html2CanvasFunction;
  }
}

/**
 * 图片导出配置
 */
export interface ImageExportOptions {
  /** 文件名，不包含扩展名 */
  filename?: string;
  /** 图片质量 0-1，默认0.95 */
  quality?: number;
  /** 图片背景色，默认白色 */
  backgroundColor?: string;
  /** 缩放比例，默认2（适合高清屏） */
  scale?: number;
  /** 文件格式，默认 png */
  format?: 'png' | 'jpeg' | 'webp';
}

/**
 * Excel导出配置
 */
export interface ExcelExportOptions<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  /** 文件名，不包含扩展名 */
  filename?: string;
  /** 工作表名称 */
  sheetName?: string;
  /** 是否包含表头 */
  includeHeaders?: boolean;
  /** 自定义表头映射 */
  headerMapping?: Record<string, string>;
  /** 列宽配置（单位：字符数） */
  columnWidths?: number[];
  /** 数据转换函数 */
  dataTransformer?: (data: T[]) => Array<Record<string, unknown>>;
}

/**
 * 导出服务类
 */
export class ExportService {
  private static html2canvasPromise: Promise<Html2CanvasFunction> | null = null;
  private static xlsxPromise: Promise<typeof import('xlsx')> | null = null;

  /**
   * 动态加载html2canvas库
   */
  private static async loadHtml2canvas(): Promise<Html2CanvasFunction> {
    if (typeof window === 'undefined') {
      throw new Error('html2canvas 只能在浏览器环境使用');
    }

    // 已经挂在全局，直接复用
    if (typeof window.html2canvas === 'function') {
      return window.html2canvas;
    }

    // 首次动态导入本地依赖（不走外网 CDN）
    if (!this.html2canvasPromise) {
      this.html2canvasPromise = import('html2canvas')
        .then(mod => {
          const html2canvas = (
            mod as unknown as { default: Html2CanvasFunction }
          ).default;
          if (typeof html2canvas !== 'function') {
            throw new Error('html2canvas 模块加载失败');
          }
          // 缓存到全局，便于其他模块复用
          window.html2canvas = html2canvas;
          return html2canvas;
        })
        .catch(error => {
          this.html2canvasPromise = null;
          throw error;
        });
    }

    return this.html2canvasPromise;
  }

  /**
   * 动态加载 xlsx 库（避免首屏打包进大体积依赖）
   */
  private static async loadXLSX(): Promise<typeof import('xlsx')> {
    if (typeof window === 'undefined') {
      throw new Error('Excel 导出只能在浏览器环境使用');
    }

    if (!this.xlsxPromise) {
      this.xlsxPromise = import('xlsx').catch(error => {
        this.xlsxPromise = null;
        throw error;
      });
    }

    return this.xlsxPromise;
  }

  /**
   * 将DOM元素导出为图片
   * @param element 要导出的DOM元素
   * @param options 导出配置
   */
  static async exportToImage(
    element: HTMLElement,
    options: ImageExportOptions = {}
  ): Promise<void> {
    const {
      filename = 'export',
      quality = 0.95,
      backgroundColor = '#ffffff',
      scale = 2,
      format = 'png',
    } = options;

    try {
      logger.info('export-service', '开始加载html2canvas');
      const html2canvas = await this.loadHtml2canvas();
      logger.info('export-service', 'html2canvas加载成功，开始生成canvas');

      logger.debug('export-service', '元素信息', {
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight,
        offsetWidth: element.offsetWidth,
        offsetHeight: element.offsetHeight,
      });

      // 生成canvas - 针对打印模板优化的配置
      const canvas = await html2canvas(element, {
        scale: scale || 2,
        backgroundColor: backgroundColor || '#ffffff',
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 15000,
        removeContainer: true,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });

      logger.info('export-service', 'Canvas生成成功，开始转换为Blob');
      logger.debug('export-service', 'Canvas信息', {
        width: canvas.width,
        height: canvas.height,
      });

      // 转换为Blob
      const mimeType =
        format === 'png'
          ? 'image/png'
          : format === 'jpeg'
            ? 'image/jpeg'
            : 'image/webp';

      const blob = await new Promise<Blob | null>((resolve, reject) => {
        canvas.toBlob(
          blob => {
            if (blob) {
              logger.info(
                'export-service',
                `Blob生成成功，大小: ${blob.size} bytes`
              );
              resolve(blob);
            } else {
              logger.error('export-service', 'Blob生成失败');
              reject(new Error('图片生成失败 - Blob为空'));
            }
          },
          mimeType,
          quality
        );
      });

      if (!blob) {
        throw new Error('图片生成失败');
      }

      logger.info('export-service', '开始保存文件');
      // 使用file-saver保存文件
      saveAs(blob, `${filename}.${format}`);
      logger.info('export-service', '文件保存完成');
    } catch (error) {
      logger.error('export-service', '图片导出详细错误', error);

      const errorMessage =
        error instanceof Error ? error.message : '导出图片时发生未知错误';

      // 提供更具体的错误信息
      if (errorMessage.includes('html2canvas')) {
        throw new Error(`html2canvas库加载失败: ${errorMessage}`);
      } else if (errorMessage.includes('timeout')) {
        throw new Error(`图片生成超时: ${errorMessage}`);
      } else if (errorMessage.includes('Blob')) {
        throw new Error(`图片转换失败: ${errorMessage}`);
      } else {
        throw new Error(`图片导出失败: ${errorMessage}`);
      }
    }
  }

  /**
   * 将数据导出为Excel文件
   * @param data 要导出的数据数组
   * @param options 导出配置
   */
  static async exportToExcel<T extends Record<string, unknown>>(
    data: T[],
    options: ExcelExportOptions<T> = {}
  ): Promise<void> {
    const {
      filename = 'export',
      sheetName = 'Sheet1',
      includeHeaders = true,
      headerMapping = {},
      columnWidths = [],
      dataTransformer,
    } = options;

    try {
      const XLSX = await this.loadXLSX();
      const transformedData: Array<Record<string, unknown>> = dataTransformer
        ? dataTransformer(data)
        : data.map(item => ({ ...item }) as Record<string, unknown>);

      if (transformedData.length === 0) {
        throw new Error('没有数据可导出');
      }

      let processedData = transformedData;

      // 应用表头映射
      if (Object.keys(headerMapping).length > 0) {
        processedData = processedData.map(item => {
          const mappedItem: Record<string, unknown> = {};
          Object.keys(item).forEach(key => {
            const newKey = headerMapping[key] || key;
            mappedItem[newKey] = item[key];
          });
          return mappedItem;
        });
      }

      // 创建工作表
      const worksheet = XLSX.utils.json_to_sheet(processedData, {
        header: includeHeaders ? undefined : [], // 控制是否包含表头
      });

      // 设置列宽
      if (columnWidths.length > 0) {
        const colWidths = columnWidths.map(width => ({ width }));
        worksheet['!cols'] = colWidths;
      }

      // 创建工作簿
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      // 导出文件
      XLSX.writeFile(workbook, `${filename}.xlsx`, {
        compression: true, // 启用压缩
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '导出Excel时发生未知错误';
      throw new Error(errorMessage);
    }
  }

  /**
   * 销毁html2canvas缓存
   */
  static clearCache(): void {
    this.html2canvasPromise = null;
    // 清理DOM中的script标签
    const script = document.querySelector('script[data-lib="html2canvas"]');
    if (script) {
      script.remove();
    }
  }
}

/**
 * 导出Hook - 用于React组件
 */
export interface UseExportResult {
  /** 导出为图片 */
  exportToImage: (
    element: HTMLElement,
    options?: ImageExportOptions
  ) => Promise<void>;
  /** 导出为Excel */
  exportToExcel: <T extends Record<string, unknown>>(
    data: T[],
    options?: ExcelExportOptions<T>
  ) => Promise<void>;
  /** 是否正在导出图片 */
  isExportingImage: boolean;
  /** 图片导出错误 */
  imageError: Error | null;
}

export function useExport(): UseExportResult {
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [imageError, setImageError] = useState<Error | null>(null);

  const exportToImage = useCallback(
    async (element: HTMLElement, options: ImageExportOptions = {}) => {
      setIsExportingImage(true);
      setImageError(null);

      try {
        await ExportService.exportToImage(element, options);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('导出图片失败');
        setImageError(err);
        throw err;
      } finally {
        setIsExportingImage(false);
      }
    },
    []
  );

  const exportToExcel = useCallback(
    async <T extends Record<string, unknown>>(
      data: T[],
      options: ExcelExportOptions<T> = {}
    ) => {
      try {
        await ExportService.exportToExcel<T>(data, options);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('导出Excel失败');
        setImageError(err);
        throw err;
      }
    },
    []
  );

  return {
    exportToImage,
    exportToExcel,
    isExportingImage,
    imageError,
  };
}
