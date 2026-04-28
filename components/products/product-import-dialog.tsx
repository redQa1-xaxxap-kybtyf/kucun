'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { saveAs } from 'file-saver';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react';
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
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import {
  downloadProductImportTemplate,
  importProducts,
  previewProductImport,
  productQueryKeys,
  type ProductImportResult,
} from '@/lib/api/products';
import { showError, showSuccess, showWarning } from '@/lib/utils/toast-helper';
import { validateFileUpload } from '@/lib/validations/upload';

interface ProductImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ProductImportSummary({
  result,
}: {
  result: ProductImportResult | null;
}) {
  if (!result) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <div className="rounded-lg border p-3">
        <div className="text-muted-foreground text-xs">总行数</div>
        <div className="text-lg font-semibold">{result.totalCount}</div>
      </div>
      <div className="rounded-lg border p-3">
        <div className="text-muted-foreground text-xs">可导入</div>
        <div className="text-lg font-semibold text-emerald-600">
          {result.validCount}
        </div>
      </div>
      <div className="rounded-lg border p-3">
        <div className="text-muted-foreground text-xs">重复数</div>
        <div className="text-lg font-semibold text-amber-600">
          {result.duplicateCount}
        </div>
      </div>
      <div className="rounded-lg border p-3">
        <div className="text-muted-foreground text-xs">错误数</div>
        <div className="text-lg font-semibold text-rose-600">
          {result.errorCount}
        </div>
      </div>
      <div className="rounded-lg border p-3">
        <div className="text-muted-foreground text-xs">实际导入</div>
        <div className="text-lg font-semibold">
          {result.importedCount ?? '--'}
        </div>
      </div>
    </div>
  );
}

