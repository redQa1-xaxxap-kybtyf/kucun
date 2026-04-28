/**
 * 打印设计器 - 业务侧打印预览对话框（默认模板）
 *
 * 目标：业务用户只需点“打印”，系统自动使用该类型的默认模板渲染并打印。
 */

'use client';

import { Loader2, Printer, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { fetchDefaultTemplate } from '@/lib/print-designer/default-template-client';
import { fetchPrintDataForTemplate } from '@/lib/print-designer/preview-data-client';
import type { PrintTemplate, TemplateType } from '@/lib/print-designer/schemas';

import { PrintCanvas } from './PrintCanvas';
import { printTemplateContent } from './print-frame';

const typeLabels: Record<TemplateType, string> = {
  'sales-order': '销售订单',
  'purchase-order': '采购订单',
  'factory-shipment': '厂家发货',
  'delivery-note': '发货单',
  'inbound-record': '仓库进货（入库记录）',
  'return-order': '退货订单',
  'finance-monthly-report': '月度报表',
  'finance-annual-report': '年度报表',
  'finance-profit-loss-report': '盈亏分析',
  custom: '自定义',
};

function getInitialPreviewScale(): number {
  if (typeof window === 'undefined') {
    return 1;
  }

  if (window.innerWidth < 640) {
    return 0.5;
  }

  if (window.innerWidth < 1180) {
    return 0.75;
  }

  return 1;
}

interface PrintTemplatePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateType: TemplateType;
  documentId: string;
  title?: string;
}

export function PrintTemplatePreviewDialog({
  open,
  onOpenChange,
  templateType,
  documentId,
  title,
}: PrintTemplatePreviewDialogProps) {
  const { toast } = useToast();
  const [template, setTemplate] = useState<PrintTemplate | null>(null);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string>('');
  const [previewScale, setPreviewScale] = useState(() =>
    getInitialPreviewScale()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);
  const loadRequestIdRef = useRef(0);

  const loadPreview = useCallback(async () => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    setTemplate(null);
    setData(null);
    setError('');
    setIsLoading(true);

    try {
      const [templateResult, printData] = await Promise.all([
        fetchDefaultTemplate(templateType),
        fetchPrintDataForTemplate(templateType, documentId),
      ]);

      if (requestId !== loadRequestIdRef.current) return;

      if (!templateResult.success) {
        const msg = templateResult.error ?? '获取默认模板失败';
        setError(msg);
        toast({
          title: '加载失败',
          description: msg,
          variant: 'destructive',
        });
        return;
      }

      if (!templateResult.data) {
        const msg = '该单据类型未配置默认打印模板，请先在系统设置中配置。';
        setError(msg);
        toast({
          title: '模板未配置',
          description: msg,
          variant: 'destructive',
        });
        return;
      }

      if (!printData) {
        const msg = '未找到可打印的数据';
        setError(msg);
        toast({
          title: '数据加载失败',
          description: msg,
          variant: 'destructive',
        });
        return;
      }

      setTemplate(templateResult.data);
      setData(printData);
    } catch (error) {
      if (requestId !== loadRequestIdRef.current) return;

      const msg = error instanceof Error ? error.message : '加载打印数据失败';
      setError(msg);
      toast({
        title: '数据加载失败',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [documentId, templateType, toast]);

  // 加载：默认模板 + 单据数据
  useEffect(() => {
    if (!open) return;

    setPreviewScale(getInitialPreviewScale());
    void loadPreview();

    return () => {
      loadRequestIdRef.current += 1;
    };
  }, [loadPreview, open]);

  const handlePrint = async () => {
    if (!template || !data) return;
    if (!printRef.current) return;
    if (isPrinting) return;

    setIsPrinting(true);

    try {
      await printTemplateContent({
        template,
        content: printRef.current.innerHTML,
      });
    } catch (error) {
      toast({
        title: '打印失败',
        description:
          error instanceof Error ? error.message : '无法调起浏览器打印',
        variant: 'destructive',
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const dialogTitle =
    title ?? `打印预览：${typeLabels[templateType] ?? templateType}`;
  const isBusy = isLoading || isPrinting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!flex h-[92vh] w-[min(96vw,1280px)] max-w-none flex-col gap-0 overflow-hidden border-slate-200 p-0 sm:rounded-xl">
        <DialogHeader className="border-b bg-white px-4 py-3 pr-12 sm:pr-12 sm:pl-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <DialogTitle className="truncate text-base font-semibold text-slate-900">
                {dialogTitle}
              </DialogTitle>
              {template ? (
                <div className="mt-1 truncate text-xs text-slate-500">
                  默认模板：{template.name}
                </div>
              ) : null}
            </div>
            <DialogDescription className="sr-only">
              系统会套用当前业务类型的默认打印模板渲染预览，实际打印始终按 100%
              尺寸输出。
            </DialogDescription>

            <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => void loadPreview()}
                disabled={isBusy}
                title="重新加载"
                aria-label="重新加载"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
                />
              </Button>

              {/* 缩放仅影响预览，实际打印固定 100% */}
              <Select
                value={String(previewScale)}
                onValueChange={v => setPreviewScale(parseFloat(v))}
                disabled={isLoading}
              >
                <SelectTrigger className="h-9 w-24 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">50%</SelectItem>
                  <SelectItem value="0.75">75%</SelectItem>
                  <SelectItem value="1">100%</SelectItem>
                  <SelectItem value="1.25">125%</SelectItem>
                  <SelectItem value="1.5">150%</SelectItem>
                </SelectContent>
              </Select>

              <Button
                type="button"
                onClick={handlePrint}
                disabled={isBusy || !template || !data}
                className="min-w-24 flex-1 sm:flex-none"
              >
                {isBusy ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="mr-1.5 h-4 w-4" />
                )}
                {isPrinting ? '调起打印...' : '打印'}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-3 sm:p-6 lg:p-8">
          {error ? (
            <div className="flex h-full min-h-72 items-center justify-center">
              <div className="max-w-md rounded-lg border border-amber-200 bg-white px-6 py-5 text-center shadow-sm">
                <p className="text-sm font-medium text-slate-900">{error}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => void loadPreview()}
                  disabled={isLoading}
                >
                  重新加载
                </Button>
              </div>
            </div>
          ) : isLoading || !template || !data ? (
            <div className="flex h-full min-h-72 items-center justify-center">
              <div className="rounded-lg border border-slate-200 bg-white px-6 py-5 text-center shadow-sm">
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-600" />
                <p className="mt-3 text-sm text-slate-600">
                  正在加载打印预览...
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-center">
                <PrintCanvas
                  template={template}
                  data={data}
                  scale={previewScale}
                  showShadow
                />
              </div>

              {/* 真实打印内容（固定 100%，避免预览缩放影响打印尺寸） */}
              <div
                ref={printRef}
                aria-hidden
                data-testid="business-hidden-print-content"
                className="pointer-events-none fixed top-0 left-[-100000px] opacity-0"
              >
                <PrintCanvas template={template} data={data} scale={1} />
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
