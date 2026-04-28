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
import Link from 'next/link';
import * as React from 'react';

import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import {
  downloadSalesOrderImportTemplate,
  importSalesOrders,
  previewSalesOrderImport,
  salesOrderQueryKeys,
  type SalesOrderImportRequestOptions,
  type SalesOrderImportResult,
  type SalesOrderImportTargetStatus,
} from '@/lib/api/sales-orders';
import { showError, showSuccess, showWarning } from '@/lib/utils/toast-helper';
import { validateFileUpload } from '@/lib/validations/upload';

import { ConfirmDialog } from '../common/confirm-dialog';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

interface SalesOrderImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SalesOrderImportSummary({
  result,
}: {
  result: SalesOrderImportResult | null;
}) {
  if (!result) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-7">
      <div className="rounded-lg border p-3">
        <div className="text-muted-foreground text-xs">总行数</div>
        <div className="text-lg font-semibold">{result.totalRowCount}</div>
      </div>
      <div className="rounded-lg border p-3">
        <div className="text-muted-foreground text-xs">总订单</div>
        <div className="text-lg font-semibold">{result.totalOrderCount}</div>
      </div>
      <div className="rounded-lg border p-3">
        <div className="text-muted-foreground text-xs">可导入订单</div>
        <div className="text-lg font-semibold text-emerald-600">
          {result.validOrderCount}
        </div>
      </div>
      <div className="rounded-lg border p-3">
        <div className="text-muted-foreground text-xs">待建客户</div>
        <div className="text-lg font-semibold text-sky-600">
          {result.autoCreateCustomerNames.length}
        </div>
      </div>
      <div className="rounded-lg border p-3">
        <div className="text-muted-foreground text-xs">重复订单</div>
        <div className="text-lg font-semibold text-amber-600">
          {result.duplicateOrderCount}
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

function SalesOrderImportPreviewTable({
  result,
}: {
  result: SalesOrderImportResult | null;
}) {
  if (!result || result.previewRows.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">预览明细</div>
      <div className="max-h-64 overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>行号</TableHead>
              <TableHead>导入单号</TableHead>
              <TableHead>客户</TableHead>
              <TableHead>产品编码</TableHead>
              <TableHead>产品名称</TableHead>
              <TableHead>规格</TableHead>
              <TableHead>单位</TableHead>
              <TableHead>录入数量</TableHead>
              <TableHead>片数</TableHead>
              <TableHead>单价</TableHead>
              <TableHead>小计</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.previewRows.map(row => (
              <TableRow
                key={`${row.row}-${row.importOrderNo}-${row.productCode}`}
              >
                <TableCell>{row.row}</TableCell>
                <TableCell>{row.importOrderNo}</TableCell>
                <TableCell>{row.customerName}</TableCell>
                <TableCell>{row.productCode}</TableCell>
                <TableCell>{row.productName}</TableCell>
                <TableCell>{row.specification || '-'}</TableCell>
                <TableCell>{row.displayUnit}</TableCell>
                <TableCell>{row.displayQuantity}</TableCell>
                <TableCell>{row.quantity}</TableCell>
                <TableCell>{row.unitPrice}</TableCell>
                <TableCell>{row.subtotal.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SalesOrderImportDuplicateTable({
  result,
}: {
  result: SalesOrderImportResult | null;
}) {
  if (!result || result.duplicates.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-amber-700">重复订单</div>
      <div className="max-h-56 overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>行号</TableHead>
              <TableHead>导入单号</TableHead>
              <TableHead>已有订单号</TableHead>
              <TableHead>说明</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.duplicates.map(item => (
              <TableRow key={`${item.importOrderNo}-${item.row}`}>
                <TableCell>{item.row}</TableCell>
                <TableCell>{item.importOrderNo}</TableCell>
                <TableCell>{item.existingOrderNumber || '-'}</TableCell>
                <TableCell className="text-amber-700">{item.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SalesOrderImportErrorTable({
  result,
}: {
  result: SalesOrderImportResult | null;
}) {
  if (!result || result.errors.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-rose-700">错误明细</div>
      <div className="max-h-56 overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>行号</TableHead>
              <TableHead>导入单号</TableHead>
              <TableHead>产品编码</TableHead>
              <TableHead>对应列</TableHead>
              <TableHead>错误原因</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.errors.map((error, index) => (
              <TableRow
                key={`${error.row}-${error.field ?? 'unknown'}-${index}`}
              >
                <TableCell>{error.row}</TableCell>
                <TableCell>{error.importOrderNo || '-'}</TableCell>
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

function ImportedSalesOrdersTable({
  result,
}: {
  result: SalesOrderImportResult | null;
}) {
  if (!result?.importedOrders?.length) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-emerald-700">已导入订单</div>
      <div className="max-h-56 overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>订单号</TableHead>
              <TableHead>导入单号</TableHead>
              <TableHead>客户</TableHead>
              <TableHead>金额</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.importedOrders.map(order => (
              <TableRow key={order.id}>
                <TableCell>
                  <Link
                    href={`/sales-orders/${order.id}`}
                    className="text-primary hover:underline"
                  >
                    {order.orderNumber}
                  </Link>
                </TableCell>
                <TableCell>{order.importOrderNo}</TableCell>
                <TableCell>{order.customerName}</TableCell>
                <TableCell>{order.totalAmount.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function SalesOrderImportDialog({
  open,
  onOpenChange,
}: SalesOrderImportDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [result, setResult] = React.useState<SalesOrderImportResult | null>(
    null
  );
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [targetStatus, setTargetStatus] =
    React.useState<SalesOrderImportTargetStatus>('confirmed');
  const [shippedDate, setShippedDate] = React.useState('');

  const previewMutation = useMutation({
    mutationFn: ({
      file,
      options,
    }: {
      file: File;
      options: SalesOrderImportRequestOptions;
    }) => previewSalesOrderImport(file, options),
    onSuccess: (previewResult, variables) => {
      setResult(previewResult);
      const targetLabel =
        variables.options.targetStatus === 'shipped'
          ? '已发货销售订单'
          : '已确认未发货销售订单';
      const customerHint =
        previewResult.autoCreateCustomerNames.length > 0
          ? `，并新建 ${previewResult.autoCreateCustomerNames.length} 个客户资料`
          : '';

      if (!previewResult.valid) {
        showWarning('检查未通过', {
          description: `发现 ${previewResult.errorCount} 条问题，请修改后再试`,
        });
        return;
      }

      if (previewResult.duplicateOrderCount > 0) {
        showWarning('检查完成', {
          description: `可导入 ${previewResult.validOrderCount} 张${targetLabel}${customerHint}，重复的 ${previewResult.duplicateOrderCount} 张会自动跳过`,
        });
        return;
      }

      showSuccess('检查通过', {
        description: `共 ${previewResult.validOrderCount} 张${targetLabel}可以导入${customerHint}`,
      });
    },
    onError: error => {
      showError('检查失败', {
        description: error instanceof Error ? error.message : '请稍后再试',
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: ({
      file,
      options,
    }: {
      file: File;
      options: SalesOrderImportRequestOptions;
    }) => importSalesOrders(file, options),
    onSuccess: async (importResult, variables) => {
      setResult(importResult);
      await queryClient.invalidateQueries({
        queryKey: salesOrderQueryKeys.lists(),
      });
      const targetLabel =
        variables.options.targetStatus === 'shipped'
          ? '已发货销售订单'
          : '已确认未发货销售订单';
      const customerHint =
        importResult.autoCreateCustomerNames.length > 0
          ? `，新建 ${importResult.autoCreateCustomerNames.length} 个客户资料`
          : '';

      if ((importResult.importedCount ?? 0) > 0) {
        showSuccess('导入完成', {
          description: `成功导入 ${importResult.importedCount} 张${targetLabel}${customerHint}`,
        });
        return;
      }

      if (importResult.errorCount > 0) {
        showWarning('导入失败', {
          description: '这次导入没有保存，请先处理下方问题后再试',
        });
        return;
      }

      showWarning('没有成功导入的销售单', {
        description: '这次没有写入任何销售单，请检查重复记录或预览结果后再试',
      });
    },
    onError: error => {
      showError('导入失败', {
        description: error instanceof Error ? error.message : '请稍后再试',
      });
    },
  });

  const handleFileChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      if (!selectedFile) {
        return;
      }

      const validation = validateFileUpload(selectedFile, 'excel');
      if (!validation.success) {
        showError('文件不符合要求', {
          description: validation.error,
        });
        event.target.value = '';
        return;
      }

      setFile(selectedFile);
      setResult(null);
      setConfirmOpen(false);
    },
    []
  );

  const handleFileInputClick = React.useCallback(
    (event: React.MouseEvent<HTMLInputElement>) => {
      // 允许重新选择同一个文件名，避免修改后仍沿用旧文件对象。
      event.currentTarget.value = '';
    },
    []
  );

  const handleDownloadTemplate = React.useCallback(async () => {
    try {
      const { blob, filename } = await downloadSalesOrderImportTemplate();
      saveAs(blob, filename);
    } catch (error) {
      showError('下载模板失败', {
        description: error instanceof Error ? error.message : '请稍后再试',
      });
    }
  }, []);

  const handlePreview = React.useCallback(() => {
    if (!file) {
      showWarning('请先选择文件', {
        description: '请先上传 Excel 文件',
      });
      return;
    }

    previewMutation.mutate({
      file,
      options: {
        targetStatus,
        ...(shippedDate.trim() ? { shippedDate: shippedDate.trim() } : {}),
      },
    });
  }, [file, previewMutation, shippedDate, targetStatus]);

  const handleImport = React.useCallback(() => {
    if (!file) {
      showWarning('请先选择文件', {
        description: '请先上传 Excel 文件',
      });
      return;
    }

    setConfirmOpen(true);
  }, [file]);

  const handleConfirmImport = React.useCallback(async () => {
    if (!file) {
      throw new Error('没有找到导入文件，请重新选择');
    }

    await importMutation.mutateAsync({
      file,
      options: {
        targetStatus,
        ...(shippedDate.trim() ? { shippedDate: shippedDate.trim() } : {}),
      },
    });
  }, [file, importMutation, shippedDate, targetStatus]);

  const handleTargetStatusChange = React.useCallback(
    (value: SalesOrderImportTargetStatus) => {
      setTargetStatus(value);
      setResult(null);
      setConfirmOpen(false);
      previewMutation.reset();
      importMutation.reset();
    },
    [importMutation, previewMutation]
  );

  const handleShippedDateChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setShippedDate(event.target.value);
      setResult(null);
      setConfirmOpen(false);
      previewMutation.reset();
      importMutation.reset();
    },
    [importMutation, previewMutation]
  );

  const isBusy = previewMutation.isPending || importMutation.isPending;
  const hasImportedOrders =
    typeof result?.importedCount === 'number' && result.importedCount > 0;
  const hasUnsavedChanges =
    open &&
    !isBusy &&
    !hasImportedOrders &&
    (file !== null ||
      targetStatus !== 'confirmed' ||
      shippedDate.trim() !== '');
  const { confirmLeavePage } = useUnsavedChangesGuard({
    enabled: hasUnsavedChanges,
    message: '这次导入还没完成，确定要关闭吗？',
  });
  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && !confirmLeavePage()) {
        return;
      }

      onOpenChange(nextOpen);

      if (!nextOpen) {
        setFile(null);
        setResult(null);
        setConfirmOpen(false);
        setTargetStatus('confirmed');
        setShippedDate('');
        previewMutation.reset();
        importMutation.reset();
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [confirmLeavePage, importMutation, onOpenChange, previewMutation]
  );
  const canImport = Boolean(file && result?.valid && !importMutation.isPending);
  const autoCreateCustomerPreview =
    result?.autoCreateCustomerNames?.slice(0, 5).join('、') || '';
  const autoCreateCustomerOverflow =
    result && result.autoCreateCustomerNames.length > 5
      ? ` 等 ${result.autoCreateCustomerNames.length} 个客户`
      : '';
  const targetStatusLabel =
    targetStatus === 'shipped' ? '已发货销售订单' : '已确认未发货销售订单';
  const confirmDescription = result
    ? `将整批导入 ${result.validOrderCount} 张${targetStatusLabel}，进入正常销售列表和销售报表；${
        targetStatus === 'shipped'
          ? `导入成功后会直接生成出库记录并扣减库存${shippedDate.trim() ? `，统一发货日期为 ${shippedDate.trim()}` : '，未填写统一发货日期时默认跟随每张订单的订单日期'}。`
          : '导入成功后会先按已确认状态预留库存，后续再手工发货。'
      }只要其中任意一张导入失败，本次就不会保存任何订单。${
        result.autoCreateCustomerNames.length > 0
          ? `将自动创建客户资料：${autoCreateCustomerPreview}${autoCreateCustomerOverflow}。`
          : ''
      }${result.duplicateOrderCount > 0 ? `重复导入的 ${result.duplicateOrderCount} 张订单会自动跳过。` : ''}`
    : '';

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-sky-600" />
              批量导入销售单
            </DialogTitle>
            <DialogDescription>先检查，再导入。</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                客户和产品会按模板匹配；检查通过后才会正式保存。
              </AlertDescription>
            </Alert>

            <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-[minmax(0,220px)_minmax(0,220px)_1fr] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="sales-import-target-status">导入状态</Label>
                <Select
                  value={targetStatus}
                  onValueChange={value =>
                    handleTargetStatusChange(
                      value as SalesOrderImportTargetStatus
                    )
                  }
                  disabled={isBusy}
                >
                  <SelectTrigger id="sales-import-target-status">
                    <SelectValue placeholder="选择导入状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmed">已确认未发货</SelectItem>
                    <SelectItem value="shipped">已发货</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {targetStatus === 'shipped' ? (
                <div className="space-y-2">
                  <Label htmlFor="sales-import-shipped-date">
                    统一发货日期
                  </Label>
                  <Input
                    id="sales-import-shipped-date"
                    type="date"
                    value={shippedDate}
                    onChange={handleShippedDateChange}
                    disabled={isBusy}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">统一发货日期</Label>
                  <Input value="未发货模式下无需填写" disabled />
                </div>
              )}

              <div className="text-muted-foreground rounded-lg bg-slate-50 p-3 text-sm">
                {targetStatus === 'shipped'
                  ? `导入后直接标记为已发货并扣减库存。${shippedDate.trim() ? `本次统一发货日期将使用 ${shippedDate.trim()}。` : '若不填写统一发货日期，将默认跟随每张订单的订单日期。'}`
                  : '导入后先生成已确认未发货订单，只预留库存，后续再手工发货。'}
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onClick={handleFileInputClick}
                onChange={handleFileChange}
                disabled={isBusy}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleDownloadTemplate}
                disabled={isBusy}
              >
                <Download className="mr-2 h-4 w-4" />
                下载模板
              </Button>
              <Button
                variant="outline"
                onClick={handlePreview}
                disabled={!file || isBusy}
              >
                {previewMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                先检查
              </Button>
            </div>

            {file ? (
              <div className="text-muted-foreground text-sm">
                当前文件：{file.name}（{(file.size / 1024).toFixed(1)} KB）
              </div>
            ) : null}

            {result && result.autoCreateCustomerNames.length > 0 ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-sky-600" />
                <AlertDescription>
                  这次导入会新建 {result.autoCreateCustomerNames.length}{' '}
                  个客户资料：{autoCreateCustomerPreview}
                  {autoCreateCustomerOverflow}。客户电话和联系人可后续补录。
                </AlertDescription>
              </Alert>
            ) : null}

            <SalesOrderImportSummary result={result} />
            <SalesOrderImportPreviewTable result={result} />
            <SalesOrderImportDuplicateTable result={result} />
            <SalesOrderImportErrorTable result={result} />
            <ImportedSalesOrdersTable result={result} />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isBusy}
            >
              关闭
            </Button>
            <Button onClick={handleImport} disabled={!canImport}>
              {importMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              {targetStatus === 'shipped'
                ? '导入为已发货'
                : '导入为已确认未发货'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleConfirmImport}
        title="确认开始导入"
        description={confirmDescription}
        confirmText="确认导入"
        cancelText="返回检查"
        variant="warning"
        isLoading={importMutation.isPending}
      />
    </>
  );
}
