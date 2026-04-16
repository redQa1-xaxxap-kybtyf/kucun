'use client';

import { AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { PageHeader } from '@/components/common/page-header';
import { SearchFilterCard } from '@/components/common/search-filter-card';
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
  INBOUND_DAMAGE_HANDLING_LABELS,
  INBOUND_DAMAGE_HANDLING_OPTIONS,
} from '@/lib/types/inbound';
import {
  PURCHASE_DAMAGE_LEDGER_ALLOWED_TRANSITIONS,
  PURCHASE_DAMAGE_LEDGER_STATUS_LABELS,
  PURCHASE_DAMAGE_LEDGER_STATUS_OPTIONS,
  type PurchaseDamageLedger,
  type PurchaseDamageLedgerQueryParams,
  type PurchaseDamageLedgerSummary,
  type PurchaseDamageLedgerStatus,
} from '@/lib/types/purchase-damage-ledger';
import { formatPieceSummary } from '@/lib/utils/piece-calculation';

type DamageFilterValue =
  | NonNullable<PurchaseDamageLedgerQueryParams['damageHandling']>
  | 'all';
type StatusFilterValue = NonNullable<PurchaseDamageLedgerStatus> | 'all';

interface PurchaseDamageLedgerPageClientProps {
  initialData: PurchaseDamageLedger[];
  initialSummary: PurchaseDamageLedgerSummary;
  initialParams: PurchaseDamageLedgerQueryParams;
}

