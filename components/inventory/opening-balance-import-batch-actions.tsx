'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  Loader2,
  PencilLine,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  correctOpeningBalanceImportBatch,
  deleteOpeningBalanceImportBatch,
  getOpeningBalanceImportBatchDetail,
  type OpeningBalanceImportBatchDetail,
} from '@/lib/api/initial-stock';
import { queryKeys } from '@/lib/queryKeys';
import { formatCostPrice, roundCostPrice } from '@/lib/utils/cost-price';
import {
  buildOpeningBalanceSavedValuePreview,
  type OpeningBalanceUnitCostEntryMode,
  type OpeningBalanceSavedQuantityMode,
  parseOpeningBalanceUnitCostInput,
} from '@/lib/utils/opening-balance-correction';
import {
  formatPieceSummary,
  parseQuantityInput,
} from '@/lib/utils/piece-calculation';
import { showError, showSuccess, showWarning } from '@/lib/utils/toast-helper';

interface OpeningBalanceImportBatchActionsProps {
  batchId: string;
  triggerLabel?: string;
  triggerClassName?: string;
  triggerVariant?: 'default' | 'outline' | 'secondary';
  triggerSize?: 'sm' | 'default';
  redirectAfterDelete?: string;
}

function formatQuantityInput(quantity: number, piecesPerUnit: number) {
  if (piecesPerUnit > 0) {
    const formatted = formatPieceSummary(quantity, piecesPerUnit, {
      fallbackUnit: '片',
    });
    return formatted.replace(/^(\d+)片 \((?:约)(.+)\)$/u, '$2');
  }

  return String(quantity);
}

function formatQuantityDisplay(quantity: number, piecesPerUnit: number) {
  return piecesPerUnit > 0
    ? formatPieceSummary(quantity, piecesPerUnit, { fallbackUnit: '片' })
    : `${quantity}片`;
}

function parseBatchQuantityInput(input: string, piecesPerUnit: number) {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error('请输入更正数量');
  }

  if (piecesPerUnit > 0) {
    return parseQuantityInput(trimmed, piecesPerUnit);
  }

  const normalized = trimmed.endsWith('片')
    ? trimmed.slice(0, -1).trim()
    : trimmed;
  const parsed = Number(normalized);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('请输入大于 0 的整数片数');
  }

  return parsed;
}

function formatUnitCostInput(unitCost?: number) {
  return typeof unitCost === 'number' && Number.isFinite(unitCost)
    ? formatCostPrice(unitCost, { withSymbol: false })
    : '';
}

function getUnitCostInputPlaceholder(mode: OpeningBalanceUnitCostEntryMode) {
  return mode === 'unit'
    ? '按件录入时可直接填 96，也支持 24片价'
    : '支持 24、24片价、96元/件';
}

function getUnitCostInputHelperText(mode: OpeningBalanceUnitCostEntryMode) {
  return mode === 'unit'
    ? '当前按件录入：直接填 96 会按件价换算并保存为单片成本；若某行本身就是片价，可明确写 24片价。'
    : '当前按片录入：直接填 24 会按单片成本保存；若手里拿的是件价，也支持写 96元/件 自动换算。';
}

function buildQuantityInputs(detail: OpeningBalanceImportBatchDetail) {
  return Object.fromEntries(
    detail.records.map(record => [
      record.id,
      formatQuantityInput(record.quantity, record.piecesPerUnit),
    ])
  );
}

function buildUnitCostInputs(detail: OpeningBalanceImportBatchDetail) {
  return Object.fromEntries(
    detail.records.map(record => [
      record.id,
      formatUnitCostInput(record.unitCost),
    ])
  );
}

function getCurrentUnitConversionPreview(
  record: {
    quantity: number;
    unitCost?: number;
    piecesPerUnit: number;
  },
  savedQuantityMode: OpeningBalanceSavedQuantityMode
) {
  try {
    return buildOpeningBalanceSavedValuePreview(record, savedQuantityMode);
  } catch {
    return null;
  }
}

function formatAmount(value?: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? `￥${value.toFixed(2)}`
    : '—';
}

