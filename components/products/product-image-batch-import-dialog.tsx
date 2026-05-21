'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileImage,
  FolderOpen,
  ImagePlus,
  Loader2,
  Play,
  RefreshCw,
} from 'lucide-react';
import * as React from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { Progress } from '@/components/ui/progress';
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
  matchProductImagesForImport,
  productQueryKeys,
  saveProductImagesForImport,
  type ProductImageImportSaveInput,
  type ProductImageImportKind,
  type ProductImageImportMatchInput,
  type ProductImageImportMatchResult,
} from '@/lib/api/products';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';
import { getErrorMessage } from '@/lib/utils/error-handler';
import { dedupeProductImages } from '@/lib/utils/product-image-dedupe';
import { showError, showSuccess, showWarning } from '@/lib/utils/toast-helper';

const MAX_IMPORT_FILES = 2000;
const MAX_RENDERED_IMPORT_ROWS = 300;
const SAVE_GROUP_CHUNK_SIZE = 200;
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

type BatchImageStatus =
  | 'invalid'
  | 'pending'
  | 'matching'
  | 'matched'
  | 'not_found'
  | 'uploading'
  | 'saving'
  | 'success'
  | 'error';

interface ProductImageBatchImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UploadApiResponse {
  success: boolean;
  data?: {
    url?: string;
  };
  error?: string;
  message?: string;
}

interface BatchImageRow {
  clientId: string;
  file: File;
  fileName: string;
  inferredCode: string;
  kind: ProductImageImportKind;
  sizeText: string;
  status: BatchImageStatus;
  message?: string;
  uploadedUrl?: string;
  product?: {
    id: string;
    code: string;
    name: string;
    specification: string | null;
    thumbnailUrl: string | null;
  } | null;
}

interface UploadedBatchImageRow extends BatchImageRow {
  uploadedUrl: string;
  product: NonNullable<BatchImageRow['product']>;
}

interface ProductMediaGroup {
  product: NonNullable<BatchImageRow['product']>;
  rows: UploadedBatchImageRow[];
}

function getKindLabel(kind: ProductImageImportKind) {
  if (kind === 'thumbnail') return '缩略图';
  if (kind === 'main') return '主图';
  return '效果图';
}

function getStatusLabel(status: BatchImageStatus) {
  const labels: Record<BatchImageStatus, string> = {
    invalid: '不可用',
    pending: '待匹配',
    matching: '匹配中',
    matched: '已匹配',
    not_found: '未匹配',
    uploading: '上传中',
    saving: '保存中',
    success: '已完成',
    error: '失败',
  };

  return labels[status];
}