interface FilterSnapshot {
  search: string;
  damageHandling: DamageFilterValue;
  status: StatusFilterValue;
  startDate?: string;
  endDate?: string;
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
  status: PurchaseDamageLedgerStatus
): React.ComponentProps<typeof Badge>['variant'] {
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

export function PurchaseDamageLedgerPageClient({
  initialData,
  initialSummary,
  initialParams,
}: PurchaseDamageLedgerPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [, startTransition] = React.useTransition();

  const [searchValue, setSearchValue] = React.useState(initialParams.search ?? '');
  const [damageHandling, setDamageHandling] = React.useState<DamageFilterValue>(
    initialParams.damageHandling ?? 'all'
  );
  const [statusFilter, setStatusFilter] = React.useState<StatusFilterValue>(
    initialParams.status ?? 'all'
  );
  const [dateRange, setDateRange] = React.useState<{
    startDate?: string;
    endDate?: string;
  }>({
    startDate: initialParams.startDate,
    endDate: initialParams.endDate,
  });
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<
    Record<string, { remarks: string; status: PurchaseDamageLedgerStatus }>
  >({});

  React.useEffect(() => {
    setDrafts(
      Object.fromEntries(
        initialData.map(item => [
          item.id,
          {
            remarks: item.remarks ?? '',
            status: item.status,
          },
        ])
      )
    );
  }, [initialData]);

  const buildSnapshot = React.useCallback(
    (overrides: Partial<FilterSnapshot> = {}): FilterSnapshot => ({
      search: overrides.search ?? searchValue,
      damageHandling: overrides.damageHandling ?? damageHandling,
      status: overrides.status ?? statusFilter,
      startDate: overrides.startDate ?? dateRange.startDate,
      endDate: overrides.endDate ?? dateRange.endDate,
    }),
    [dateRange.endDate, dateRange.startDate, damageHandling, searchValue, statusFilter]
  );

  const syncFiltersToURL = useDebouncedCallback((snapshot: FilterSnapshot) => {
    startTransition(() => {
      const params = new URLSearchParams();
      const trimmedSearch = snapshot.search.trim();

      if (trimmedSearch) {
        params.set('search', trimmedSearch);
      }
      if (snapshot.damageHandling && snapshot.damageHandling !== 'all') {
        params.set('damageHandling', snapshot.damageHandling);
      }
      if (snapshot.status !== 'all') {
        params.set('status', snapshot.status);
      }
      if (snapshot.startDate) {
        params.set('startDate', snapshot.startDate);
      }
      if (snapshot.endDate) {
        params.set('endDate', snapshot.endDate);
      }

      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname);
    });
  }, 300);

  const handleSearch = React.useCallback(
    (value: string) => {
      setSearchValue(value);
      syncFiltersToURL(buildSnapshot({ search: value }));
    },
    [buildSnapshot, syncFiltersToURL]
  );

  const handleFilterChange = React.useCallback(
    (key: string, value: string | undefined) => {
      if (key === 'damageHandling') {
        const nextValue = (value as DamageFilterValue | undefined) ?? 'all';
        setDamageHandling(nextValue);
        syncFiltersToURL(buildSnapshot({ damageHandling: nextValue }));
        return;
      }

      if (key === 'status') {
        const nextValue = (value as StatusFilterValue | undefined) ?? 'all';
        setStatusFilter(nextValue);
        syncFiltersToURL(buildSnapshot({ status: nextValue }));
      }
    },
    [buildSnapshot, syncFiltersToURL]
  );

  const handleDateRangeChange = React.useCallback(
    (range: { startDate?: string; endDate?: string }) => {
      setDateRange(range);
      syncFiltersToURL(
        buildSnapshot({ startDate: range.startDate, endDate: range.endDate })
      );
    },
    [buildSnapshot, syncFiltersToURL]
  );

  const handleClearFilters = React.useCallback(() => {
    setSearchValue('');
    setDamageHandling('all');
    setStatusFilter('all');
    setDateRange({});
    startTransition(() => {
      router.push(pathname);
    });
  }, [pathname, router, startTransition]);

  const hasActiveFilters =
    Boolean(searchValue.trim()) ||
    damageHandling !== 'all' ||
    statusFilter !== 'all' ||
    Boolean(dateRange.startDate) ||
    Boolean(dateRange.endDate);

  const handleDraftChange = React.useCallback(
    (id: string, patch: Partial<{ remarks: string; status: PurchaseDamageLedgerStatus }>) => {
      setDrafts(current => ({
        ...current,
        [id]: {
          remarks: patch.remarks ?? current[id]?.remarks ?? '',
          status: patch.status ?? current[id]?.status ?? 'pending_claim',
        },
      }));
    },
    []
  );

  const handleSave = React.useCallback(
    async (ledger: PurchaseDamageLedger) => {
      const draft = drafts[ledger.id];
      if (!draft) {
        return;
      }

      setSavingId(ledger.id);
      try {
        const response = await fetch(
          `/api/inventory/purchase-damage-ledgers/${ledger.id}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              status: draft.status,
              remarks: draft.remarks.trim() || undefined,
            }),
          }
        );

        const result = (await response.json().catch(() => null)) as
          | { success?: boolean; error?: string }
          | null;

        if (!response.ok || !result?.success) {
          throw new Error(result?.error || '保存破损台账失败');
        }

        toast({
          title: '保存成功',
          description: '破损台账状态已更新。',
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
    <div className="flex h-full flex-col gap-4 overflow-auto p-4 sm:p-6">
      <PageHeader
        title="采购到货破损台账"
        description="采购入库登记了破损后，系统会自动落这里。报工厂赔付和内部承担可以分开跟进，不用再翻单据。"
        icon={<AlertTriangle className="h-5 w-5" />}
        iconBgColor="hsl(var(--color-warning))"
        actions={
          <Button variant="outline" onClick={() => router.refresh()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新台账
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard title="破损笔数" value={`${initialSummary.totalCount} 笔`} />
        <SummaryCard title="待向工厂登记" value={`${initialSummary.pendingCount} 笔`} />
        <SummaryCard title="已向工厂登记" value={`${initialSummary.claimSubmittedCount} 笔`} />
        <SummaryCard title="已完成赔付" value={`${initialSummary.compensatedCount} 笔`} />
        <SummaryCard title="内部承担已结案" value={`${initialSummary.internalClosedCount} 笔`} />
        <SummaryCard
          title="累计破损"
          value={`${initialSummary.totalDamagedQuantity} 片`}
          secondary={`参考金额 ${initialSummary.totalReferenceAmount.toFixed(2)} 元`}
        />
      </div>

      <SearchFilterCard
        searchValue={searchValue}
        onSearchChange={handleSearch}
        searchPlaceholder="搜索台账号、入库单号、产品编码、产品名称、供应商、批次号..."
        filters={[
          {
            key: 'damageHandling',
            label: '处理方式',
            options: INBOUND_DAMAGE_HANDLING_OPTIONS,
            width: 'w-full sm:w-44',
          },
          {
            key: 'status',
            label: '跟进状态',
            options: PURCHASE_DAMAGE_LEDGER_STATUS_OPTIONS,
            width: 'w-full sm:w-44',
          },
        ]}
        filterValues={{
          damageHandling,
          status: statusFilter,
        }}
        onFilterChange={handleFilterChange}
        dateRangeFilter={{
          key: 'dateRange',
          label: '登记日期',
          value: dateRange,
          onChange: handleDateRangeChange,
          placeholder: '开始日期至结束日期',
        }}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
        variant="pro"
        compact={true}
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[140px]">台账号</TableHead>
            <TableHead className="min-w-[120px]">关联入库单</TableHead>
            <TableHead className="min-w-[240px]">产品 / 供应商</TableHead>
            <TableHead className="min-w-[140px]">批次 / 破损数量</TableHead>
            <TableHead className="min-w-[140px]">处理方式</TableHead>
            <TableHead className="min-w-[160px]">当前状态</TableHead>
            <TableHead className="min-w-[120px]">参考金额</TableHead>
            <TableHead className="min-w-[220px]">跟进备注</TableHead>
            <TableHead className="min-w-[180px]">最近处理</TableHead>
            <TableHead className="min-w-[120px] text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {initialData.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={10}
                className="py-10 text-center text-sm text-[hsl(var(--color-text-secondary))]"
              >
                目前没有符合条件的采购到货破损记录。
              </TableCell>
            </TableRow>
          ) : (
            initialData.map(ledger => {
              const draft = drafts[ledger.id] ?? {
                remarks: ledger.remarks ?? '',
                status: ledger.status,
              };
              const piecesPerUnit =
                ledger.batchPiecesPerUnit ?? ledger.product?.piecesPerUnit ?? 0;
              const selectableStatuses = [
                ledger.status,
                ...PURCHASE_DAMAGE_LEDGER_ALLOWED_TRANSITIONS[ledger.status],
              ];

              return (
                <TableRow key={ledger.id}>
                  <TableCell>
                    <div className="font-medium text-[hsl(var(--color-text-primary))]">
                      {ledger.ledgerNumber}
                    </div>
                    <div className="mt-1 text-xs text-[hsl(var(--color-text-secondary))]">
                      登记于 {formatDateTime(ledger.createdAt)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {ledger.inboundRecord ? (
                      <Link
                        href={`/inventory/inbound/${encodeURIComponent(
                          ledger.inboundRecord.recordNumber
                        )}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-[hsl(var(--color-primary))] hover:underline"
                      >
                        {ledger.inboundRecord.recordNumber}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      '—'
                    )}
                    {ledger.purchaseOrder?.orderNumber ? (
                      <div className="mt-1 text-xs text-[hsl(var(--color-text-secondary))]">
                        采购单 {ledger.purchaseOrder.orderNumber}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-[hsl(var(--color-text-primary))]">
                      {ledger.product?.code || '—'}
                    </div>
                    <div className="mt-1 text-sm text-[hsl(var(--color-text-secondary))]">
                      {ledger.product?.name || '未找到产品'}
                    </div>
                    <div className="mt-1 text-xs text-[hsl(var(--color-text-secondary))]">
                      供应商：{ledger.supplier?.name || '—'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>{ledger.batchNumber || '未填写批次'}</div>
                    <div className="mt-1 text-xs text-[hsl(var(--color-text-secondary))]">
                      {formatPieceSummary(ledger.damagedQuantity, piecesPerUnit, {
                        fallbackUnit: '片',
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {INBOUND_DAMAGE_HANDLING_LABELS[ledger.damageHandling]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(ledger.status)}>
                      {PURCHASE_DAMAGE_LEDGER_STATUS_LABELS[ledger.status]}
                    </Badge>
                    <div className="mt-2">
                      <Select
                        value={draft.status}
                        onValueChange={value =>
                          handleDraftChange(ledger.id, {
                            status: value as PurchaseDamageLedgerStatus,
                          })
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="选择状态" />
                        </SelectTrigger>
                        <SelectContent>
                          {PURCHASE_DAMAGE_LEDGER_STATUS_OPTIONS.filter(option =>
                            selectableStatuses.includes(option.value)
                          ).map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {ledger.referenceAmount?.toFixed(2) ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Input
                      value={draft.remarks}
                      placeholder="例如：已和工厂确认，等待补货或赔付"
                      onChange={event =>
                        handleDraftChange(ledger.id, {
                          remarks: event.target.value,
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div>{ledger.lastHandledBy?.name || ledger.createdBy?.name || '—'}</div>
                    <div className="mt-1 text-xs text-[hsl(var(--color-text-secondary))]">
                      {formatDateTime(ledger.resolvedAt || ledger.claimedAt || ledger.updatedAt)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
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
        <div className="text-xs text-[hsl(var(--color-text-secondary))]">{title}</div>
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
