/**
 * 销售订单导出Hook
 */

import { useCallback, useState } from 'react';

import type { SalesOrderDetail } from '@/app/(dashboard)/sales-orders/[id]/components/types';
import { useToast } from '@/components/ui/use-toast';
import {
  SalesOrderExportService,
  type SalesOrderExcelExportOptions,
  type SalesOrderImageExportOptions,
} from '@/lib/services/sales-order-export-service';

/**
 * 销售订单导出Hook结果
 */
export interface UseSalesOrderExportResult {
  /** 导出为图片 */
  exportToImage: (element: HTMLElement, options?: SalesOrderImageExportOptions) => Promise<void>;
  /** 导出为Excel */
  exportToExcel: (order: SalesOrderDetail, options?: SalesOrderExcelExportOptions) => void;
  /** 导出为完整Excel（包含摘要和明细） */
  exportToCompleteExcel: (order: SalesOrderDetail, options?: SalesOrderExcelExportOptions) => void;
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
type ExcelExporter = (
  order: SalesOrderDetail,
  options: SalesOrderExcelExportOptions
) => void;

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

function useExcelExport(toast: ToastFn) {
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [excelError, setExcelError] = useState<Error | null>(null);

  const clearExcelError = useCallback(() => {
    setExcelError(null);
  }, []);

  const runExcelExport = useCallback(
    (
      order: SalesOrderDetail,
      options: SalesOrderExcelExportOptions | undefined,
      exporter: ExcelExporter,
      successDescription: string
    ) => {
      const exportOptions: SalesOrderExcelExportOptions = {
        orderId: order.id,
        orderNumber: order.orderNumber || '',
        ...options,
      };

      setIsExportingExcel(true);
      setExcelError(null);

      try {
        exporter(order, exportOptions);
        toast({
          title: '导出成功',
          description: successDescription,
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('导出Excel失败');
        setExcelError(err);
        toast({
          title: '导出失败',
          description: err.message,
          variant: 'destructive',
        });
        throw err;
      } finally {
        setIsExportingExcel(false);
      }
    },
    [toast]
  );

  const exportToExcel = useCallback(
    (order: SalesOrderDetail, options?: SalesOrderExcelExportOptions) =>
      runExcelExport(
        order,
        options,
        SalesOrderExportService.exportOrderToExcel,
        '销售订单Excel文件已生成并下载'
      ),
    [runExcelExport]
  );

  const exportToCompleteExcel = useCallback(
    (order: SalesOrderDetail, options?: SalesOrderExcelExportOptions) =>
      runExcelExport(
        order,
        options,
        SalesOrderExportService.exportOrderToCompleteExcel,
        '销售订单完整Excel文件已生成并下载'
      ),
    [runExcelExport]
  );

  return {
    exportToExcel,
    exportToCompleteExcel,
    isExportingExcel,
    excelError,
    clearExcelError,
  };
}

export function useSalesOrderExport(): UseSalesOrderExportResult {
  const { toast } = useToast();
  const {
    exportToImage,
    isExportingImage,
    imageError,
    clearImageError,
  } = useImageExport(toast);
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
