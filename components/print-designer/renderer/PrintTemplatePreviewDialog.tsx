/**
 * 打印设计器 - 业务侧打印预览对话框（默认模板）
 *
 * 目标：业务用户只需点“打印”，系统自动使用该类型的默认模板渲染并打印。
 */

'use client';

import { Loader2, Printer } from 'lucide-react';
import { useEffect, useRef, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
import {
  getDefaultTemplate,
  getPrintDataForTemplate,
} from '@/lib/print-designer/actions';
import type { PrintTemplate, TemplateType } from '@/lib/print-designer/schemas';

import { PrintCanvas } from './PrintCanvas';

const typeLabels: Record<TemplateType, string> = {
  'sales-order': '销售订单',
  'purchase-order': '采购订单',
  'factory-shipment': '厂家发货',
  'delivery-note': '发货单',
  'inbound-record': '仓库进货（入库记录）',
  'return-order': '退货订单',
  custom: '自定义',
};

function getCssPageSize(settings: PrintTemplate['pageSettings']): string {
  if (settings.size === 'Custom') {
    return `${settings.width}mm ${settings.height}mm`;
  }
  return `${settings.size} ${settings.orientation}`;
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
  const [previewScale, setPreviewScale] = useState(1);
  const [isPending, startTransition] = useTransition();

  const printRef = useRef<HTMLDivElement>(null);

  // 加载：默认模板 + 单据数据
  useEffect(() => {
    if (!open) return;

    setTemplate(null);
    setData(null);
    setError('');
    setPreviewScale(1);

    startTransition(async () => {
      const [templateResult, printData] = await Promise.all([
        getDefaultTemplate(templateType),
        getPrintDataForTemplate(templateType, documentId),
      ]);

      if (!templateResult.success) {
        const msg = templateResult.error ?? '获取默认模板失败';
        setError(msg);
        toast({ title: '加载失败', description: msg, variant: 'destructive' });
        return;
      }

      if (!templateResult.data) {
        const msg =
          '该单据类型未配置默认打印模板，请联系管理员在系统设置中配置。';
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
    });
  }, [open, templateType, documentId]);

  const handlePrint = () => {
    if (!template || !data) return;
    if (!printRef.current) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: '打印失败',
        description: '无法打开打印窗口，请检查浏览器拦截设置',
        variant: 'destructive',
      });
      return;
    }

    const content = printRef.current.innerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${template.name}</title>
          <style>
            @page {
              size: ${getCssPageSize(template.pageSettings)};
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const dialogTitle =
    title ?? `打印预览：${typeLabels[templateType] ?? templateType}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden">
        <DialogHeader className="flex flex-row items-center justify-between border-b pb-3">
          <DialogTitle className="flex items-center gap-2">
            {dialogTitle}
          </DialogTitle>

          <div className="flex items-center gap-2">
            {/* 缩放仅影响预览，实际打印固定 100% */}
            <Select
              value={String(previewScale)}
              onValueChange={v => setPreviewScale(parseFloat(v))}
              disabled={isPending}
            >
              <SelectTrigger className="h-8 w-24">
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
              onClick={handlePrint}
              disabled={isPending || !template || !data}
            >
              {isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Printer className="mr-1.5 h-4 w-4" />
              )}
              打印
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-slate-100 p-8">
          {error ? (
            <div className="flex h-64 items-center justify-center">
              <p className="text-muted-foreground text-sm">{error}</p>
            </div>
          ) : !template || !data ? (
            <div className="flex h-64 items-center justify-center">
              <p className="text-muted-foreground text-sm">加载中...</p>
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
