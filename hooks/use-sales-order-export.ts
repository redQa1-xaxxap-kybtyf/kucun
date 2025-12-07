/**
 * 销售订单导出Hook
 */

import { useCallback, useState } from 'react';

import type { SalesOrderDetail } from '@/app/(dashboard)/sales-orders/[id]/components/types';
import { useToast } from '@/components/ui/use-toast';
import {
  SalesOrderExportService,
  type SalesOrderImageExportOptions,
} from '@/lib/services/sales-order-export-service';
import { useFinanceExport } from '@/hooks/use-finance-export';

/**
 * 销售订单导出Hook结果
 */
export interface UseSalesOrderExportResult {
  /** 导出为图片 */
  exportToImage: (
    element: HTMLElement,
    options?: SalesOrderImageExportOptions
  ) => Promise<void>;
  /** 导出为Excel */
  exportToExcel: (order: SalesOrderDetail) => Promise<void>;
  /** 导出为完整Excel（包含摘要和明细） */
  exportToCompleteExcel: (order: SalesOrderDetail) => Promise<void>;
  /** 是否正在导出图片 */
  isExportingImage: boolean;
  /** 是否正在导出Excel */
  isExportingExcel: boolean;
  /** 图片导出错误 */
  imageError: Error | null;
  /** Excel导出错误 */
  excelError: Error | null;
  /** 清除错误 */
  clearErrors: () => void;
}

/**
 * 销售订单导出Hook
 * @returns 导出功能和状态
 */
type ToastFn = ReturnType<typeof useToast>['toast'];

function useImageExport(toast: ToastFn) {
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [imageError, setImageError] = useState<Error | null>(null);

  const clearImageError = useCallback(() => {
    setImageError(null);
  }, []);

  const exportToImage = useCallback(
    async (element: HTMLElement, options?: SalesOrderImageExportOptions) => {
      if (!options?.orderId || !options?.orderNumber) {
        const error = new Error('缺少必要的订单信息');
        setImageError(error);
        toast({
          title: '导出失败',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      setIsExportingImage(true);
      setImageError(null);

      try {
        await SalesOrderExportService.exportOrderToImage(element, options);
        toast({
          title: '导出成功',
          description: '销售订单图片已生成并下载',
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('导出图片失败');
        setImageError(err);
        toast({
          title: '导出失败',
          description: err.message,
          variant: 'destructive',
        });
        throw err;
      } finally {
        setIsExportingImage(false);
      }
    },
    [toast]
  );

  return {
    exportToImage,
    isExportingImage,
    imageError,
    clearImageError,
  };
}

function useExcelExport(_toast?: ToastFn) {
  const { exportData, isExporting, error } = useFinanceExport();

  const exportToExcel = useCallback(
    async (order: SalesOrderDetail) => {
      await exportData(`/api/sales-orders/${order.id}/export`, {
        format: 'excel',
        filters: {
          mode: 'details',
        },
      });
    },
    [exportData]
  );

  const exportToCompleteExcel = useCallback(
    async (order: SalesOrderDetail) => {
      await exportData(`/api/sales-orders/${order.id}/export`, {
        format: 'excel',
        filters: {
          mode: 'complete',
        },
      });
    },
    [exportData]
  );

  const clearExcelError = useCallback(() => {
    // 错误已在 useFinanceExport 内部通过 toast 处理，这里仅保留签名
  }, []);

  return {
    exportToExcel,
    exportToCompleteExcel,
    isExportingExcel: isExporting,
    excelError: error,
    clearExcelError,
  };
}

export function useSalesOrderExport(): UseSalesOrderExportResult {
  const { toast } = useToast();
  const { exportToImage, isExportingImage, imageError, clearImageError } =
    useImageExport(toast);
  const {
    exportToExcel,
    exportToCompleteExcel,
    isExportingExcel,
    excelError,
    clearExcelError,
  } = useExcelExport(toast);

  const clearErrors = useCallback(() => {
    clearImageError();
    clearExcelError();
  }, [clearExcelError, clearImageError]);

  return {
    exportToImage,
    exportToExcel,
    exportToCompleteExcel,
    isExportingImage,
    isExportingExcel,
    imageError,
    excelError,
    clearErrors,
  };
}