function ProductImportPreviewTable({
  result,
}: {
  result: ProductImportResult | null;
}) {
  if (!result || result.previewRows.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">预览数据</div>
      <div className="max-h-56 overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>行号</TableHead>
              <TableHead>编码</TableHead>
              <TableHead>名称</TableHead>
              <TableHead>规格</TableHead>
              <TableHead>分类</TableHead>
              <TableHead>状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.previewRows.map(row => (
              <TableRow key={`${row.row}-${row.code}`}>
                <TableCell>{row.row}</TableCell>
                <TableCell>{row.code}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.specification}</TableCell>
                <TableCell>{row.categoryName}</TableCell>
                <TableCell>
                  {row.status === 'active' ? '启用' : '停用'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ProductImportDuplicateTable({
  result,
}: {
  result: ProductImportResult | null;
}) {
  if (!result || result.duplicates.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-amber-600">重复明细</div>
      <div className="max-h-56 overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>行号</TableHead>
              <TableHead>产品编码</TableHead>
              <TableHead>来源</TableHead>
              <TableHead>说明</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.duplicates.map(duplicate => (
              <TableRow
                key={`${duplicate.row}-${duplicate.productCode}-${duplicate.source}`}
              >
                <TableCell>{duplicate.row}</TableCell>
                <TableCell>{duplicate.productCode || '-'}</TableCell>
                <TableCell>
                  {duplicate.source === 'system' ? '系统已有' : '文件内重复'}
                </TableCell>
                <TableCell className="text-amber-700">
                  {duplicate.message}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ProductImportErrorTable({
  result,
}: {
  result: ProductImportResult | null;
}) {
  if (!result || result.errors.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-rose-600">错误明细</div>
      <div className="max-h-56 overflow-auto rounded-lg border">
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
              <TableRow key={`${error.row}-${error.field}-${error.message}`}>
                <TableCell>{error.row}</TableCell>
                <TableCell>{error.productCode || '-'}</TableCell>
                <TableCell>{error.field || '-'}</TableCell>
                <TableCell className="text-rose-600">{error.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function ProductImportDialog({
  open,
  onOpenChange,
}: ProductImportDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [result, setResult] = React.useState<ProductImportResult | null>(null);

  const previewMutation = useMutation({
    mutationFn: previewProductImport,
    onSuccess: previewResult => {
      setResult(previewResult);
      if (!previewResult.valid) {
        showWarning('导入检查发现问题', {
          description: `共 ${previewResult.errorCount} 条错误，请修正后重试`,
        });
        return;
      }

      if (previewResult.duplicateCount > 0) {
        showWarning('导入检查完成', {
          description: `可导入 ${previewResult.validCount} 条，重复编码 ${previewResult.duplicateCount} 条将自动跳过`,
        });
      } else {
        showSuccess('导入检查通过', {
          description: `共 ${previewResult.validCount} 条数据可导入`,
        });
      }
    },
    onError: error => {
      showError('导入检查失败', {
        description: error instanceof Error ? error.message : '请稍后重试',
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: importProducts,
    onSuccess: async importResult => {
      setResult(importResult);

      if (!importResult.valid) {
        showWarning('导入未执行', {
          description: '文件存在错误，请修正后重新检查',
        });
        return;
      }

      await queryClient.removeQueries({
        queryKey: productQueryKeys.lists(),
      });
      await queryClient.refetchQueries({
        queryKey: productQueryKeys.all,
        type: 'active',
      });

      if (importResult.duplicateCount > 0) {
        showWarning('导入已完成', {
          description: `成功导入 ${importResult.importedCount ?? 0} 个产品，跳过 ${importResult.duplicateCount} 个重复编码`,
        });
        return;
      }

      showSuccess('导入成功', {
        description: `成功导入 ${importResult.importedCount ?? 0} 个产品`,
      });
      resetDialogState();
      onOpenChange(false);
    },
    onError: error => {
      showError('导入失败', {
        description: error instanceof Error ? error.message : '请稍后重试',
      });
    },
  });

  const isBusy = previewMutation.isPending || importMutation.isPending;
  const hasUnsavedChanges =
    open && !isBusy && (file !== null || result !== null);
  const { confirmLeavePage } = useUnsavedChangesGuard({
    enabled: hasUnsavedChanges,
    message: '当前导入内容尚未完成，确定要关闭吗？',
  });

  function resetDialogState() {
    setFile(null);
    setResult(null);
    previewMutation.reset();
    importMutation.reset();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (isBusy) {
      return;
    }

    if (!nextOpen) {
      if (!confirmLeavePage()) {
        return;
      }
      resetDialogState();
    }

    onOpenChange(nextOpen);
  };

  const handleDownloadTemplate = async () => {
    try {
      const template = await downloadProductImportTemplate();
      saveAs(template.blob, template.filename);
    } catch (error) {
      showError('下载模板失败', {
        description: error instanceof Error ? error.message : '请稍后重试',
      });
    }
  };

  const handleSelectFile = React.useCallback(() => {
    if (isBusy) {
      return;
    }

    // 允许重新选择同一个文件名，避免修改后仍复用旧文件对象。
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }, [isBusy]);

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
    event.target.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>批量导入产品基础信息</DialogTitle>
          <DialogDescription>先下载模板，检查通过后导入。</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertDescription>
              产品分类可直接从模板里的“分类参考”复制。
            </AlertDescription>
          </Alert>

          <div className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium">导入文件</div>
              <div className="text-muted-foreground text-sm">
                {file ? file.name : '尚未选择文件'}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadTemplate}
                disabled={isBusy}
              >
                <Download className="mr-2 h-4 w-4" />
                下载模板
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleSelectFile}
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

          <ProductImportSummary result={result} />

          {result && (
            <Alert variant={result.valid ? 'default' : 'destructive'}>
              {result.valid ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                {result.valid
                  ? result.duplicateCount > 0
                    ? '存在重复编码，正式导入时会自动跳过这些重复项。'
                    : '导入检查通过，可以执行正式导入。'
                  : '存在错误，导入不会执行，请先修正文件。'}
              </AlertDescription>
            </Alert>
          )}

          <ProductImportPreviewTable result={result} />
          <ProductImportDuplicateTable result={result} />
          <ProductImportErrorTable result={result} />
        </div>

        <DialogFooter>
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
            onClick={() => file && previewMutation.mutate(file)}
            disabled={!file || isBusy}
          >
            {previewMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            导入检查
          </Button>
          <Button
            type="button"
            onClick={() => file && importMutation.mutate(file)}
            disabled={!file || !result?.valid || isBusy}
          >
            {importMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            确认导入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
