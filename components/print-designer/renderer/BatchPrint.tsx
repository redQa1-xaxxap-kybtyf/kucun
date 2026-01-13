/**
 * 打印设计器 - 批量打印服务
 *
 * 支持批量打印多个订单，带进度显示
 */

'use client';

import { useCallback, useState } from 'react';

import type { PrintTemplate } from '@/lib/print-designer/schemas';

interface BatchPrintOptions {
  /** 模板 */
  template: PrintTemplate;
  /** 订单数据列表 */
  dataList: Record<string, unknown>[];
  /** 每批处理数量 */
  batchSize?: number;
  /** 批次间隔 (ms) */
  intervalMs?: number;
  /** 进度回调 */
  onProgress?: (current: number, total: number) => void;
}

interface BatchPrintResult {
  success: boolean;
  printedCount: number;
  errors: string[];
}

/**
 * 批量打印 Hook
 */
export function useBatchPrint() {
  const [isPrinting, setIsPrinting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const batchPrint = useCallback(
    async ({
      template,
      dataList,
      batchSize = 10,
      intervalMs = 100,
      onProgress,
    }: BatchPrintOptions): Promise<BatchPrintResult> => {
      if (isPrinting) {
        return { success: false, printedCount: 0, errors: ['正在打印中'] };
      }

      setIsPrinting(true);
      setProgress({ current: 0, total: dataList.length });

      const errors: string[] = [];
      let printedCount = 0;

      try {
        // 分批处理
        for (let i = 0; i < dataList.length; i += batchSize) {
          const batch = dataList.slice(i, i + batchSize);

          // 处理当前批次
          for (const [index, data] of batch.entries()) {
            const current = i + index + 1;
            setProgress({ current, total: dataList.length });
            onProgress?.(current, dataList.length);

            try {
              // 渲染并打印
              await printSingleOrder(template, data);
              printedCount++;
            } catch (error) {
              errors.push(
                `订单 ${current}: ${error instanceof Error ? error.message : '未知错误'}`
              );
            }
          }

          // 批次间隔
          if (i + batchSize < dataList.length) {
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
          }
        }

        return { success: errors.length === 0, printedCount, errors };
      } finally {
        setIsPrinting(false);
        setProgress({ current: 0, total: 0 });
      }
    },
    [isPrinting]
  );

  return {
    batchPrint,
    isPrinting,
    progress,
  };
}

/**
 * 打印单个订单
 */
async function printSingleOrder(
  template: PrintTemplate,
  data: Record<string, unknown>
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // 创建隐藏的 iframe 用于打印
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.width = '0';
      iframe.style.height = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument;
      if (!doc) {
        reject(new Error('无法创建打印文档'));
        return;
      }

      // 生成打印内容
      const content = generatePrintHTML(template, data);

      doc.open();
      doc.write(content);
      doc.close();

      // 等待内容加载完成
      iframe.onload = () => {
        try {
          iframe.contentWindow?.print();
          setTimeout(() => {
            document.body.removeChild(iframe);
            resolve();
          }, 100);
        } catch (error) {
          document.body.removeChild(iframe);
          reject(error);
        }
      };
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 生成打印 HTML
 */
function generatePrintHTML(
  template: PrintTemplate,
  _data: Record<string, unknown>
): string {
  const { pageSettings } = template;

  const pageSize =
    pageSettings.size === 'Custom'
      ? `${pageSettings.width}mm ${pageSettings.height}mm`
      : `${pageSettings.size} ${pageSettings.orientation}`;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${template.name}</title>
        <style>
          @page {
            size: ${pageSize};
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .page {
            width: ${pageSettings.width}mm;
            height: ${pageSettings.height}mm;
            padding: ${pageSettings.padding[0]}mm ${pageSettings.padding[1]}mm ${pageSettings.padding[2]}mm ${pageSettings.padding[3]}mm;
            box-sizing: border-box;
            position: relative;
          }
          @media print {
            .page {
              page-break-after: always;
            }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <!-- 打印内容由 PrintCanvas 渲染 -->
          <div id="print-root"></div>
        </div>
      </body>
    </html>
  `;
}

/**
 * 批量打印进度对话框
 */
export function BatchPrintProgress({
  current,
  total,
  onCancel,
}: {
  current: number;
  total: number;
  onCancel: () => void;
}) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-96 rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold">批量打印</h3>

        <div className="mb-2 flex justify-between text-sm text-muted-foreground">
          <span>
            {current} / {total}
          </span>
          <span>{percentage}%</span>
        </div>

        <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>

        <button
          onClick={onCancel}
          className="w-full rounded-md border py-2 text-sm hover:bg-slate-50"
        >
          取消
        </button>
      </div>
    </div>
  );
}
