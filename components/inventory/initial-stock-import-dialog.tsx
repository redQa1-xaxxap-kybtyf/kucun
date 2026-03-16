'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { saveAs } from 'file-saver';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  PackageSearch,
  Upload,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  downloadInitialStockImportTemplate,
  importInitialStock,
  previewInitialStockImport,
  type InitialStockImportResult,
} from '@/lib/api/initial-stock';
import { queryKeys } from '@/lib/queryKeys';
import { showError, showSuccess, showWarning } from '@/lib/utils/toast-helper';
import { validateFileUpload } from '@/lib/validations/upload';

interface InitialStockImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function InitialStockImportSummary({
  result,
}: {
  result: InitialStockImportResult | null;
}) {
  if (!result) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
        <div className="text-xs text-slate-500">总行数</div>
        <div className="text-lg font-semibold text-slate-900">
          {result.totalCount}
        </div>
      </div>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3">
        <div className="text-xs text-emerald-700">可导入</div>
        <div className="text-lg font-semibold text-emerald-700">
          {result.validCount}
        </div>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3">
        <div className="text-xs text-amber-700">跳过行</div>
        <div className="text-lg font-semibold text-amber-700">
          {result.duplicateCount}
        </div>
      </div>
      <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3">
        <div className="text-xs text-rose-700">错误行</div>
        <div className="text-lg font-semibold text-rose-700">
          {result.errorCount}
        </div>
      </div>
      <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3">
        <div className="text-xs text-blue-700">实际导入</div>
        <div className="text-lg font-semibold text-blue-700">
          {result.importedCount ?? '--'}
        </div>
      </div>
    </div>
  );
}

