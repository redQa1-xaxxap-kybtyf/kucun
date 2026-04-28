'use client';

import { AlertTriangle, Plus, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { ManualDamageFiltersCard } from '@/app/(dashboard)/inventory/manual-damage/manual-damage-filters-card';
import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import {
  MANUAL_DAMAGE_CATEGORY_LABELS,
  MANUAL_DAMAGE_CATEGORY_OPTIONS,
  MANUAL_DAMAGE_HANDLING_LABELS,
  MANUAL_DAMAGE_HANDLING_OPTIONS,
  MANUAL_DAMAGE_LEDGER_ALLOWED_TRANSITIONS,
  MANUAL_DAMAGE_LEDGER_STATUS_LABELS,
  MANUAL_DAMAGE_LEDGER_STATUS_OPTIONS,
  type ManualDamageCategory,
  type ManualDamageHandling,
  type ManualDamageLedger,
  type ManualDamageLedgerQueryParams,
  type ManualDamageLedgerStatus,
  type ManualDamageLedgerSummary,
} from '@/lib/types/manual-damage-ledger';
import { formatPieceSummary } from '@/lib/utils/piece-calculation';

interface ManualDamageLedgerPageClientProps {
  initialData: ManualDamageLedger[];
  initialSummary: ManualDamageLedgerSummary;
  initialParams: ManualDamageLedgerQueryParams;
}

function formatDateTime(value?: string) {
  if (!value) {
    return '—';
  }

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  });
}

function getStatusBadgeVariant(
  status: ManualDamageLedgerStatus
): React.ComponentProps<typeof Badge>['variant'] {
  if (status === 'pending_review') {
    return 'warning';
  }
  if (status === 'pending_claim') {
    return 'warning';
  }
  if (status === 'claim_submitted') {
    return 'info';
  }
  if (status === 'compensated') {
    return 'success';
  }
  return 'secondary';
}

