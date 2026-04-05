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
import {
  correctOpeningBalanceImportBatch,
  deleteOpeningBalanceImportBatch,
  getOpeningBalanceImportBatchDetail,
  type OpeningBalanceImportBatchDetail,
} from '@/lib/api/initial-stock';
import { queryKeys } from '@/lib/queryKeys';
import {
  formatCostPrice,
  roundCostPrice,
} from '@/lib/utils/cost-price';
import {
  buildOpeningBalanceSavedValuePreview,
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
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
        <div className="text-xs text-slate-500">导入批次号</div>
        <div className="mt-1 font-mono text-sm font-bold text-slate-900">
          {detail.batchId}
        </div>
      </div>
      <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3">
        <div className="text-xs text-blue-700">本批次数量</div>
        <div className="mt-1 text-lg font-semibold text-blue-700">
          {detail.totalCount}
        </div>
      </div>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3">
        <div className="text-xs text-emerald-700">可批量更正</div>
        <div className="mt-1 text-lg font-semibold text-emerald-700">
          {detail.records.filter(record => record.canCorrect).length}
        </div>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3">
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
  triggerLabel = '按导入批次处理',
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
  }, [detailQuery.data]);

  const applyCurrentUnitConversion = React.useCallback(
    (
      record: OpeningBalanceImportBatchDetail['records'][number],
      options: { silent?: boolean } = {}
    ) => {
      if (savedQuantityMode !== 'unit') {
        if (!options.silent) {
          showWarning('当前保存值已按片数处理', {
            description:
              '只有在这条记录当前保存的其实是“件数”时，才需要切到“当前保存值其实是件数”后再执行换算。',
          });
        }
        return false;
      }

      const preview = getCurrentUnitConversionPreview(record, savedQuantityMode);
      if (!preview) {
        if (!options.silent) {
          showWarning('当前记录不能自动换算', {
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
      showWarning('当前保存值已按片数处理', {
        description:
          '像 4277片(约329件) 这种正常记录不需要再乘装箱数。只有当当前保存值其实是“件数”时，才切到“当前保存值其实是件数”后再批量换算。',
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
      showWarning('没有可自动换算的记录', {
        description: '这批数据里没有满足“件转片”自动换算条件的行。',
      });
      return;
    }

    showSuccess('已批量填充换算结果', {
      description:
        '系统已按当前保存值的“件数/件价”预填为“片数/单片成本”，请复核后再提交。',
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
              record.piecesPerUnit
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
            <DialogTitle>按导入批次处理期初库存</DialogTitle>
            <DialogDescription>
              适合处理同一次期初批量导入录错数量的场景。系统会先核对这批数据是否已经进入后续业务流程，再决定哪些行可以更正或整批删除。
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
                  处理策略：可以直接改这次导入的原始期初数量；如果整批都还没被后续业务使用，也可以整批删除后重新导入。已经被销售、出库或
                  FIFO 占用的记录会被系统自动拦住。
                </AlertDescription>
              </Alert>

              {!detailQuery.data.canDeleteAll ? (
                <Alert className="border-amber-200 bg-amber-50/80 text-amber-900">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="leading-6">
                    当前批次里存在已经进入后续业务流程的记录，不能整批删除。请只更正可处理的行，或者改用库存调整处理后续业务数据。
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-xs font-medium text-slate-600">
                    当前保存值口径
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
                  按当前件数/件价批量换算
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
                    ? '当前处于“其实是件数”模式。系统会把当前保存值当成件数/件价，再换算成片数/单片成本预填到输入框。'
                    : '默认安全模式：当前保存值按片数看待。像 4277片(约329件) 这种正常记录，不需要再做件转片。只有当系统里错把 329件 保存成 329片 时，才切到“其实是件数”。'}
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
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
                              {record.colorCode ? ` / ${record.colorCode}` : ''}
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
                                按当前件口径换算
                              </Button>
                              <span className="text-[11px] text-slate-400">
                                将当前保存值换算为{' '}
                                {formatQuantityDisplay(
                                  conversionPreview.quantity,
                                  record.piecesPerUnit
                                )}
                              </span>
                            </div>
                          ) : record.canCorrect ? (
                            <div className="mt-2 text-[11px] text-slate-400">
                              当前保存值按片数看待。若这条记录当时把“件数”直接存进了系统，再切到“其实是件数”执行换算。
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
                            placeholder="支持 24、24片价、96元/件"
                            inputMode="decimal"
                            className="min-w-36"
                          />
                          <div className="mt-1 text-[11px] text-slate-400">
                            统一保存片成本；也支持直接输入件价自动换算
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          {record.canCorrect ? (
                            <div className="space-y-1 text-xs">
                              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                可批量更正数量/成本
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
              只有当这批记录都还没有进入后续业务流程时，系统才允许执行整批删除。
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
