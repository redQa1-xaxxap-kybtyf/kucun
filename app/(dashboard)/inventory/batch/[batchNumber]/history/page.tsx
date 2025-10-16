import { ActivitySquare, ArrowLeft, Clock, PackageSearch } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getBatchHistoryByNumber } from '@/lib/api/batch-history-server';
import {
  OUTBOUND_REASON_LABELS,
  type InventoryMovementEntry,
} from '@/lib/types/inventory';
import { formatDateTimeCN } from '@/lib/utils/datetime';
import { formatNumber } from '@/lib/utils/format';
import { formatPieceSummary } from '@/lib/utils/piece-calculation';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

const MOVEMENT_META: Record<
  InventoryMovementEntry['type'],
  { label: string; badge: 'success' | 'destructive' | 'secondary' }
> = {
  inbound: { label: '入库', badge: 'success' },
  outbound: { label: '出库', badge: 'destructive' },
  adjustment: { label: '库存调整', badge: 'secondary' },
};

const formatChange = (value: number) =>
  `${value > 0 ? '+' : ''}${formatNumber(value)}`;

type PageSearchParams = Record<string, string | string[] | undefined>;

const getSingleParam = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

export default async function BatchHistoryPage({
  params,
  searchParams,
}: {
  params: { batchNumber: string };
  searchParams: PageSearchParams;
}) {
  const batchNumber = decodeURIComponent(params.batchNumber || '').trim();

  const inventoryId = getSingleParam(searchParams.inventoryId);
  const productIdParam = getSingleParam(searchParams.productId);
  const variantParamRaw = getSingleParam(searchParams.variantId);
  const variantParam =
    variantParamRaw === undefined
      ? undefined
      : variantParamRaw === '' || variantParamRaw === 'null'
        ? null
        : variantParamRaw;

  const history = await getBatchHistoryByNumber(batchNumber, {
    inventoryId,
    productId: productIdParam,
    variantId: variantParam,
  });

  const primaryGroup = history.groups[0];

  const focusProduct =
    history.targetInventory?.product ?? primaryGroup?.product;
  const focusVariant =
    history.targetInventory?.variant ?? primaryGroup?.variant;
  const currentQuantity =
    primaryGroup?.currentQuantity ??
    history.targetInventory?.quantity ??
    undefined;
  const openingBalance =
    primaryGroup?.openingBalance ??
    history.targetInventory?.quantity ??
    undefined;
  const netChange =
    primaryGroup?.netChange ??
    (openingBalance !== undefined && currentQuantity !== undefined
      ? currentQuantity - openingBalance
      : undefined);

  const totalInbound = primaryGroup?.totalInbound ?? 0;
  const totalOutbound = primaryGroup?.totalOutbound ?? 0;
  const totalAdjustment = primaryGroup?.totalAdjustment ?? 0;

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面标题卡片 - 使用标准风格 */}
        <Card
          className="overflow-hidden border border-[hsl(var(--color-border-primary))]"
          style={{ boxShadow: 'var(--shadow-medium)' }}
        >
          <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-lg">
                  <PackageSearch className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                    批次库存变动历史
                  </h1>
                  <div className="mt-1 flex items-center gap-2 text-sm text-[hsl(var(--color-text-secondary))]">
                    <span className="font-medium">
                      批次号：{history.batchNumber || batchNumber || '—'}
                    </span>
                    {history.filteredBy?.inventoryId && (
                      <Badge variant="outline">
                        库存ID：{history.filteredBy.inventoryId}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="lg" asChild className="h-11">
                  <Link href="/inventory">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    返回
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 统计卡片 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card
            className="border border-[hsl(var(--color-border-primary))]"
            style={{ boxShadow: 'var(--shadow-light)' }}
          >
            <CardContent className="p-4">
              <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                期初库存
              </div>
              <div className="mt-2 text-2xl font-bold text-[hsl(var(--color-primary))]">
                {openingBalance !== undefined
                  ? formatNumber(openingBalance)
                  : '—'}
              </div>
              <div className="mt-1 text-xs text-[hsl(var(--color-text-tertiary))]">
                片
              </div>
            </CardContent>
          </Card>

          <Card
            className="border border-green-200 bg-green-50/50"
            style={{ boxShadow: 'var(--shadow-light)' }}
          >
            <CardContent className="p-4">
              <div className="text-xs font-medium text-gray-600">当前库存</div>
              <div className="mt-2 text-2xl font-bold text-green-600">
                {currentQuantity !== undefined
                  ? formatNumber(currentQuantity)
                  : '—'}
              </div>
              <div className="mt-1 text-xs text-gray-500">片</div>
            </CardContent>
          </Card>

          <Card
            className="border border-blue-200 bg-blue-50/50"
            style={{ boxShadow: 'var(--shadow-light)' }}
          >
            <CardContent className="p-4">
              <div className="text-xs font-medium text-gray-600">净变动</div>
              <div className="mt-2 text-2xl font-bold text-blue-600">
                {netChange !== undefined ? formatChange(netChange) : '—'}
              </div>
              <div className="mt-1 text-xs text-gray-500">片</div>
            </CardContent>
          </Card>

          <Card
            className="border border-[hsl(var(--color-border-primary))]"
            style={{ boxShadow: 'var(--shadow-light)' }}
          >
            <CardContent className="p-4">
              <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                变动汇总
              </div>
              <div className="mt-2 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[hsl(var(--color-text-secondary))]">
                    入库
                  </span>
                  <span className="font-semibold text-green-600">
                    +{formatNumber(totalInbound)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[hsl(var(--color-text-secondary))]">
                    出库
                  </span>
                  <span className="font-semibold text-red-600">
                    -{formatNumber(totalOutbound)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[hsl(var(--color-text-secondary))]">
                    调整
                  </span>
                  <span className="font-semibold text-orange-600">
                    {formatChange(totalAdjustment)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 产品信息卡片 */}
        <Card
          className="overflow-hidden border border-[hsl(var(--color-border-primary))]"
          style={{ boxShadow: 'var(--shadow-medium)' }}
        >
          <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] py-3">
            <CardTitle className="flex items-center text-base text-[hsl(var(--color-text-primary))]">
              <ActivitySquare className="mr-2 h-4 w-4 text-[hsl(var(--color-primary))]" />
              产品信息
            </CardTitle>
          </CardHeader>
          <CardContent className="bg-[hsl(var(--color-bg-card))] p-6">
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                  产品编码
                </div>
                <div className="mt-2 font-medium text-[hsl(var(--color-text-primary))]">
                  {focusProduct?.code || '—'}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                  产品名称
                </div>
                <div className="mt-2 font-medium text-[hsl(var(--color-text-primary))]">
                  {focusProduct?.name || '—'}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                  批次号
                </div>
                <div className="mt-2 font-medium text-[hsl(var(--color-text-primary))]">
                  {history.batchNumber || batchNumber || '—'}
                </div>
              </div>
              {focusVariant && (
                <div>
                  <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                    色号/变体
                  </div>
                  <div className="mt-2 font-medium text-[hsl(var(--color-text-primary))]">
                    {focusVariant.colorCode
                      ? `${focusVariant.colorCode}${
                          focusVariant.colorName
                            ? ` - ${focusVariant.colorName}`
                            : ''
                        }`
                      : '—'}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 变动历史 */}
        <Card
          className="overflow-hidden border border-[hsl(var(--color-border-primary))]"
          style={{ boxShadow: 'var(--shadow-medium)' }}
        >
          <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))]">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center text-[hsl(var(--color-text-primary))]">
                <Clock className="mr-2 h-5 w-5 text-[hsl(var(--color-primary))]" />
                变动历史
              </CardTitle>
              <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                共{' '}
                <strong className="text-[hsl(var(--color-primary))]">
                  {history.groups.reduce(
                    (sum, g) => sum + g.movements.length,
                    0
                  )}
                </strong>{' '}
                条记录
              </div>
            </div>
          </CardHeader>
          <CardContent className="bg-[hsl(var(--color-bg-card))] p-0">
            {history.groups.length === 0 ? (
              <div className="py-20 text-center text-sm text-[hsl(var(--color-text-secondary))]">
                当前批次尚未产生任何入库、出库或调整记录
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader
                    className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))]"
                    style={{ boxShadow: 'var(--shadow-light)' }}
                  >
                    <TableRow className="text-xs text-[hsl(var(--color-text-secondary))]">
                      <TableHead className="px-4 py-3 text-left font-medium">
                        时间
                      </TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium">
                        类型
                      </TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium">
                        单据编号
                      </TableHead>
                      <TableHead className="px-4 py-3 text-right font-medium">
                        变动数量
                      </TableHead>
                      <TableHead className="px-4 py-3 text-right font-medium">
                        操作前
                      </TableHead>
                      <TableHead className="px-4 py-3 text-right font-medium">
                        操作后
                      </TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium">
                        操作人
                      </TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium">
                        原因/备注
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y">
                    {history.groups.flatMap(group =>
                      group.movements.map(entry => {
                        const meta = MOVEMENT_META[entry.type];
                        const piecesPerUnit = entry.product?.piecesPerUnit || 0;
                        const absChange = Math.abs(entry.quantityChange);
                        const changePrefix =
                          entry.quantityChange > 0
                            ? '+'
                            : entry.quantityChange < 0
                              ? '-'
                              : '';
                        const changeDisplay =
                          piecesPerUnit > 0
                            ? formatPieceSummary(absChange, piecesPerUnit, {
                                fallbackUnit: '片',
                              })
                            : `${formatNumber(absChange)}片`;

                        return (
                          <TableRow
                            key={`${entry.type}-${entry.id}-${entry.createdAt}`}
                            className="transition-colors hover:bg-gray-50/50"
                          >
                            <TableCell className="px-4 py-3 text-sm text-[hsl(var(--color-text-secondary))]">
                              {formatDateTimeCN(entry.createdAt)}
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              <Badge variant={meta.badge} className="text-xs">
                                {meta.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              <code className="font-mono text-sm text-[hsl(var(--color-primary))]">
                                {entry.recordNumber}
                              </code>
                            </TableCell>
                            <TableCell className="px-4 py-3 text-right font-semibold text-gray-900">
                              {changePrefix}
                              {changeDisplay}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-right text-gray-700">
                              {entry.balanceBefore !== undefined
                                ? piecesPerUnit > 0
                                  ? formatPieceSummary(
                                      entry.balanceBefore,
                                      piecesPerUnit,
                                      { fallbackUnit: '片' }
                                    )
                                  : `${formatNumber(entry.balanceBefore)}片`
                                : '—'}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-right text-gray-700">
                              {entry.balanceAfter !== undefined
                                ? piecesPerUnit > 0
                                  ? formatPieceSummary(
                                      entry.balanceAfter,
                                      piecesPerUnit,
                                      { fallbackUnit: '片' }
                                    )
                                  : `${formatNumber(entry.balanceAfter)}片`
                                : '—'}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-sm text-gray-700">
                              {entry.operator?.name || '—'}
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              <div className="max-w-xs">
                                <div className="text-sm text-[hsl(var(--color-text-secondary))]">
                                  {entry.reason
                                    ? (OUTBOUND_REASON_LABELS[entry.reason] ??
                                      entry.reason)
                                    : '—'}
                                </div>
                                {entry.referenceNumber && (
                                  <div className="mt-0.5 text-xs text-[hsl(var(--color-text-tertiary))]">
                                    关联：{entry.referenceNumber}
                                  </div>
                                )}
                                {entry.remarks && (
                                  <div className="mt-0.5 text-xs text-[hsl(var(--color-text-tertiary))]">
                                    {entry.remarks}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
