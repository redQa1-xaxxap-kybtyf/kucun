/**
 * 打印设计器 - 预览对话框
 *
 * 支持模拟数据和真实业务单据预览，打印始终使用 100% 尺寸。
 */

'use client';

import { Eye, Loader2, Printer, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { Badge } from '@/components/ui/badge';
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
import {
  fetchPrintDataForTemplate,
  fetchRecentDocumentsForTemplate,
  type RecentPrintDocumentOption,
} from '@/lib/print-designer/preview-data-client';
import { getMockPrintData } from '@/lib/print-designer/preview-mock-data';
import type { PrintTemplate } from '@/lib/print-designer/schemas';
import {
  getTemplateTypeMeta,
  getTemplateTypeLabel,
} from '@/lib/print-designer/template-meta';

import { PrintCanvas } from '../../renderer';

interface PreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: PrintTemplate;
}

type PreviewSource = 'mock' | 'real';

function getCssPageSize(settings: PrintTemplate['pageSettings']): string {
  if (settings.size === 'Custom') {
    return `${settings.width}mm ${settings.height}mm`;
  }
  return `${settings.size} ${settings.orientation}`;
}

export function PreviewDialog({
  open,
  onOpenChange,
  template,
}: PreviewDialogProps) {
  const templateMeta = getTemplateTypeMeta(template.type);
  const supportsRealPreview = templateMeta?.supportsRealPreview ?? false;

  const [scale, setScale] = useState(1);
  const [dataSource, setDataSource] = useState<PreviewSource>('mock');
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [recentDocuments, setRecentDocuments] = useState<
    RecentPrintDocumentOption[]
  >([]);
  const [previewData, setPreviewData] = useState<Record<string, unknown>>(
    getMockPrintData(template.type)
  );
  const [loadingText, setLoadingText] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const printRef = useRef<HTMLDivElement>(null);

  const selectedDocument = useMemo(
    () => recentDocuments.find(item => item.id === selectedDocumentId) ?? null,
    [recentDocuments, selectedDocumentId]
  );

  useEffect(() => {
    if (!open) return;

    setScale(1);
    setError('');
    setLoadingText('');
    setRecentDocuments([]);
    setSelectedDocumentId('');
    setDataSource('mock');
    setPreviewData(getMockPrintData(template.type));
  }, [open, template.type]);

  useEffect(() => {
    if (!open) return;
    if (dataSource !== 'real' || !supportsRealPreview) {
      setPreviewData(getMockPrintData(template.type));
      setError('');
      setLoadingText('');
      return;
    }

    setLoadingText(
      `正在加载${templateMeta?.recentDocumentLabel ?? '最近单据'}...`
    );
    setError('');

    startTransition(async () => {
      try {
        const documents = await fetchRecentDocumentsForTemplate(
          template.type,
          20
        );
        setRecentDocuments(documents);
        setLoadingText('');

        if (documents.length === 0) {
          setError(
            `暂无可用于预览的${templateMeta?.realDataLabel ?? '真实单据'}`
          );
          return;
        }

        setSelectedDocumentId(currentId => currentId || documents[0].id);
      } catch (error) {
        setLoadingText('');
        setError(
          error instanceof Error ? error.message : '加载真实单据列表失败'
        );
      }
    });
  }, [
    dataSource,
    open,
    supportsRealPreview,
    template.type,
    templateMeta?.realDataLabel,
    templateMeta?.recentDocumentLabel,
  ]);

  useEffect(() => {
    if (!open) return;
    if (dataSource !== 'real' || !selectedDocumentId || !supportsRealPreview) {
      return;
    }

    setLoadingText(`正在加载${templateMeta?.realDataLabel ?? '真实单据'}...`);
    setError('');

    startTransition(async () => {
      try {
        const data = await fetchPrintDataForTemplate(
          template.type,
          selectedDocumentId
        );
        if (!data) {
          setError('未找到可用于预览的数据，请更换单据再试。');
          setLoadingText('');
          return;
        }

        setPreviewData(data);
        setLoadingText('');
      } catch (error) {
        setError(error instanceof Error ? error.message : '加载真实单据失败');
        setLoadingText('');
      }
    });
  }, [
    dataSource,
    open,
    selectedDocumentId,
    supportsRealPreview,
    template.type,
    templateMeta?.realDataLabel,
  ]);

  const handlePrint = () => {
    if (!printRef.current) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

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

  const handleRefresh = () => {
    if (dataSource === 'mock') {
      setPreviewData(getMockPrintData(template.type));
      return;
    }

    if (!selectedDocumentId || !supportsRealPreview) return;

    setLoadingText(`正在刷新${templateMeta?.realDataLabel ?? '真实单据'}...`);

    startTransition(async () => {
      try {
        const data = await fetchPrintDataForTemplate(
          template.type,
          selectedDocumentId
        );
        if (!data) {
          setError('刷新失败，请确认单据仍存在。');
          setLoadingText('');
          return;
        }

        setPreviewData(data);
        setError('');
        setLoadingText('');
      } catch (error) {
        setError(
          error instanceof Error ? error.message : '刷新失败，请稍后再试。'
        );
        setLoadingText('');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden border-stone-200 p-0">
        <DialogHeader className="border-b bg-gradient-to-r from-stone-50 via-white to-stone-50 px-6 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-base text-slate-900">
                <Eye className="h-5 w-5 text-stone-700" />
                预览：{template.name}
              </DialogTitle>
              <DialogDescription className="sr-only">
                检查模板版式、内容显示和打印尺寸，打印时始终按 100%
                实际尺寸输出。
              </DialogDescription>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Badge variant="secondary">
                  {getTemplateTypeLabel(template.type)}
                </Badge>
                <span>
                  {templateMeta?.description ?? '检查版式、数据项和分页效果'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full border border-stone-200 bg-stone-100 p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={dataSource === 'mock' ? 'default' : 'ghost'}
                  className="rounded-full"
                  onClick={() => setDataSource('mock')}
                >
                  模拟数据
                </Button>
                {supportsRealPreview ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={dataSource === 'real' ? 'default' : 'ghost'}
                    className="rounded-full"
                    onClick={() => setDataSource('real')}
                  >
                    {templateMeta?.realDataLabel ?? '真实单据'}
                  </Button>
                ) : null}
              </div>

              {supportsRealPreview && dataSource === 'real' ? (
                <Select
                  value={selectedDocumentId}
                  onValueChange={setSelectedDocumentId}
                  disabled={isPending || recentDocuments.length === 0}
                >
                  <SelectTrigger className="h-9 w-52 bg-white">
                    <SelectValue
                      placeholder={`选择${templateMeta?.realDataLabel ?? '单据'}`}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {recentDocuments.map(document => (
                      <SelectItem key={document.id} value={document.id}>
                        {document.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={handleRefresh}
                disabled={isPending}
                title="刷新预览数据"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`}
                />
              </Button>

              <Select
                value={String(scale)}
                onValueChange={value => setScale(parseFloat(value))}
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
                onClick={handlePrint}
                disabled={Boolean(loadingText) || Boolean(error)}
              >
                {isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="mr-1.5 h-4 w-4" />
                )}
                打印
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="border-b bg-stone-50 px-6 py-3 text-xs text-slate-600">
          {supportsRealPreview && dataSource === 'real' ? (
            selectedDocument ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-medium text-slate-900">
                  当前单据：{selectedDocument.label}
                </span>
                <span>{selectedDocument.secondary}</span>
                <span>{selectedDocument.description}</span>
              </div>
            ) : (
              <span>
                {loadingText ||
                  `请选择${templateMeta?.realDataLabel ?? '真实单据'}`}
              </span>
            )
          ) : (
            <span>
              使用模拟数据预览版式。打印时仍按 100%
              实际尺寸输出，不受当前缩放影响。
            </span>
          )}
        </div>

        <div className="flex-1 overflow-auto bg-[#efe7dc] p-8">
          {error ? (
            <div className="flex h-72 items-center justify-center">
              <div className="rounded-2xl border border-amber-200 bg-white px-6 py-5 text-center shadow-sm">
                <p className="text-sm font-medium text-slate-900">{error}</p>
                {!supportsRealPreview ? (
                  <p className="mt-2 text-xs text-slate-500">
                    当前模板类型更适合先用模拟数据定版。
                  </p>
                ) : null}
              </div>
            </div>
          ) : loadingText ? (
            <div className="flex h-72 items-center justify-center">
              <div className="rounded-2xl border border-stone-200 bg-white px-6 py-5 text-center shadow-sm">
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-stone-600" />
                <p className="mt-3 text-sm text-slate-600">{loadingText}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-center">
                <PrintCanvas
                  template={template}
                  data={previewData}
                  scale={scale}
                  showShadow
                />
              </div>

              <div
                ref={printRef}
                aria-hidden
                data-testid="hidden-print-content"
                className="pointer-events-none fixed top-0 left-[-100000px] opacity-0"
              >
                <PrintCanvas template={template} data={previewData} scale={1} />
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
