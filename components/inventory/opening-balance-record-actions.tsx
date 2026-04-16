'use client';

import { Loader2, PencilLine, RotateCcw, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { OpeningBalanceImportBatchActions } from '@/components/inventory/opening-balance-import-batch-actions';
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
import { Label } from '@/components/ui/label';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import {
  useDeleteInboundRecord,
  useUpdateInboundRecord,
} from '@/lib/api/inbound';
import type { InboundRecord } from '@/lib/types/inbound';
import { formatCostPrice, roundCostPrice } from '@/lib/utils/cost-price';
import {
  type OpeningBalanceUnitCostEntryMode,
  parseOpeningBalanceUnitCostInput,
} from '@/lib/utils/opening-balance-correction';
import {
  formatPieceSummary,
  parseQuantityInput,
  validatePieceQuantity,
} from '@/lib/utils/piece-calculation';
import { showError, showSuccess, showWarning } from '@/lib/utils/toast-helper';

type OpeningBalanceEditableRecord = Pick<
  InboundRecord,
  | 'id'
  | 'recordNumber'
  | 'quantity'
  | 'batchNumber'
  | 'openingImportBatchId'
  | 'unitCost'
  | 'totalCost'
> & {
  product?: Pick<NonNullable<InboundRecord['product']>, 'piecesPerUnit'>;
  batchSpecification?: Pick<
    NonNullable<InboundRecord['batchSpecification']>,
    'piecesPerUnit'
  >;
};

interface OpeningBalanceRecordActionsProps {
  record: OpeningBalanceEditableRecord;
  compact?: boolean;
}

function getPiecesPerUnit(record: OpeningBalanceEditableRecord) {
  return (
    record.batchSpecification?.piecesPerUnit ??
    record.product?.piecesPerUnit ??
    0
  );
}

function formatQuantityDisplay(quantity: number, piecesPerUnit: number) {
  return piecesPerUnit > 0
    ? formatPieceSummary(quantity, piecesPerUnit, { fallbackUnit: '片' })
    : `${quantity}片`;
}

function formatEditableQuantityInput(quantity: number, piecesPerUnit: number) {
  if (piecesPerUnit > 0) {
    return formatPieceSummary(quantity, piecesPerUnit, {
      fallbackUnit: '片',
    }).replace(/^(\d+)片 \((?:约)(.+)\)$/u, '$2');
  }

  return String(quantity);
}

function formatUnitCostInput(unitCost?: number) {
  return typeof unitCost === 'number' && Number.isFinite(unitCost)
    ? formatCostPrice(unitCost, { withSymbol: false })
    : '';
}

function formatAmount(value?: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? `￥${value.toFixed(2)}`
    : '—';
}

function getUnitCostInputPlaceholder(mode: OpeningBalanceUnitCostEntryMode) {
  return mode === 'unit'
    ? '按件录入时可直接填 96，也支持 24片价'
    : '支持 24、24片价、96元/件';
}

function getUnitCostInputHelperText(mode: OpeningBalanceUnitCostEntryMode) {
  return mode === 'unit'
    ? '现在按件价填写。直接填 96 会自动换算成单片成本；如果这一条本来就是片价，也可以写成 24片价。'
    : '现在按片价填写。直接填 24 会按单片成本保存；如果你手里拿到的是件价，也可以写成 96元/件 自动换算。';
}

function parseCorrectedQuantity(input: string, piecesPerUnit: number) {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error('请输入更正后的数量');
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

export function OpeningBalanceRecordActions({
  record,
  compact = false,
}: OpeningBalanceRecordActionsProps) {
  const router = useRouter();
  const updateMutation = useUpdateInboundRecord();
  const deleteMutation = useDeleteInboundRecord();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [quantityInput, setQuantityInput] = React.useState(
    formatEditableQuantityInput(record.quantity, getPiecesPerUnit(record))
  );
  const [unitCostInput, setUnitCostInput] = React.useState(
    formatUnitCostInput(record.unitCost)
  );
  const [unitCostEntryMode, setUnitCostEntryMode] =
    React.useState<OpeningBalanceUnitCostEntryMode>('piece');

  const piecesPerUnit = getPiecesPerUnit(record);
  const initialQuantityInput = formatEditableQuantityInput(
    record.quantity,
    piecesPerUnit
  );
  const initialUnitCostInput = formatUnitCostInput(record.unitCost);
  const currentQuantityDisplay = formatQuantityDisplay(
    record.quantity,
    piecesPerUnit
  );
  const batchTriggerLabel = compact ? '整批处理' : '按本次导入批次处理';
  const editLabel = compact ? '更正' : '更正数量/成本';
  const deleteLabel = compact ? '删除' : '删除重导';

  React.useEffect(() => {
    if (editOpen) {
      setQuantityInput(initialQuantityInput);
      setUnitCostInput(initialUnitCostInput);
      setUnitCostEntryMode('piece');
    }
  }, [editOpen, initialQuantityInput, initialUnitCostInput]);

  const hasUnsavedChanges =
    editOpen &&
    !updateMutation.isPending &&
    (quantityInput !== initialQuantityInput ||
      unitCostInput !== initialUnitCostInput ||
      unitCostEntryMode !== 'piece');
  const { confirmLeavePage } = useUnsavedChangesGuard({
    enabled: hasUnsavedChanges,
    message: '当前期初库存更正内容尚未保存，确定要关闭吗？',
  });

  const handleEditOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !confirmLeavePage()) {
      return;
    }

    setEditOpen(nextOpen);
  };

  const handleEditCancel = () => {
    if (!confirmLeavePage()) {
      return;
    }

    setEditOpen(false);
  };

  const correctionPreview = React.useMemo(() => {
    try {
      const parsedQuantity = parseCorrectedQuantity(
        quantityInput,
        piecesPerUnit
      );
      const validation = validatePieceQuantity(parsedQuantity);

      if (!validation.isValid) {
        return {
          parsedQuantity: null,
          parsedUnitCost: null,
          error: validation.error ?? '数量格式不正确',
        };
      }

      const normalizedUnitCostInput = unitCostInput.trim();
      const parsedUnitCost = normalizedUnitCostInput
        ? parseOpeningBalanceUnitCostInput(
            normalizedUnitCostInput,
            piecesPerUnit,
            unitCostEntryMode
          )
        : undefined;

      return {
        parsedQuantity,
        parsedUnitCost,
        error: null,
      };
    } catch (error) {
      return {
        parsedQuantity: null,
        parsedUnitCost: null,
        error: error instanceof Error ? error.message : '数量格式不正确',
      };
    }
  }, [piecesPerUnit, quantityInput, unitCostEntryMode, unitCostInput]);

  const handleCorrectQuantity = async () => {
    if (correctionPreview.error || correctionPreview.parsedQuantity === null) {
      showError('更正失败', {
        description: correctionPreview.error ?? '请先填写正确的数量和成本',
      });
      return;
    }

    const parsedQuantity = correctionPreview.parsedQuantity;
    const currentUnitCost =
      typeof record.unitCost === 'number' && Number.isFinite(record.unitCost)
        ? roundCostPrice(record.unitCost)
        : undefined;
    const parsedUnitCost = correctionPreview.parsedUnitCost;
    const quantityChanged = parsedQuantity !== record.quantity;
    const unitCostChanged =
      parsedUnitCost !== undefined &&
      (currentUnitCost === undefined ||
        Math.abs(parsedUnitCost - currentUnitCost) > 0.000001);

    if (!quantityChanged && !unitCostChanged) {
      showWarning('没有检测到修改', {
        description: '当前输入与原始期初数量、单位成本一致，无需重复提交',
      });
      return;
    }

    try {
      const payload: {
        quantity?: number;
        unitCost?: number;
      } = {};

      if (quantityChanged) {
        payload.quantity = parsedQuantity;
      }
      if (unitCostChanged) {
        payload.unitCost = parsedUnitCost;
      }

      await updateMutation.mutateAsync({
        id: record.id,
        data: payload,
      });

      const messageParts: string[] = [];
      if (quantityChanged) {
        messageParts.push(formatQuantityDisplay(parsedQuantity, piecesPerUnit));
      }
      if (unitCostChanged) {
        messageParts.push(
          `单片成本 ${formatCostPrice(parsedUnitCost, { fallback: '—' })}`
        );
      }

      showSuccess('期初库存已更正', {
        description: `${record.recordNumber} 已更正为 ${messageParts.join('，')}`,
      });
      setEditOpen(false);
      router.refresh();
    } catch (error) {
      showError('更正失败', {
        description: error instanceof Error ? error.message : '请稍后重试',
      });
    }
  };

  const handleDeleteRecord = async () => {
    try {
      await deleteMutation.mutateAsync(record.id);
      showSuccess('期初库存已删除', {
        description: `${record.recordNumber} 已删除，可重新按正确数量导入`,
      });
      setDeleteOpen(false);
      router.push('/inventory/inbound?reason=opening_balance');
      router.refresh();
    } catch (error) {
      showError('删除失败', {
        description: error instanceof Error ? error.message : '请稍后重试',
      });
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {record.openingImportBatchId ? (
          <OpeningBalanceImportBatchActions
            batchId={record.openingImportBatchId}
            triggerLabel={batchTriggerLabel}
            triggerClassName="h-8 border-amber-200 bg-amber-50 px-3 text-amber-700 hover:bg-amber-100"
          />
        ) : null}
        <Button
          variant="outline"
          size="sm"
          className="h-8 border-blue-200 bg-blue-50 px-3 text-blue-700 hover:bg-blue-100"
          onClick={() => setEditOpen(true)}
        >
          <PencilLine className="mr-2 h-4 w-4" />
          {editLabel}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 border-rose-200 bg-rose-50 px-3 text-rose-700 hover:bg-rose-100"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {deleteLabel}
        </Button>
      </div>

      <Dialog open={editOpen} onOpenChange={handleEditOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>更正期初库存</DialogTitle>
            <DialogDescription>
              这里直接修改这条期初记录，适合处理刚导入就发现录错、还没被后续单据用到的情况。数量和成本都可以单独改。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert className="border-blue-200 bg-blue-50/80 text-blue-900">
              <RotateCcw className="h-4 w-4" />
              <AlertDescription className="leading-6">
                如果这条期初记录已经被出库、销售或其他后续单据用到，系统会自动拦住，避免把后面的账带乱。
              </AlertDescription>
            </Alert>

            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm sm:grid-cols-2">
              <div>
                <div className="text-xs text-slate-500">单据编号</div>
                <div className="mt-1 font-semibold text-slate-900">
                  {record.recordNumber}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">批次号</div>
                <div className="mt-1 font-semibold text-slate-900">
                  {record.batchNumber || '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">当前数量</div>
                <div className="mt-1 font-semibold text-slate-900">
                  {currentQuantityDisplay}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">当前单位成本</div>
                <div className="mt-1 font-semibold text-slate-900">
                  {formatCostPrice(record.unitCost, { fallback: '—' })}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">包装规格</div>
                <div className="mt-1 font-semibold text-slate-900">
                  {piecesPerUnit > 0 ? `${piecesPerUnit}片/件` : '未填写'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">当前总成本</div>
                <div className="mt-1 font-semibold text-slate-900">
                  {formatAmount(record.totalCost)}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="corrected-opening-balance-quantity">
                更正后的数量
              </Label>
              <Input
                id="corrected-opening-balance-quantity"
                value={quantityInput}
                onChange={event => setQuantityInput(event.target.value)}
                placeholder={
                  piecesPerUnit > 0
                    ? '支持输入 460、460片、115件、115件+2片'
                    : '请输入正确的片数，例如 460 或 460片'
                }
                disabled={updateMutation.isPending}
              />
              <div className="text-xs text-slate-500">
                {piecesPerUnit > 0
                  ? `系统会按 ${piecesPerUnit} 片/件帮你换算。例如 115件 会换算成 ${115 * piecesPerUnit}片。`
                  : '该记录没有装箱数，只能按片数更正。'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-xs font-medium text-slate-600">
                    单价填写方式
                  </div>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                    <Button
                      type="button"
                      variant={
                        unitCostEntryMode === 'piece' ? 'secondary' : 'ghost'
                      }
                      size="sm"
                      className="h-7 px-3 text-xs"
                      onClick={() => setUnitCostEntryMode('piece')}
                      disabled={updateMutation.isPending}
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
                      disabled={updateMutation.isPending}
                    >
                      按件录入
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="corrected-opening-balance-unit-cost">
                    更正后的单位成本
                  </Label>
                  <Input
                    id="corrected-opening-balance-unit-cost"
                    value={unitCostInput}
                    onChange={event => setUnitCostInput(event.target.value)}
                    placeholder={getUnitCostInputPlaceholder(unitCostEntryMode)}
                    inputMode="decimal"
                    disabled={updateMutation.isPending}
                  />
                  <div className="text-xs text-slate-500">
                    {getUnitCostInputHelperText(unitCostEntryMode)}
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`rounded-xl border px-3 py-2 text-sm ${
                correctionPreview.error
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              {correctionPreview.error ? (
                correctionPreview.error
              ) : (
                <div className="space-y-1">
                  <div>
                    保存后数量：
                    {formatQuantityDisplay(
                      correctionPreview.parsedQuantity ?? 0,
                      piecesPerUnit
                    )}
                  </div>
                  <div>
                    保存后单片成本：
                    {correctionPreview.parsedUnitCost !== undefined
                      ? formatCostPrice(correctionPreview.parsedUnitCost, {
                          fallback: '—',
                        })
                      : formatCostPrice(record.unitCost, { fallback: '—' })}
                  </div>
                  <div>
                    保存后总成本：
                    {formatAmount(
                      typeof (
                        correctionPreview.parsedUnitCost ?? record.unitCost
                      ) === 'number'
                        ? Number(
                            (
                              (correctionPreview.parsedQuantity ?? 0) *
                              Number(
                                correctionPreview.parsedUnitCost ??
                                  record.unitCost ??
                                  0
                              )
                            ).toFixed(2)
                          )
                        : undefined
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleEditCancel}
              disabled={updateMutation.isPending}
            >
              取消
            </Button>
            <Button
              type="button"
              className="bg-blue-600 text-white hover:bg-blue-700"
              onClick={handleCorrectQuantity}
              disabled={updateMutation.isPending || !!correctionPreview.error}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  更正中...
                </>
              ) : (
                '确认更正'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除并重新导入？</AlertDialogTitle>
            <AlertDialogDescription className="leading-6">
              这会删除原始期初入库记录 <strong>{record.recordNumber}</strong>。
              <br />
              只有当这条记录还没有被后续业务使用时，系统才会允许删除。
              删除后建议立即按正确数量重新导入。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRecord}
              disabled={deleteMutation.isPending}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  删除中...
                </>
              ) : (
                '确认删除'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
