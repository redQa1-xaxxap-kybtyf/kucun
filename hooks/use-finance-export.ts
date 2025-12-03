/**
 * 财务模块导出Hook
 *
 * 功能：
 * - 支持Excel和CSV格式导出
 * - 错误处理和状态管理
 * - Toast通知
 */

'use client';

import { useCallback, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { clientLogger as logger } from '@/lib/logger/client';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';

/**
 * 导出选项
 */
export interface ExportOptions {
  /** 导出格式 */
  format?: 'excel' | 'csv';
  /** 筛选条件（传递给API） */
  filters?: Record<string, unknown>;
}

/**
 * 导出结果
 */
export interface UseFinanceExportResult {
  /** 导出函数 */
  exportData: (endpoint: string, options?: ExportOptions) => Promise<void>;
  /** 是否正在导出 */
  isExporting: boolean;
  /** 导出错误 */
  error: Error | null;
}

/**
 * 财务导出Hook
 */
export function useFinanceExport(): UseFinanceExportResult {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const exportData = useCallback(
    async (endpoint: string, options: ExportOptions = {}) => {
      const { format = 'excel', filters = {} } = options;

      setIsExporting(true);
      setError(null);

      try {
        logger.info('finance-export', `开始导出: ${endpoint}`, {
          format,
          filters,
        });

        // 发送导出请求（附带 CSRF 头）
        const response = await fetch(
          endpoint,
          getCsrfTokenHeader({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...filters,
              format,
            }),
          })
        );

        if (!response.ok) {
          // 尝试解析错误信息
          let errorMessage = `导出失败: HTTP ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            // 无法解析JSON,使用默认错误消息
          }
          throw new Error(errorMessage);
        }

        // 获取文件名（支持RFC 6266和RFC 5987标准）
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `export_${Date.now()}.${format === 'csv' ? 'csv' : 'xlsx'}`;

        if (contentDisposition) {
          // 优先尝试解析RFC 5987编码的filename* (支持UTF-8)
          const filenameStarMatch = /filename\*=UTF-8''([^;]+)/.exec(
            contentDisposition
          );
          if (filenameStarMatch && filenameStarMatch[1]) {
            filename = decodeURIComponent(filenameStarMatch[1]);
          } else {
            // 回退到标准filename参数（带或不带引号）
            const filenameMatch = /filename=["']?([^"';]+)["']?/.exec(
              contentDisposition
            );
            if (filenameMatch && filenameMatch[1]) {
              filename = filenameMatch[1];
            }
          }
        }

        // 确保文件名有正确的扩展名
        if (!filename.endsWith('.csv') && !filename.endsWith('.xlsx')) {
          filename = `${filename}.${format === 'csv' ? 'csv' : 'xlsx'}`;
        }

        // 下载文件
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();

        // 清理
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }, 100);

        logger.info('finance-export', '导出成功', { filename });

        toast({
          title: '导出成功',
          description: `文件已生成：${filename}`,
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error('导出失败');
        logger.error('finance-export', '导出失败', error);
        setError(error);

        toast({
          variant: 'destructive',
          title: '导出失败',
          description: error.message,
        });

        throw error;
      } finally {
        setIsExporting(false);
      }
    },
    [toast]
  );

  return {
    exportData,
    isExporting,
    error,
  };
}