function InitialStockPreviewTable({
  result,
}: {
  result: InitialStockImportResult | null;
}) {
  if (!result || result.previewRows.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-slate-900">可导入明细</div>
      <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>行号</TableHead>
              <TableHead>产品编码</TableHead>
              <TableHead>产品名称</TableHead>
              <TableHead>规格</TableHead>
              <TableHead>色号</TableHead>
              <TableHead>批次号</TableHead>
              <TableHead>数量</TableHead>
              <TableHead>单位成本</TableHead>
              <TableHead>库位</TableHead>
              <TableHead>匹配方式</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.previewRows.map(row => (
              <TableRow
                key={`${row.row}-${row.productCode}-${row.batchNumber}-${row.colorCode ?? 'default'}`}
              >
                <TableCell>{row.row}</TableCell>
                <TableCell>{row.productCode}</TableCell>
                <TableCell>{row.productName}</TableCell>
                <TableCell>{row.specification || '-'}</TableCell>
                <TableCell>{row.colorCode || '-'}</TableCell>
                <TableCell>{row.batchNumber}</TableCell>
                <TableCell>{row.quantity}</TableCell>
                <TableCell>{row.unitCost}</TableCell>
                <TableCell>{row.location || '-'}</TableCell>
                <TableCell>{row.matchMethod}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function getDuplicateSourceLabel(
  source: InitialStockImportResult['duplicates'][number]['source']
) {
  switch (source) {
    case 'file':
      return '文件内重复';
    case 'opening_balance':
      return '已有期初库存';
    case 'inventory':
      return '已有库存';
    case 'business_inbound':
      return '已有业务入库';
    default:
      return '系统跳过';
  }
}

function InitialStockDuplicateTable({
  result,
}: {
  result: InitialStockImportResult | null;
}) {
  if (!result || result.duplicates.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-amber-700">跳过明细</div>
      <div className="max-h-64 overflow-auto rounded-xl border border-amber-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>行号</TableHead>
              <TableHead>产品编码</TableHead>
              <TableHead>批次号</TableHead>
              <TableHead>来源</TableHead>
              <TableHead>说明</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.duplicates.map(item => (
              <TableRow
                key={`${item.row}-${item.productCode ?? 'no-code'}-${item.batchNumber ?? 'no-batch'}-${item.source}`}
              >
                <TableCell>{item.row}</TableCell>
                <TableCell>{item.productCode || '-'}</TableCell>
                <TableCell>{item.batchNumber || '-'}</TableCell>
                <TableCell>{getDuplicateSourceLabel(item.source)}</TableCell>
                <TableCell className="text-amber-700">{item.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function InitialStockErrorTable({
  result,
}: {
  result: InitialStockImportResult | null;
}) {
  if (!result || result.errors.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-rose-700">错误明细</div>
      <div className="max-h-64 overflow-auto rounded-xl border border-rose-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>行号</TableHead>
              <TableHead>产品编码</TableHead>
              <TableHead>字段</TableHead>
              <TableHead>错误原因</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.errors.map(error => (
              <TableRow
                key={`${error.row}-${error.field ?? 'unknown'}-${error.message}`}
              >
                <TableCell>{error.row}</TableCell>
                <TableCell>{error.productCode || '-'}</TableCell>
                <TableCell>{error.field || '-'}</TableCell>
                <TableCell className="text-rose-700">{error.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function InitialStockImportDialog({
  open,
  onOpenChange,
}: InitialStockImportDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [result, setResult] = React.useState<InitialStockImportResult | null>(
    null
  );

  function resetDialogState() {
    setFile(null);
    setResult(null);
    previewMutation.reset();
    importMutation.reset();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  const redirectToInventory = React.useCallback(() => {
    resetDialogState();
    onOpenChange(false);
    router.push(`/inventory?hasStock=true&refresh=${Date.now()}`);
  }, [onOpenChange, router]);

  const previewMutation = useMutation({
    mutationFn: previewInitialStockImport,
    onSuccess: previewResult => {
      setResult(previewResult);

      if (!previewResult.canImport) {
        showWarning('预校验完成', {
          description: '没有可导入的数据，请根据错误明细修正后重试',
        });
        return;
      }

      if (previewResult.duplicateCount > 0 || previewResult.errorCount > 0) {
        showWarning('预校验完成', {
          description: `可导入 ${previewResult.validCount} 条，跳过 ${previewResult.duplicateCount} 条，错误 ${previewResult.errorCount} 条`,
        });
        return;
      }

      showSuccess('预校验通过', {
        description: `共 ${previewResult.validCount} 条数据可导入`,
      });
    },
    onError: error => {
      showError('预校验失败', {
        description: error instanceof Error ? error.message : '请稍后重试',
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: importInitialStock,
    onSuccess: async importResult => {
      setResult(importResult);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      ]);
      queryClient.removeQueries({ queryKey: queryKeys.inventory.all });

      if ((importResult.importedCount ?? 0) === 0) {
        showWarning('导入未完成', {
          description: '没有成功导入的数据，请检查跳过和错误明细',
        });
        return;
      }

      if (importResult.duplicateCount > 0 || importResult.errorCount > 0) {
        showWarning('导入已完成', {
          description: `成功导入 ${importResult.importedCount ?? 0} 条并已直接写入库存，跳过 ${importResult.duplicateCount} 条，错误 ${importResult.errorCount} 条`,
        });
        return;
      }

      showSuccess('导入成功', {
        description: `成功导入 ${importResult.importedCount ?? 0} 条期初库存，并已直接写入库存`,
      });
      redirectToInventory();
    },
    onError: error => {
      showError('导入失败', {
        description: error instanceof Error ? error.message : '请稍后重试',
      });
    },
  });

  const isBusy = previewMutation.isPending || importMutation.isPending;

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (isBusy) {
      return;
    }

    if (!nextOpen) {
      resetDialogState();
    }

    onOpenChange(nextOpen);
  };

  const handleDownloadTemplate = async (source: 'blank' | 'products') => {
    try {
      const template = await downloadInitialStockImportTemplate(source);
      saveAs(template.blob, template.filename);
    } catch (error) {
      showError('下载模板失败', {
        description: error instanceof Error ? error.message : '请稍后重试',
      });
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setResult(null);
    previewMutation.reset();
    importMutation.reset();

    if (!nextFile) {
      setFile(null);
      return;
    }

    const validation = validateFileUpload(nextFile, 'excel');
    if (!validation.success) {
      setFile(null);
      showError('文件不可用', {
        description: validation.error,
      });
      event.target.value = '';
      return;
    }

    setFile(nextFile);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto rounded-2xl border-0 bg-white p-0 shadow-2xl">
        <DialogHeader className="border-b border-slate-200 bg-slate-50/80 px-6 py-5">
          <DialogTitle className="text-xl font-bold text-slate-900">
            期初库存批量导入
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            正式导入只会导入产品库中已存在且通过校验的产品。建议优先下载产品库模板，直接填写批次、数量、单位成本和库位。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <Alert className="border-blue-200 bg-blue-50/80 text-blue-900">
            <PackageSearch className="h-4 w-4" />
            <AlertDescription className="leading-6">
              推荐流程：先点“导出产品库模板”，系统会自动带出产品编码、名称、规格、色号；上传后先做预校验，再正式导入。一行只表示一个“产品编码
              + 色号 +
              批次”组合，同编号多个色号或多个批次请拆成多行。遇到重复批次、已有库存或错误行时，系统会自动跳过并给出明细。
            </AlertDescription>
          </Alert>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <div className="text-sm font-medium text-slate-900">
                  导入文件
                </div>
                <div className="text-sm text-slate-500">
                  {file ? file.name : '尚未选择文件'}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-slate-200"
                  onClick={() => handleDownloadTemplate('blank')}
                  disabled={isBusy}
                >
                  <Download className="mr-2 h-4 w-4" />
                  下载空白模板
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  onClick={() => handleDownloadTemplate('products')}
                  disabled={isBusy}
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  导出产品库模板
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-slate-200"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isBusy}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  选择文件
                </Button>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          </div>

          <InitialStockImportSummary result={result} />

          {result && (
            <Alert
              variant={result.canImport ? 'default' : 'destructive'}
              className={
                result.canImport
                  ? 'border-emerald-200 bg-emerald-50/80'
                  : 'border-rose-200 bg-rose-50/80'
              }
            >
              {result.canImport ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                {typeof result.importedCount === 'number' &&
                result.importedCount > 0
                  ? result.duplicateCount > 0 || result.errorCount > 0
                    ? '已成功导入的行已经直接写入库存，无需审核；您可以先看明细，再决定是否跳转到库存页。'
                    : '导入完成，成功导入的行已经直接写入库存，无需审核。'
                  : result.canImport
                    ? result.duplicateCount > 0 || result.errorCount > 0
                      ? '正式导入时只会导入通过校验的行，跳过行和错误行都会保留明细。'
                      : '预校验通过，可以直接执行正式导入。'
                    : '当前没有可导入数据，请根据错误明细修正后再重试。'}
              </AlertDescription>
            </Alert>
          )}

          <InitialStockPreviewTable result={result} />
          <InitialStockDuplicateTable result={result} />
          <InitialStockErrorTable result={result} />
        </div>

        <DialogFooter className="border-t border-slate-200 bg-slate-50/80 px-6 py-4">
          {typeof result?.importedCount === 'number' &&
          result.importedCount > 0 ? (
            <Button
              type="button"
              variant="outline"
              className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
              onClick={redirectToInventory}
              disabled={isBusy}
            >
              查看库存
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => handleDialogOpenChange(false)}
            disabled={isBusy}
          >
            取消
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-slate-200"
            onClick={() => file && previewMutation.mutate(file)}
            disabled={!file || isBusy}
          >
            {previewMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            预校验
          </Button>
          <Button
            type="button"
            className="bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => file && importMutation.mutate(file)}
            disabled={!file || !result?.canImport || isBusy}
          >
            {importMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            导入通过行
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