function getStatusBadgeClass(status: BatchImageStatus) {
  if (status === 'matched' || status === 'success') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (status === 'not_found' || status === 'invalid' || status === 'error') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  if (status === 'uploading' || status === 'saving' || status === 'matching') {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))}KB`;
  }

  return `${(size / 1024 / 1024).toFixed(2)}MB`;
}

function getFileExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.([^.]+)$/);
  return match?.[1] ?? '';
}

function stripFileExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').trim();
}

function inferImageMeta(fileName: string): {
  inferredCode: string;
  kind: ProductImageImportKind;
} {
  const baseName = stripFileExtension(fileName);
  const rules: Array<{ kind: ProductImageImportKind; pattern: RegExp }> = [
    {
      kind: 'thumbnail',
      pattern: /(?:[_\-\s]?(?:thumbnail|thumb|cover|封面|缩略图))$/i,
    },
    {
      kind: 'main',
      pattern: /(?:[_\-\s]?(?:main|主图)(?:[_\-\s]*\d+)?)$/i,
    },
    {
      kind: 'effect',
      pattern: /(?:[_\-\s]?(?:effect|scene|效果图|实拍)(?:[_\-\s]*\d+)?)$/i,
    },
  ];

  for (const rule of rules) {
    if (rule.pattern.test(baseName)) {
      return {
        kind: rule.kind,
        inferredCode: baseName
          .replace(rule.pattern, '')
          .replace(/[_\-\s]+$/, ''),
      };
    }
  }

  return {
    kind: 'thumbnail',
    inferredCode: baseName,
  };
}

function getMaxSizeForKind(kind: ProductImageImportKind) {
  return kind === 'effect' ? 2 * 1024 * 1024 : 1024 * 1024;
}

function validateImageFile(file: File, kind: ProductImageImportKind) {
  const extension = getFileExtension(file.name);
  if (!IMAGE_EXTENSIONS.has(extension)) {
    return '仅支持 JPG、PNG、WebP、GIF 图片';
  }

  if (!file.type.startsWith('image/') && file.type !== '') {
    return '文件类型不是图片';
  }

  const maxSize = getMaxSizeForKind(kind);
  if (file.size > maxSize) {
    return `${getKindLabel(kind)}不能超过 ${maxSize / 1024 / 1024}MB`;
  }

  return null;
}

function createRowsFromFiles(files: File[]) {
  return files.slice(0, MAX_IMPORT_FILES).map((file, index) => {
    const { inferredCode, kind } = inferImageMeta(file.name);
    const trimmedCode = inferredCode.trim();
    const validationError = trimmedCode
      ? validateImageFile(file, kind)
      : '文件名未识别到产品编码';

    return {
      clientId: `${Date.now()}-${index}-${file.name}`,
      file,
      fileName: file.name,
      inferredCode: trimmedCode,
      kind,
      sizeText: formatFileSize(file.size),
      status: validationError ? ('invalid' as const) : ('pending' as const),
      message: validationError ?? undefined,
      product: null,
    };
  });
}

async function uploadProductImage(
  file: File,
  kind: ProductImageImportKind
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', 'product');
  formData.append('kind', kind);

  const response = await fetch(
    '/api/upload',
    getCsrfTokenHeader({
      method: 'POST',
      credentials: 'include',
      body: formData,
    })
  );

  const data = (await response
    .json()
    .catch(() => null)) as UploadApiResponse | null;

  if (!response.ok || !data?.success || !data.data?.url) {
    throw new Error(data?.error || data?.message || '图片上传失败');
  }

  return data.data.url;
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
) {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await worker(items[currentIndex]);
      }
    }
  );

  await Promise.all(runners);
  return results;
}

function ProductImageImportSummary({ rows }: { rows: BatchImageRow[] }) {
  const summary = {
    total: rows.length,
    matched: rows.filter(row => row.status === 'matched').length,
    success: rows.filter(row => row.status === 'success').length,
    failed: rows.filter(row =>
      ['invalid', 'not_found', 'error'].includes(row.status)
    ).length,
  };

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <SummaryCard label="图片总数" value={summary.total} />
      <SummaryCard label="已匹配" value={summary.matched} tone="success" />
      <SummaryCard label="已完成" value={summary.success} tone="success" />
      <SummaryCard label="需处理" value={summary.failed} tone="danger" />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'success' | 'danger';
}) {
  const toneClass =
    tone === 'success'
      ? 'text-emerald-600'
      : tone === 'danger'
        ? 'text-rose-600'
        : 'text-[hsl(var(--color-text-primary))]';

  return (
    <div className="rounded-md border border-[hsl(var(--color-border-primary))] bg-white p-3">
      <div className="text-xs text-[hsl(var(--color-text-tertiary))]">
        {label}
      </div>
      <div className={`mt-1 text-xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function ProductImageImportTable({ rows }: { rows: BatchImageRow[] }) {
  const visibleRows = React.useMemo(() => {
    if (rows.length <= MAX_RENDERED_IMPORT_ROWS) {
      return rows;
    }

    const problemRows = rows.filter(row =>
      ['invalid', 'not_found', 'error'].includes(row.status)
    );
    const normalRows = rows.filter(
      row => !['invalid', 'not_found', 'error'].includes(row.status)
    );

    return [...problemRows, ...normalRows].slice(0, MAX_RENDERED_IMPORT_ROWS);
  }, [rows]);
  const hiddenCount = rows.length - visibleRows.length;

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="max-h-80 overflow-auto rounded-md border border-[hsl(var(--color-border-primary))]">
      {hiddenCount > 0 && (
        <div className="border-b border-[hsl(var(--color-border-primary))] bg-amber-50 px-3 py-2 text-xs text-amber-700">
          为保证页面流畅，当前优先展示问题图片和前 {MAX_RENDERED_IMPORT_ROWS}{' '}
          条明细；所有已选择图片都会参与匹配和导入。
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>文件</TableHead>
            <TableHead>识别编码</TableHead>
            <TableHead>类型</TableHead>
            <TableHead>匹配产品</TableHead>
            <TableHead>状态</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.map(row => (
            <TableRow key={row.clientId}>
              <TableCell>
                <div className="max-w-[240px]">
                  <div className="truncate font-medium">{row.fileName}</div>
                  <div className="text-xs text-[hsl(var(--color-text-tertiary))]">
                    {row.sizeText}
                  </div>
                </div>
              </TableCell>
              <TableCell className="font-mono text-xs">
                {row.inferredCode || '-'}
              </TableCell>
              <TableCell>{getKindLabel(row.kind)}</TableCell>
              <TableCell>
                {row.product ? (
                  <div className="max-w-[260px]">
                    <div className="truncate font-medium">
                      {row.product.code}｜{row.product.name}
                    </div>
                    <div className="truncate text-xs text-[hsl(var(--color-text-tertiary))]">
                      {row.product.specification || '未填写规格'}
                    </div>
                  </div>
                ) : (
                  <span className="text-[hsl(var(--color-text-tertiary))]">
                    -
                  </span>
                )}
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <Badge
                    variant="outline"
                    className={getStatusBadgeClass(row.status)}
                  >
                    {getStatusLabel(row.status)}
                  </Badge>
                  {row.message && (
                    <div className="max-w-[220px] text-xs text-rose-600">
                      {row.message}
                    </div>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function ProductImageBatchImportDialog({
  open,
  onOpenChange,
}: ProductImageBatchImportDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const folderInputRef = React.useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = React.useState<BatchImageRow[]>([]);
  const [isImporting, setIsImporting] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    folderInputRef.current?.setAttribute('webkitdirectory', '');
    folderInputRef.current?.setAttribute('directory', '');
  }, []);

  const matchMutation = useMutation({
    mutationFn: matchProductImagesForImport,
    onSuccess: applyMatchResult,
    onError: error => {
      showError('图片匹配失败', {
        description: getErrorMessage(error),
      });
      setRows(current =>
        current.map(row =>
          row.status === 'matching'
            ? { ...row, status: 'pending', message: '匹配失败，请重试' }
            : row
        )
      );
    },
  });

  const isBusy = isImporting || matchMutation.isPending;
  const hasUnsavedChanges = open && !isBusy && rows.length > 0;
  const { confirmLeavePage } = useUnsavedChangesGuard({
    enabled: hasUnsavedChanges,
    message: '批量图片导入尚未完成，确定要关闭吗？',
  });

  function resetDialogState() {
    setRows([]);
    setProgress(0);
    matchMutation.reset();
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  }

  function handleDialogOpenChange(nextOpen: boolean) {
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
  }

  function handleSelectImages() {
    if (!isBusy) {
      fileInputRef.current?.click();
    }
  }

  function handleSelectFolder() {
    if (!isBusy) {
      folderInputRef.current?.click();
    }
  }

  function handleFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (selectedFiles.length === 0) {
      return;
    }

    if (selectedFiles.length > MAX_IMPORT_FILES) {
      showWarning('图片数量过多', {
        description: `单次最多处理 ${MAX_IMPORT_FILES} 张，已自动取前 ${MAX_IMPORT_FILES} 张`,
      });
    }

    const nextRows = createRowsFromFiles(selectedFiles);
    setRows(nextRows);
    setProgress(0);
    void matchRows(nextRows);
  }

  async function matchRows(targetRows = rows) {
    const items: ProductImageImportMatchInput[] = targetRows
      .filter(row => row.status === 'pending')
      .map(row => ({
        clientId: row.clientId,
        fileName: row.fileName,
        inferredCode: row.inferredCode,
        kind: row.kind,
      }));

    if (items.length === 0) {
      showWarning('没有可匹配的图片', {
        description: '请检查文件格式和命名规则',
      });
      return;
    }

    setRows(current =>
      current.map(row =>
        items.some(item => item.clientId === row.clientId)
          ? { ...row, status: 'matching', message: undefined }
          : row
      )
    );

    await matchMutation.mutateAsync(items);
  }

  function applyMatchResult(result: ProductImageImportMatchResult) {
    const resultById = new Map(result.items.map(item => [item.clientId, item]));

    setRows(current =>
      current.map(row => {
        const item = resultById.get(row.clientId);
        if (!item) return row;

        return {
          ...row,
          product: item.product,
          status: item.status === 'matched' ? 'matched' : 'not_found',
          message:
            item.status === 'matched'
              ? undefined
              : '未找到同编码产品，请检查文件名',
        };
      })
    );

    if (result.unmatchedCount > 0) {
      showWarning('匹配完成', {
        description: `已匹配 ${result.matchedCount} 张，${result.unmatchedCount} 张未找到产品`,
      });
      return;
    }

    showSuccess('匹配完成', {
      description: `已匹配 ${result.matchedCount} 张图片`,
    });
  }

  function updateRow(clientId: string, patch: Partial<BatchImageRow>) {
    setRows(current =>
      current.map(row =>
        row.clientId === clientId ? { ...row, ...patch } : row
      )
    );
  }

  async function handleStartImport() {
    const matchedRows = rows.filter(
      row => row.status === 'matched' && row.product
    );

    if (matchedRows.length === 0) {
      showWarning('没有可导入的图片', {
        description: '请先选择图片并完成匹配',
      });
      return;
    }

    setIsImporting(true);
    setProgress(0);

    try {
      const uploadedRows = await uploadMatchedRows(matchedRows);
      const saveSummary = await saveUploadedRows(
        uploadedRows.filter(isUploadedBatchImageRow)
      );
      await queryClient.removeQueries({ queryKey: productQueryKeys.lists() });
      await queryClient.refetchQueries({
        queryKey: productQueryKeys.all,
        type: 'active',
      });

      const uploadFailedCount = uploadedRows.filter(row => row === null).length;
      const successCount = saveSummary.successCount;
      const errorCount = uploadFailedCount + saveSummary.failedCount;

      if (errorCount > 0) {
        showWarning('图片导入完成，部分失败', {
          description: `已处理 ${successCount} 张，失败 ${errorCount} 张，可查看明细后重试`,
        });
        return;
      }

      showSuccess('图片导入完成', {
        description: `已成功保存 ${successCount} 张产品图片`,
      });
    } finally {
      setIsImporting(false);
      setProgress(100);
    }
  }

  async function uploadMatchedRows(matchedRows: BatchImageRow[]) {
    let finishedCount = 0;

    return runWithConcurrency(matchedRows, 3, async row => {
      if (!row.product) return null;

      try {
        updateRow(row.clientId, { status: 'uploading', message: undefined });
        const uploadedUrl = await uploadProductImage(row.file, row.kind);
        finishedCount += 1;
        setProgress(Math.round((finishedCount / matchedRows.length) * 70));
        updateRow(row.clientId, { status: 'saving', uploadedUrl });
        return {
          ...row,
          uploadedUrl,
          product: row.product,
        } satisfies UploadedBatchImageRow;
      } catch (error) {
        finishedCount += 1;
        updateRow(row.clientId, {
          status: 'error',
          message: getErrorMessage(error),
        });
        setProgress(Math.round((finishedCount / matchedRows.length) * 70));
        return null;
      }
    });
  }

  async function saveUploadedRows(uploadedRows: UploadedBatchImageRow[]) {
    const groups = groupUploadedRows(uploadedRows);
    const chunks = chunkArray(groups, SAVE_GROUP_CHUNK_SIZE);
    const summary = {
      successCount: 0,
      failedCount: 0,
    };

    if (groups.length === 0) {
      return summary;
    }

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
      const chunk = chunks[chunkIndex];
      try {
        const result = await saveProductImagesForImport(
          chunk.map(buildProductMediaSaveInput)
        );
        const resultByProductId = new Map(
          result.results.map(item => [item.productId, item])
        );

        chunk.forEach(group => {
          const item = resultByProductId.get(group.product.id);
          if (item?.status === 'success') {
            summary.successCount += group.rows.length;
            group.rows.forEach(row => {
              updateRow(row.clientId, {
                status: 'success',
                message: undefined,
              });
            });
            return;
          }

          summary.failedCount += group.rows.length;
          group.rows.forEach(row => {
            updateRow(row.clientId, {
              status: 'error',
              message: item?.error || '图片资料保存失败',
            });
          });
        });
      } catch (error) {
        summary.failedCount += chunk.reduce(
          (total, group) => total + group.rows.length,
          0
        );
        chunk.forEach(group => {
          group.rows.forEach(row => {
            updateRow(row.clientId, {
              status: 'error',
              message: getErrorMessage(error),
            });
          });
        });
      } finally {
        setProgress(70 + Math.round(((chunkIndex + 1) / chunks.length) * 30));
      }
    }

    return summary;
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>批量导入产品图片</DialogTitle>
          <DialogDescription>
            按文件名匹配产品编码，适合一次整理大量缩略图、主图和效果图。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <FileImage className="h-4 w-4" />
            <AlertDescription>
              命名规则：<span className="font-medium">产品编码.jpg</span>
              作为缩略图，
              <span className="font-medium">产品编码_主图_1.jpg</span>
              作为主图，
              <span className="font-medium">产品编码_效果图_1.jpg</span>
              作为效果图。
            </AlertDescription>
          </Alert>

          <div className="flex flex-col gap-3 rounded-md border border-[hsl(var(--color-border-primary))] bg-white p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                图片文件
              </div>
              <div className="mt-1 text-sm text-[hsl(var(--color-text-secondary))]">
                {rows.length > 0
                  ? `已选择 ${rows.length} 张图片`
                  : '支持多选图片，也可以直接选择整个图片文件夹'}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleSelectImages}
                disabled={isBusy}
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                选择图片
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleSelectFolder}
                disabled={isBusy}
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                选择文件夹
              </Button>
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFilesChange}
              />
              <Input
                ref={folderInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFilesChange}
              />
            </div>
          </div>

          {rows.length > 0 && <ProductImageImportSummary rows={rows} />}

          {isBusy && (
            <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                {isImporting ? '正在导入图片' : '正在匹配产品'}
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <ProductImageImportTable rows={rows} />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleDialogOpenChange(false)}
            disabled={isBusy}
          >
            关闭
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void matchRows()}
            disabled={isBusy || rows.length === 0}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            重新匹配
          </Button>
          <Button
            type="button"
            onClick={() => void handleStartImport()}
            disabled={isBusy || rows.every(row => row.status !== 'matched')}
          >
            {isImporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            开始导入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function groupUploadedRows(rows: UploadedBatchImageRow[]) {
  const groupMap = new Map<string, ProductMediaGroup>();

  rows.forEach(row => {
    const existing = groupMap.get(row.product.id);
    if (existing) {
      existing.rows.push(row);
      return;
    }

    groupMap.set(row.product.id, {
      product: row.product,
      rows: [row],
    });
  });

  return Array.from(groupMap.values());
}

function isUploadedBatchImageRow(
  row: UploadedBatchImageRow | null
): row is UploadedBatchImageRow {
  return row !== null;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function buildProductMediaSaveInput(
  group: ProductMediaGroup
): ProductImageImportSaveInput {
  const thumbnailRow = [...group.rows]
    .filter(row => row.kind === 'thumbnail')
    .at(-1);
  const appendImages = dedupeProductImages(
    group.rows
      .filter(
        (row): row is UploadedBatchImageRow & { kind: 'main' | 'effect' } =>
          row.kind === 'main' || row.kind === 'effect'
      )
      .map((row, index) => ({
        url: row.uploadedUrl,
        type: row.kind,
        alt: `${group.product.code} ${getKindLabel(row.kind)}`,
        order: index,
      })),
    thumbnailRow ? [thumbnailRow.uploadedUrl] : []
  );

  return {
    productId: group.product.id,
    ...(thumbnailRow ? { thumbnailUrl: thumbnailRow.uploadedUrl } : {}),
    ...(appendImages.length > 0 ? { appendImages } : {}),
  };
}