function BatchSummaryCards({
  detail,
}: {
  detail: OpeningBalanceImportBatchDetail;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-md border border-slate-200 bg-slate-50/80 p-3">
        <div className="text-xs text-slate-500">导入批次号</div>
        <div className="mt-1 font-mono text-sm font-bold text-slate-900">
          {detail.batchId}
        </div>
      </div>
      <div className="rounded-md border border-blue-200 bg-blue-50/80 p-3">
        <div className="text-xs text-blue-700">本批次数量</div>
        <div className="mt-1 text-lg font-semibold text-blue-700">
          {detail.totalCount}
        </div>
      </div>
      <div className="rounded-md border border-emerald-200 bg-emerald-50/80 p-3">
        <div className="text-xs text-emerald-700">可批量更正</div>
        <div className="mt-1 text-lg font-semibold text-emerald-700">
          {detail.records.filter(record => record.canCorrect).length}
        </div>
      </div>
      <div className="rounded-md border border-amber-200 bg-amber-50/80 p-3">
        <div className="text-xs text-amber-700">存在限制</div>
        <div className="mt-1 text-lg font-semibold text-amber-700">
          {
            detail.records.filter(
              record => !record.canDelete || !record.canCorrect
            ).length
          }
        </div>
      </div>
    </div>
  );
}