export function ManualDamageLedgerPageClient({
  initialData,
  initialSummary,
  initialParams,
}: ManualDamageLedgerPageClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<
    Record<
      string,
      {
        remarks: string;
        status: ManualDamageLedgerStatus;
        damageCategory: ManualDamageCategory;
        damageHandling: ManualDamageHandling;
      }
    >
  >({});

  React.useEffect(() => {
    setDrafts(
      Object.fromEntries(
        initialData.map(item => [
          item.id,
          {
            remarks: item.remarks ?? '',
            status: item.status,
            damageCategory: item.damageCategory,
            damageHandling: item.damageHandling,
          },
        ])
      )
    );
  }, [initialData]);

  const handleDraftChange = React.useCallback(
    (
      id: string,
      patch: Partial<{
        remarks: string;
        status: ManualDamageLedgerStatus;
        damageCategory: ManualDamageCategory;
        damageHandling: ManualDamageHandling;
      }>
    ) => {
      setDrafts(current => ({
        ...current,
        [id]: {
          remarks: patch.remarks ?? current[id]?.remarks ?? '',
          status: patch.status ?? current[id]?.status ?? 'pending_review',
          damageCategory:
            patch.damageCategory ?? current[id]?.damageCategory ?? 'damage',
          damageHandling:
            patch.damageHandling ??
            current[id]?.damageHandling ??
            'internal_loss',
        },
      }));
    },
    []
  );

  const handleSave = React.useCallback(
    async (ledger: ManualDamageLedger) => {
      const draft = drafts[ledger.id];
      if (!draft) {
        return;
      }

      setSavingId(ledger.id);
      try {
        const response = await fetch(
          `/api/inventory/manual-damage-ledgers/${ledger.id}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              status: draft.status,
              damageCategory: draft.damageCategory,
              damageHandling: draft.damageHandling,
              remarks: draft.remarks.trim() || undefined,
            }),
          }
        );

        const result = (await response.json().catch(() => null)) as {
          success?: boolean;
          error?: string;
        } | null;

        if (!response.ok || !result?.success) {
          throw new Error(result?.error || '保存手工报损台账失败');
        }

        toast({
          title: '保存成功',
          description: '手工报损台账已更新。',
        });
        router.refresh();
      } catch (error) {
        toast({
          title: '保存失败',
          description: error instanceof Error ? error.message : '请稍后重试',
          variant: 'destructive',
        });
      } finally {
        setSavingId(null);
      }
    },
    [drafts, router, toast]
  );

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4 xl:p-6">
      <PageHeader
        title="手工报损台账"
        description="跟进仓内报损和处理结果。"
        icon={<AlertTriangle className="h-5 w-5" />}
        iconBgColor="hsl(var(--color-warning))"
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/inventory/adjust?reason=damage_loss&open=1">
                <Plus className="mr-2 h-4 w-4" />
                新增手工报损
              </Link>
            </Button>
            <Button variant="outline" onClick={() => router.refresh()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              刷新台账
            </Button>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
        <SummaryCard
          title="报损笔数"
          value={`${initialSummary.totalCount} 笔`}
        />
        <SummaryCard
          title="待补充处理"
          value={`${initialSummary.pendingReviewCount} 笔`}
        />
        <SummaryCard
          title="待向工厂登记"
          value={`${initialSummary.pendingClaimCount} 笔`}
        />
        <SummaryCard
          title="已向工厂登记"
          value={`${initialSummary.claimSubmittedCount} 笔`}
        />
        <SummaryCard
          title="已完成赔付"
          value={`${initialSummary.compensatedCount} 笔`}
        />
        <SummaryCard
          title="内部承担已结案"
          value={`${initialSummary.internalClosedCount} 笔`}
        />
        <SummaryCard
          title="累计报损"
          value={`${initialSummary.totalDamagedQuantity} 片`}
          secondary={`参考金额 ${initialSummary.totalReferenceAmount.toFixed(2)} 元`}
        />
      </div>

      <ManualDamageFiltersCard initialParams={initialParams} />

      <div className="hidden lg:block">
        <Table className="min-w-[1080px] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[220px]">台账/单据</TableHead>
              <TableHead className="w-[260px]">产品/报损</TableHead>
              <TableHead className="w-[230px]">类型/处理方式</TableHead>
              <TableHead className="w-[250px]">状态/备注</TableHead>
              <TableHead className="w-[120px] text-right">
                最近处理/操作
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-sm text-[hsl(var(--color-text-secondary))]"
                >
                  目前没有符合条件的手工报损记录。
                </TableCell>
              </TableRow>
            ) : (
              initialData.map(ledger => {
                const draft = drafts[ledger.id] ?? {
                  remarks: ledger.remarks ?? '',
                  status: ledger.status,
                  damageCategory: ledger.damageCategory,
                  damageHandling: ledger.damageHandling,
                };
                const piecesPerUnit =
                  ledger.batchPiecesPerUnit ??
                  ledger.product?.piecesPerUnit ??
                  0;
                const selectableStatuses = [
                  ledger.status,
                  ...MANUAL_DAMAGE_LEDGER_ALLOWED_TRANSITIONS[ledger.status],
                ];
                const visibleStatusOptions =
                  draft.damageHandling === 'pending_confirm'
                    ? MANUAL_DAMAGE_LEDGER_STATUS_OPTIONS.filter(
                        option => option.value === 'pending_review'
                      )
                    : MANUAL_DAMAGE_LEDGER_STATUS_OPTIONS.filter(option =>
                        selectableStatuses.includes(option.value)
                      );

                return (
                  <TableRow key={ledger.id}>
                    <TableCell>
                      <div className="font-medium text-[hsl(var(--color-text-primary))]">
                        {ledger.ledgerNumber}
                      </div>
                      <div className="mt-1 text-xs text-[hsl(var(--color-text-secondary))]">
                        登记于 {formatDateTime(ledger.createdAt)}
                      </div>
                      {ledger.adjustment ? (
                        <Link
                          href={`/inventory/adjustments/${encodeURIComponent(
                            ledger.adjustment.adjustmentNumber
                          )}`}
                          className="text-sm font-medium text-[hsl(var(--color-primary))] hover:underline"
                        >
                          {ledger.adjustment.adjustmentNumber}
                        </Link>
                      ) : (
                        '—'
                      )}
                      {ledger.adjustment?.notes ? (
                        <div className="mt-1 line-clamp-2 text-xs text-[hsl(var(--color-text-secondary))]">
                          {ledger.adjustment.notes}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="truncate font-medium text-[hsl(var(--color-text-primary))]">
                        {ledger.product?.code || '—'}
                      </div>
                      <div className="mt-1 truncate text-sm text-[hsl(var(--color-text-secondary))]">
                        {ledger.product?.name || '未找到产品'}
                      </div>
                      <div className="mt-1 truncate text-xs text-[hsl(var(--color-text-secondary))]">
                        供应商：{ledger.supplier?.name || '未自动匹配'}
                      </div>
                      <div className="mt-2 text-xs text-[hsl(var(--color-text-secondary))]">
                        批次：{ledger.batchNumber || '未填写批次'}
                      </div>
                      <div className="mt-1 text-xs text-[hsl(var(--color-text-secondary))]">
                        报损：
                        {formatPieceSummary(
                          ledger.damagedQuantity,
                          piecesPerUnit,
                          {
                            fallbackUnit: '片',
                          }
                        )}
                      </div>
                      <div className="mt-1 text-xs font-medium text-[hsl(var(--color-text-primary))]">
                        参考金额：{ledger.referenceAmount?.toFixed(2) ?? '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={draft.damageCategory}
                        onValueChange={value =>
                          handleDraftChange(ledger.id, {
                            damageCategory: value as ManualDamageCategory,
                          })
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="选择类型" />
                        </SelectTrigger>
                        <SelectContent>
                          {MANUAL_DAMAGE_CATEGORY_OPTIONS.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="mt-2">
                        <Badge variant="outline">
                          {MANUAL_DAMAGE_CATEGORY_LABELS[ledger.damageCategory]}
                        </Badge>
                      </div>
                      <div className="mt-2">
                        <Select
                          value={draft.damageHandling}
                          onValueChange={value =>
                            handleDraftChange(ledger.id, {
                              damageHandling: value as ManualDamageHandling,
                              status:
                                value === 'pending_confirm'
                                  ? 'pending_review'
                                  : draft.status,
                            })
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="选择方式" />
                          </SelectTrigger>
                          <SelectContent>
                            {MANUAL_DAMAGE_HANDLING_OPTIONS.map(option => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="mt-2">
                        <Badge variant="outline">
                          {MANUAL_DAMAGE_HANDLING_LABELS[ledger.damageHandling]}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(ledger.status)}>
                        {MANUAL_DAMAGE_LEDGER_STATUS_LABELS[ledger.status]}
                      </Badge>
                      <div className="mt-2">
                        <Select
                          value={draft.status}
                          onValueChange={value =>
                            handleDraftChange(ledger.id, {
                              status: value as ManualDamageLedgerStatus,
                            })
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="选择状态" />
                          </SelectTrigger>
                          <SelectContent>
                            {visibleStatusOptions.map(option => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input
                        value={draft.remarks}
                        className="mt-2"
                        placeholder="例如：已通知工厂，等待确认赔付"
                        onChange={event =>
                          handleDraftChange(ledger.id, {
                            remarks: event.target.value,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                        {ledger.lastHandledBy?.name ||
                          ledger.createdBy?.name ||
                          '—'}
                      </div>
                      <div className="mt-1 text-xs text-[hsl(var(--color-text-secondary))]">
                        {formatDateTime(
                          ledger.resolvedAt ||
                            ledger.claimedAt ||
                            ledger.updatedAt
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="mt-2"
                        onClick={() => void handleSave(ledger)}
                        disabled={savingId === ledger.id}
                      >
                        {savingId === ledger.id ? '保存中...' : '保存'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 lg:hidden">
        {initialData.length === 0 ? (
          <div className="rounded-md border border-[hsl(var(--color-border-primary))] bg-white p-6 text-center text-sm text-[hsl(var(--color-text-secondary))]">
            目前没有符合条件的手工报损记录。
          </div>
        ) : (
          initialData.map(ledger => {
            const draft = drafts[ledger.id] ?? {
              remarks: ledger.remarks ?? '',
              status: ledger.status,
              damageCategory: ledger.damageCategory,
              damageHandling: ledger.damageHandling,
            };
            const piecesPerUnit =
              ledger.batchPiecesPerUnit ?? ledger.product?.piecesPerUnit ?? 0;
            const selectableStatuses = [
              ledger.status,
              ...MANUAL_DAMAGE_LEDGER_ALLOWED_TRANSITIONS[ledger.status],
            ];
            const visibleStatusOptions =
              draft.damageHandling === 'pending_confirm'
                ? MANUAL_DAMAGE_LEDGER_STATUS_OPTIONS.filter(
                    option => option.value === 'pending_review'
                  )
                : MANUAL_DAMAGE_LEDGER_STATUS_OPTIONS.filter(option =>
                    selectableStatuses.includes(option.value)
                  );

            return (
              <div
                key={ledger.id}
                className="rounded-md border border-[hsl(var(--color-border-primary))] bg-white p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                      {ledger.ledgerNumber}
                    </div>
                    <div className="mt-1 text-xs text-[hsl(var(--color-text-secondary))]">
                      登记于 {formatDateTime(ledger.createdAt)}
                    </div>
                  </div>
                  <Badge variant={getStatusBadgeVariant(ledger.status)}>
                    {MANUAL_DAMAGE_LEDGER_STATUS_LABELS[ledger.status]}
                  </Badge>
                </div>

                <div className="mt-3 space-y-1 text-xs text-[hsl(var(--color-text-secondary))]">
                  <div className="font-medium text-[hsl(var(--color-text-primary))]">
                    {ledger.product?.code || '—'}
                  </div>
                  <div>{ledger.product?.name || '未找到产品'}</div>
                  <div>供应商：{ledger.supplier?.name || '未自动匹配'}</div>
                  <div>批次：{ledger.batchNumber || '未填写批次'}</div>
                  <div>
                    报损：
                    {formatPieceSummary(ledger.damagedQuantity, piecesPerUnit, {
                      fallbackUnit: '片',
                    })}
                  </div>
                  <div>
                    参考金额：{ledger.referenceAmount?.toFixed(2) ?? '—'}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">
                    {MANUAL_DAMAGE_CATEGORY_LABELS[ledger.damageCategory]}
                  </Badge>
                  <Badge variant="outline">
                    {MANUAL_DAMAGE_HANDLING_LABELS[ledger.damageHandling]}
                  </Badge>
                  {ledger.adjustment ? (
                    <Link
                      href={`/inventory/adjustments/${encodeURIComponent(
                        ledger.adjustment.adjustmentNumber
                      )}`}
                      className="font-medium text-[hsl(var(--color-primary))] hover:underline"
                    >
                      调整单 {ledger.adjustment.adjustmentNumber}
                    </Link>
                  ) : null}
                </div>

                <div className="mt-3 grid gap-2">
                  <Select
                    value={draft.damageCategory}
                    onValueChange={value =>
                      handleDraftChange(ledger.id, {
                        damageCategory: value as ManualDamageCategory,
                      })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="选择类型" />
                    </SelectTrigger>
                    <SelectContent>
                      {MANUAL_DAMAGE_CATEGORY_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={draft.damageHandling}
                    onValueChange={value =>
                      handleDraftChange(ledger.id, {
                        damageHandling: value as ManualDamageHandling,
                        status:
                          value === 'pending_confirm'
                            ? 'pending_review'
                            : draft.status,
                      })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="选择方式" />
                    </SelectTrigger>
                    <SelectContent>
                      {MANUAL_DAMAGE_HANDLING_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={draft.status}
                    onValueChange={value =>
                      handleDraftChange(ledger.id, {
                        status: value as ManualDamageLedgerStatus,
                      })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="选择状态" />
                    </SelectTrigger>
                    <SelectContent>
                      {visibleStatusOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={draft.remarks}
                    placeholder="例如：已通知工厂，等待确认赔付"
                    onChange={event =>
                      handleDraftChange(ledger.id, {
                        remarks: event.target.value,
                      })
                    }
                  />
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                    <div>
                      {ledger.lastHandledBy?.name ||
                        ledger.createdBy?.name ||
                        '—'}
                    </div>
                    <div>
                      {formatDateTime(
                        ledger.resolvedAt ||
                          ledger.claimedAt ||
                          ledger.updatedAt
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => void handleSave(ledger)}
                    disabled={savingId === ledger.id}
                  >
                    {savingId === ledger.id ? '保存中...' : '保存'}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  secondary,
}: {
  title: string;
  value: string;
  secondary?: string;
}) {
  return (
    <Card className="border-[hsl(var(--color-border-primary))]">
      <CardContent className="p-4">
        <div className="text-xs text-[hsl(var(--color-text-secondary))]">
          {title}
        </div>
        <div className="mt-2 text-xl font-semibold text-[hsl(var(--color-text-primary))]">
          {value}
        </div>
        {secondary ? (
          <div className="mt-1 text-xs text-[hsl(var(--color-text-secondary))]">
            {secondary}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