export function OpeningBalanceImportBatchActions({
  batchId,
  triggerLabel = '处理这次导入',
  triggerClassName,
  triggerVariant = 'outline',
  triggerSize = 'sm',
  redirectAfterDelete = '/inventory/inbound?reason=opening_balance',
}: OpeningBalanceImportBatchActionsProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [quantityInputs, setQuantityInputs] = React.useState<
    Record<string, string>
  >({});
  const [unitCostInputs, setUnitCostInputs] = React.useState<
    Record<string, string>
  >({});
  const [savedQuantityMode, setSavedQuantityMode] =
    React.useState<OpeningBalanceSavedQuantityMode>('piece');
  const [unitCostEntryMode, setUnitCostEntryMode] =
    React.useState<OpeningBalanceUnitCostEntryMode>('piece');
  const [bulkUnitCostText, setBulkUnitCostText] = React.useState('');
  const [bulkPasteOpen, setBulkPasteOpen] = React.useState(false);

  const detailQuery = useQuery({
    queryKey: ['inventory', 'opening-balance-import-batch', batchId],
    queryFn: () => getOpeningBalanceImportBatchDetail(batchId),
    enabled: open && !!batchId,
  });

  React.useEffect(() => {
    if (!detailQuery.data) {
      return;
    }

    setQuantityInputs(buildQuantityInputs(detailQuery.data));
    setUnitCostInputs(buildUnitCostInputs(detailQuery.data));
  }, [detailQuery.data]);

  React.useEffect(() => {
    if (!open) {
      setSavedQuantityMode('piece');
      setUnitCostEntryMode('piece');
      setBulkUnitCostText('');
      setBulkPasteOpen(false);
    }
  }, [open]);

  const refreshBusinessQueries = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
    ]);
  }, [queryClient]);

  const correctMutation = useMutation({
    mutationFn: correctOpeningBalanceImportBatch,
    onSuccess: async result => {
      await refreshBusinessQueries();
      await detailQuery.refetch();
      router.refresh();

      if (result.failedCount > 0) {
        showWarning('批量更正已完成', {
          description: `已更正 ${result.updatedCount} 条，失败 ${result.failedCount} 条，请查看下方状态说明。`,
        });
        return;
      }

      if (result.updatedCount === 0) {
        showWarning('没有需要更正的记录', {
          description: '当前输入与原始数量一致，系统未做修改。',
        });
        return;
      }

      showSuccess('批量更正完成', {
        description: `已按导入批次更正 ${result.updatedCount} 条期初记录。`,
      });
    },
    onError: error => {
      showError('批量更正失败', {
        description: error instanceof Error ? error.message : '请稍后重试',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteOpeningBalanceImportBatch,
    onSuccess: async result => {
      await refreshBusinessQueries();
      setDeleteOpen(false);
      setOpen(false);
      router.push(redirectAfterDelete);
      router.refresh();

      showSuccess('整批删除完成', {
        description: `已删除批次 ${result.batchId} 的 ${result.deletedCount} 条期初记录。`,
      });
    },
    onError: error => {
      showError('整批删除失败', {
        description: error instanceof Error ? error.message : '请稍后重试',
      });
    },
  });

  const handleResetInputs = React.useCallback(() => {
    if (!detailQuery.data) {
      return;
    }

    setQuantityInputs(buildQuantityInputs(detailQuery.data));
    setUnitCostInputs(buildUnitCostInputs(detailQuery.data));
    setSavedQuantityMode('piece');
    setBulkUnitCostText('');
    setBulkPasteOpen(false);
  }, [detailQuery.data]);

  const handleApplyBulkUnitCosts = React.useCallback(() => {
    const detail = detailQuery.data;
    if (!detail) {
      return;
    }

    const targetRecords = detail.records.filter(record => record.canCorrect);
    if (targetRecords.length === 0) {
      showWarning('当前没有可填入的记录', {
        description: '这批记录都已经被后续单据用到了，暂时不能批量改价。',
      });
      return;
    }

    const normalizedLines = bulkUnitCostText
      .replace(/\r\n?/gu, '\n')
      .split('\n');
    while (
      normalizedLines.length > 0 &&
      normalizedLines[normalizedLines.length - 1]?.trim() === ''
    ) {
      normalizedLines.pop();
    }

    if (normalizedLines.every(line => line.trim() === '')) {
      showWarning('请先粘贴单价列', {
        description: '可以直接粘贴 Excel 里的单价列，一行对应一条可修改的记录。',
      });
      return;
    }

    const updates: Record<string, string> = {};
    let appliedCount = 0;
    let blankCount = 0;

    for (
      let index = 0;
      index < normalizedLines.length && index < targetRecords.length;
      index += 1
    ) {
      const rawLine = normalizedLines[index] ?? '';
      const trimmedLine = rawLine.trim();

      if (!trimmedLine) {
        blankCount += 1;
        continue;
      }

      const record = targetRecords[index];

      try {
        parseOpeningBalanceUnitCostInput(
          trimmedLine,
          record.piecesPerUnit,
          unitCostEntryMode
        );
      } catch (error) {
        showError('批量粘贴单价失败', {
          description: `第 ${index + 1} 行（${record.productCode}）：${
            error instanceof Error ? error.message : '格式不正确'
          }`,
        });
        return;
      }

      updates[record.id] = trimmedLine;
      appliedCount += 1;
    }

    if (appliedCount === 0) {
      showWarning('没有可填入的单价', {
        description:
          '当前粘贴内容都是空行，系统已保留原值。若只想改部分行，可保留其他行为空。',
      });
      return;
    }

    setUnitCostInputs(current => ({
      ...current,
      ...updates,
    }));
    setBulkUnitCostText('');
    setBulkPasteOpen(false);

    const extraLines = Math.max(
      normalizedLines.length - targetRecords.length,
      0
    );
    const remainingLines = Math.max(
      targetRecords.length - normalizedLines.length,
      0
    );
    const messageParts = [`已按当前表格顺序填入 ${appliedCount} 行单价`];

    if (blankCount > 0) {
      messageParts.push(`空白 ${blankCount} 行保留原值`);
    }
    if (extraLines > 0) {
      messageParts.push(`多出的 ${extraLines} 行已忽略`);
    } else if (remainingLines > 0) {
      messageParts.push(`剩余 ${remainingLines} 行保留原值`);
    }

    showSuccess('单价列已填入', {
      description: `${messageParts.join('，')}。`,
    });
  }, [bulkUnitCostText, detailQuery.data, unitCostEntryMode]);

  const applyCurrentUnitConversion = React.useCallback(
    (
      record: OpeningBalanceImportBatchDetail['records'][number],
      options: { silent?: boolean } = {}
    ) => {
      if (savedQuantityMode !== 'unit') {
        if (!options.silent) {
          showWarning('当前数量本来就是按片数保存的', {
            description:
              '只有当这条记录原来把“件数”直接存进系统时，才需要切到“其实是件数”后再做换算。',
          });
        }
        return false;
      }

      const preview = getCurrentUnitConversionPreview(
        record,
        savedQuantityMode
      );
      if (!preview) {
        if (!options.silent) {
          showWarning('这条记录暂时不能自动换算', {
            description: '请先确认数量、单位成本和每件片数是否完整。',
          });
        }
        return false;
      }

      setQuantityInputs(current => ({
        ...current,
        [record.id]: `${preview.quantity}片`,
      }));

      if (preview.unitCost !== undefined) {
        setUnitCostInputs(current => ({
          ...current,
          [record.id]: formatUnitCostInput(preview.unitCost),
        }));
      }

      return true;
    },
    [savedQuantityMode]
  );

  const handleApplyCurrentUnitConversionToAll = React.useCallback(() => {
    const detail = detailQuery.data;
    if (!detail) {
      return;
    }

    if (savedQuantityMode !== 'unit') {
      showWarning('当前数量本来就是按片数保存的', {
        description:
          '像 4277片（约329件）这种正常数据，不需要再乘装箱数。只有原来把件数直接存进系统时，才需要切到“其实是件数”后再批量换算。',
      });
      return;
    }

    const applicableRecords = detail.records.filter(
      record => record.canCorrect
    );
    let appliedCount = 0;

    applicableRecords.forEach(record => {
      if (applyCurrentUnitConversion(record, { silent: true })) {
        appliedCount += 1;
      }
    });

    if (appliedCount === 0) {
      showWarning('没有可换算的记录', {
        description: '这批数据里没有符合按件数换成片数条件的记录。',
      });
      return;
    }

    showSuccess('已批量填充换算结果', {
      description:
        '系统已经把当前的件数、件价预先换成片数和单片成本，请复核后再提交。',
    });
  }, [applyCurrentUnitConversion, detailQuery.data, savedQuantityMode]);

  const handleSubmitCorrections = async () => {
    const detail = detailQuery.data;
    if (!detail) {
      return;
    }

    const corrections: Array<{
      id: string;
      quantity: number;
      unitCost?: number;
    }> = [];

    try {
      for (const record of detail.records) {
        if (!record.canCorrect) {
          continue;
        }

        const rawInput = quantityInputs[record.id];
        const parsedQuantity = parseBatchQuantityInput(
          rawInput ?? String(record.quantity),
          record.piecesPerUnit
        );
        const rawUnitCostInput = unitCostInputs[record.id];
        const normalizedUnitCostInput = (
          rawUnitCostInput ?? formatUnitCostInput(record.unitCost)
        ).trim();
        const parsedUnitCost = normalizedUnitCostInput
          ? parseOpeningBalanceUnitCostInput(
              normalizedUnitCostInput,
              record.piecesPerUnit,
              unitCostEntryMode
            )
          : undefined;
        const currentUnitCost =
          typeof record.unitCost === 'number' &&
          Number.isFinite(record.unitCost)
            ? roundCostPrice(record.unitCost)
            : undefined;
        const unitCostChanged =
          parsedUnitCost !== undefined &&
          (currentUnitCost === undefined ||
            Math.abs(parsedUnitCost - currentUnitCost) > 0.000001);

        if (parsedQuantity !== record.quantity || unitCostChanged) {
          corrections.push({
            id: record.id,
            quantity: parsedQuantity,
            ...(unitCostChanged ? { unitCost: parsedUnitCost } : {}),
          });
        }
      }
    } catch (error) {
      showError('输入格式不正确', {
        description: error instanceof Error ? error.message : '请检查输入格式',
      });
      return;
    }

    if (corrections.length === 0) {
      showWarning('没有检测到修改', {
        description: '请先修改需要更正的数量，再提交。',
      });
      return;
    }

    await correctMutation.mutateAsync({
      batchId,
      corrections,
    });
  };

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size={triggerSize}
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        <RotateCcw className="mr-2 h-4 w-4" />
        {triggerLabel}
      </Button>

      <Dialog
        open={open}
        onOpenChange={nextOpen =>
          !correctMutation.isPending &&
          !deleteMutation.isPending &&
          setOpen(nextOpen)
        }
      >
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>处理这次导入的期初库存</DialogTitle>
            <DialogDescription>
              适合处理同一次导入里数量或价格录错的情况。系统会先判断这批数据有没有被后续单据用到，再决定哪些行还能修改或整批删除。
            </DialogDescription>
          </DialogHeader>

          {detailQuery.isLoading ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              正在加载导入批次详情...
            </div>
          ) : detailQuery.error ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {detailQuery.error instanceof Error
                  ? detailQuery.error.message
                  : '导入批次详情加载失败'}
              </AlertDescription>
            </Alert>
          ) : detailQuery.data ? (
            <div className="space-y-4">
              <BatchSummaryCards detail={detailQuery.data} />

              <Alert className="border-blue-200 bg-blue-50/80 text-blue-900">
                <ClipboardList className="h-4 w-4" />
                <AlertDescription className="leading-6">
                  这次导入的原始数量可以直接改；如果整批都还没被后续单据用到，也可以整批删掉后重新导入。已经被销售、出库或其他单据用到的记录，系统会自动拦住。
                </AlertDescription>
              </Alert>

              {!detailQuery.data.canDeleteAll ? (
                <Alert className="border-amber-200 bg-amber-50/80 text-amber-900">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="leading-6">
                    当前这批数据里已经有部分被后续单据用到了，不能整批删除。请只修改还能处理的行，后续已经用到的部分建议走库存调整。
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-blue-200 bg-blue-50/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-xs font-medium text-slate-600">
                    当前数量是按什么存的
                  </div>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                    <Button
                      type="button"
                      variant={
                        savedQuantityMode === 'piece' ? 'secondary' : 'ghost'
                      }
                      size="sm"
                      className="h-7 px-3 text-xs"
                      onClick={() => setSavedQuantityMode('piece')}
                      disabled={
                        correctMutation.isPending || deleteMutation.isPending
                      }
                    >
                      已是片数
                    </Button>
                    <Button
                      type="button"
                      variant={
                        savedQuantityMode === 'unit' ? 'secondary' : 'ghost'
                      }
                      size="sm"
                      className="h-7 px-3 text-xs"
                      onClick={() => setSavedQuantityMode('unit')}
                      disabled={
                        correctMutation.isPending || deleteMutation.isPending
                      }
                    >
                      其实是件数
                    </Button>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-blue-200 bg-white text-blue-700 hover:bg-blue-50"
                  onClick={handleApplyCurrentUnitConversionToAll}
                  disabled={
                    correctMutation.isPending ||
                    deleteMutation.isPending ||
                    savedQuantityMode !== 'unit'
                  }
                >
                  把当前件数批量换成片数
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-slate-600 hover:text-slate-900"
                  onClick={handleResetInputs}
                  disabled={
                    correctMutation.isPending || deleteMutation.isPending
                  }
                >
                  恢复当前已保存值
                </Button>
                <div className="text-xs text-slate-500">
                  {savedQuantityMode === 'unit'
                    ? '现在按“原来存进去的其实是件数”来处理。系统会把当前数量和单价先换算成片数、单片成本，再填到输入框里。'
                    : '默认按“原来存进去的就是片数”来处理。像 4277片（约329件）这种正常数据，不需要再换算；只有当时把 329件 直接存成 329片，才切到“其实是件数”。'}
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-xs font-medium text-slate-600">
                        单价填写方式
                      </div>
                      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                        <Button
                          type="button"
                          variant={
                            unitCostEntryMode === 'piece'
                              ? 'secondary'
                              : 'ghost'
                          }
                          size="sm"
                          className="h-7 px-3 text-xs"
                          onClick={() => setUnitCostEntryMode('piece')}
                          disabled={
                            correctMutation.isPending ||
                            deleteMutation.isPending
                          }
                        >
                          按片录入
                        </Button>
                        <Button
                          type="button"
                          variant={
                            unitCostEntryMode === 'unit' ? 'secondary' : 'ghost'
                          }
                          size="sm"
                          className="h-7 px-3 text-xs"
                          onClick={() => setUnitCostEntryMode('unit')}
                          disabled={
                            correctMutation.isPending ||
                            deleteMutation.isPending
                          }
                        >
                          按件录入
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs leading-5 text-slate-500">
                      {unitCostEntryMode === 'unit'
                        ? '价格都不一样时，切到“按件录入”后，直接填 96/88/120 这类件价即可；系统会统一换算成单片成本保存。'
                        : '默认按片录入；如果个别行拿到的是件价，仍可直接写 96元/件 或 96件价。'}
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="bg-white"
                    onClick={() => setBulkPasteOpen(current => !current)}
                    disabled={
                      correctMutation.isPending || deleteMutation.isPending
                    }
                  >
                    {bulkPasteOpen ? '收起批量填价' : '批量填单价'}
                  </Button>
                </div>

                {bulkPasteOpen ? (
                  <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-white p-3">
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-slate-700">
                        直接粘贴 Excel 里的单价列
                      </div>
                      <div className="text-xs leading-5 text-slate-500">
                        一行对应表格里一条可修改的记录，按从上到下的顺序填入。空行会保留原来的价格。
                      </div>
                      <Textarea
                        aria-label="批量粘贴单价列"
                        value={bulkUnitCostText}
                        onChange={event =>
                          setBulkUnitCostText(event.target.value)
                        }
                        disabled={
                          correctMutation.isPending || deleteMutation.isPending
                        }
                        placeholder={
                          unitCostEntryMode === 'unit'
                            ? '例如：\n96\n88.5\n120'
                            : '例如：\n24\n22.125\n30'
                        }
                        className="min-h-[140px] text-sm"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="bg-blue-600 text-white hover:bg-blue-700"
                          onClick={handleApplyBulkUnitCosts}
                          disabled={
                            correctMutation.isPending ||
                            deleteMutation.isPending
                          }
                        >
                          按顺序填入当前批次
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setBulkUnitCostText('')}
                          disabled={
                            correctMutation.isPending ||
                            deleteMutation.isPending
                          }
                        >
                          清空粘贴内容
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="overflow-x-auto rounded-md border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>单据号</TableHead>
                      <TableHead>产品</TableHead>
                      <TableHead>产品批次</TableHead>
                      <TableHead>当前数量</TableHead>
                      <TableHead>更正数量</TableHead>
                      <TableHead>当前单位成本</TableHead>
                      <TableHead>更正单位成本</TableHead>
                      <TableHead>处理状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailQuery.data.records.map(record => {
                      const conversionPreview =
                        savedQuantityMode === 'unit'
                          ? getCurrentUnitConversionPreview(
                              record,
                              savedQuantityMode
                            )
                          : null;

                      return (
                        <TableRow key={record.id}>
                          <TableCell className="align-top">
                            <div className="font-mono text-xs font-bold text-slate-600">
                              {record.recordNumber}
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="space-y-1">
                              <div className="text-sm font-semibold text-slate-900">
                                {record.productCode}
                              </div>
                              <div className="text-xs text-slate-500">
                                {record.productName}
                                {record.colorCode
                                  ? ` / ${record.colorCode}`
                                  : ''}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {record.specification || '—'}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <Badge
                              variant="outline"
                              className="border-amber-100 bg-amber-50 text-amber-700"
                            >
                              {record.batchNumber || '—'}
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top text-sm font-semibold text-slate-900">
                            <div>
                              {formatQuantityDisplay(
                                record.quantity,
                                record.piecesPerUnit
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {record.piecesPerUnit > 0
                                ? `${record.piecesPerUnit}片/件`
                                : '未维护装箱数'}
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <Input
                              value={quantityInputs[record.id] ?? ''}
                              onChange={event =>
                                setQuantityInputs(current => ({
                                  ...current,
                                  [record.id]: event.target.value,
                                }))
                              }
                              disabled={
                                !record.canCorrect || correctMutation.isPending
                              }
                              placeholder={
                                record.piecesPerUnit > 0
                                  ? '支持 460、460片、115件、115件+2片'
                                  : '请输入正确片数'
                              }
                              className="min-w-48"
                            />
                            {record.canCorrect && conversionPreview ? (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-[11px] text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                                  onClick={() =>
                                    applyCurrentUnitConversion(record)
                                  }
                                  disabled={correctMutation.isPending}
                                >
                                  按件数重新换算
                                </Button>
                                <span className="text-[11px] text-slate-400">
                                  换算后会变成{' '}
                                  {formatQuantityDisplay(
                                    conversionPreview.quantity,
                                    record.piecesPerUnit
                                  )}
                                </span>
                              </div>
                            ) : record.canCorrect ? (
                              <div className="mt-2 text-[11px] text-slate-400">
                                现在按“原来就是片数”来看待。如果这条记录当时把件数直接存进了系统，再切到“其实是件数”去换算。
                              </div>
                            ) : null}
                            {record.warningMessage ? (
                              <div className="mt-1 text-[11px] text-amber-600">
                                {record.warningMessage}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="align-top text-sm font-semibold text-slate-900">
                            <div>
                              {formatCostPrice(record.unitCost, {
                                fallback: '—',
                              })}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              总成本 {formatAmount(record.totalCost)}
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <Input
                              value={unitCostInputs[record.id] ?? ''}
                              onChange={event =>
                                setUnitCostInputs(current => ({
                                  ...current,
                                  [record.id]: event.target.value,
                                }))
                              }
                              disabled={
                                !record.canCorrect || correctMutation.isPending
                              }
                              placeholder={getUnitCostInputPlaceholder(
                                unitCostEntryMode
                              )}
                              inputMode="decimal"
                              className="min-w-36"
                            />
                            <div className="mt-1 text-[11px] text-slate-400">
                              {getUnitCostInputHelperText(unitCostEntryMode)}
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            {record.canCorrect ? (
                              <div className="space-y-1 text-xs">
                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                  可批量修改数量和成本
                                </Badge>
                                {record.canDelete ? (
                                  <div className="text-emerald-600">
                                    也可整批删除
                                  </div>
                                ) : record.blockedReason ? (
                                  <div className="max-w-72 text-amber-700">
                                    {record.blockedReason}
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <div className="space-y-1 text-xs">
                                <Badge variant="secondary">当前不可处理</Badge>
                                <div className="max-w-72 text-rose-700">
                                  {record.blockedReason ||
                                    '这条记录暂时不能按导入批次处理'}
                                </div>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={correctMutation.isPending || deleteMutation.isPending}
            >
              关闭
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
              onClick={() => setDeleteOpen(true)}
              disabled={
                !detailQuery.data?.canDeleteAll ||
                correctMutation.isPending ||
                deleteMutation.isPending
              }
            >
              <Trash2 className="mr-2 h-4 w-4" />
              整批删除
            </Button>
            <Button
              type="button"
              className="bg-blue-600 text-white hover:bg-blue-700"
              onClick={handleSubmitCorrections}
              disabled={
                !detailQuery.data?.canCorrectAny ||
                correctMutation.isPending ||
                deleteMutation.isPending
              }
            >
              {correctMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  提交中...
                </>
              ) : (
                <>
                  <PencilLine className="mr-2 h-4 w-4" />
                  提交已修改行
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认整批删除这次导入？</AlertDialogTitle>
            <AlertDialogDescription className="leading-6">
              这会删除导入批次 <strong>{batchId}</strong>{' '}
              下的全部期初记录，并同步扣回库存。
              <br />
              只有当这批记录都还没有被后续单据用到时，系统才允许整批删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(batchId)}
              disabled={deleteMutation.isPending}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  删除中...
                </>
              ) : (
                <>
                  <Boxes className="mr-2 h-4 w-4" />
                  确认整批删除
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
