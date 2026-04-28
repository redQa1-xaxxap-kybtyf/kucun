'use client';

import { Package, User } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

import { CopyableText } from '@/components/common/copyable-text';
import { EmptyState } from '@/components/common/empty-state';
import { ContentLoading } from '@/components/common/loading';
import { RelativeTime } from '@/components/common/relative-time';
import { OpeningBalanceRecordActions } from '@/components/inventory/opening-balance-record-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { can } from '@/lib/auth/permissions';
import {
  INBOUND_REASON_LABELS,
  type InboundRecord as BaseInboundRecord,
} from '@/lib/types/inbound';
import { formatDetailedPieceSummary } from '@/lib/utils/piece-calculation';

interface InboundRecordWithProduct
  extends Omit<BaseInboundRecord, 'product' | 'batchSpecification'> {
  product?: {
    code: string;
    name: string;
    specification?: string;
    piecesPerUnit?: number;
    weight?: number | null;
  };
  batchSpecification?: {
    id: string;
    batchNumber?: string | null;
    piecesPerUnit: number;
    weight?: number | null;
    thickness?: number | null;
  };
}

interface InboundRecordsTableProps {
  records: InboundRecordWithProduct[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  isLoading: boolean;
  onPageChange?: (page: number) => void;
}

// 格式化操作类型
const getOperationTypeLabel = (reason: string) =>
  INBOUND_REASON_LABELS[reason as keyof typeof INBOUND_REASON_LABELS] || reason;

// 获取操作类型样式
const getOperationTypeVariant = (reason: string) => {
  const variants: Record<string, 'success' | 'warning' | 'info' | 'secondary'> =
    {
      purchase: 'success', // 采购入库
      return: 'warning', // 退货入库
      transfer: 'info', // 调拨入库
      surplus: 'success', // 盘盈入库
      other: 'secondary', // 其他
      sales_cancel: 'warning', // 销售订单取消入库
      return_inbound: 'info', // 退货订单入库
      opening_balance: 'secondary', // 期初库存
    };
  return variants[reason] || 'secondary';
};

// 格式化产品规格显示（限制11个字符，避免JSON字符串显示）
const formatSpecification = (specification?: string) => {
  if (!specification) {
    return null;
  }

  // 如果是JSON字符串，尝试解析并提取关键信息
  if (specification.startsWith('{') && specification.endsWith('}')) {
    try {
      const parsed = JSON.parse(specification);
      // 提取尺寸信息作为主要显示内容
      if (parsed.size) {
        return parsed.size.length > 11
          ? `${parsed.size.slice(0, 11)}...`
          : parsed.size;
      }
      // 如果没有尺寸，显示简化的规格信息
      return '规格详情...';
    } catch {
      // JSON解析失败，截断显示
      return specification.length > 11
        ? `${specification.slice(0, 11)}...`
        : specification;
    }
  }

  // 普通字符串，直接截断
  return specification.length > 11
    ? `${specification.slice(0, 11)}...`
    : specification;
};

// 格式化数量显示（X件Y片（共XX片））
const formatQuantity = (quantity: number, piecesPerUnit?: number | null) =>
  formatDetailedPieceSummary(quantity, piecesPerUnit ?? 0);

// 获取记录实际使用的每件片数（优先使用批次规格参数）
const getActualPiecesPerUnit = (record: InboundRecordWithProduct) =>
  record.batchSpecification?.piecesPerUnit ??
  record.product?.piecesPerUnit ??
  0;

// 获取记录的重量（优先使用批次规格参数）
const getActualWeight = (record: InboundRecordWithProduct) => {
  const weight = record.batchSpecification?.weight ?? null;
  return weight ? `${weight.toFixed(2)} kg` : '-';
};

const getDamagedQuantity = (record: InboundRecordWithProduct) =>
  record.damagedQuantity ?? 0;

const getArrivalQuantity = (record: InboundRecordWithProduct) =>
  record.quantity + getDamagedQuantity(record);

const hasDamagedQuantity = (record: InboundRecordWithProduct) =>
  getDamagedQuantity(record) > 0;

/**
 * 入库记录表格组件
 * ✅ 符合产品模块UI风格规范
 */
export function InboundRecordsTable({
  records,
  pagination,
  isLoading,
  onPageChange,
}: InboundRecordsTableProps) {
  const { data: session } = useSession();
  const canManageOpeningBalance = can(
    session?.user ?? null,
    'inventory:adjust'
  );

  if (isLoading) {
    return <ContentLoading text="加载入库记录..." />;
  }

  return (
    <div className="overflow-hidden rounded-md border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] shadow-sm">
      <TableHeading count={records.length} />
      {/* 桌面端表格视图 */}
      <div className="hidden overflow-x-auto lg:block">
        <RecordsTable
          records={records}
          canManageOpeningBalance={canManageOpeningBalance}
        />
      </div>

      {/* 移动端卡片视图 */}
      <div className="space-y-3 p-3 lg:hidden">
        {records.length === 0 ? (
          <EmptyState
            title="暂无入库记录"
            description="还没有入库单，先新增一笔入库。"
            icon={<Package className="text-muted-foreground h-6 w-6" />}
            action={
              <Button size="sm" asChild>
                <Link href="/inventory/inbound/create">去新增入库</Link>
              </Button>
            }
            compact
          />
        ) : (
          records.map(record => {
            const piecesPerUnit = getActualPiecesPerUnit(record);
            const damagedQuantity = getDamagedQuantity(record);
            const showDamage = damagedQuantity > 0;
            return (
              <div
                key={record.id}
                className="rounded-md border border-slate-100 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                      {record.product?.code || record.productId}
                    </div>
                    <div className="mt-0.5 text-xs text-[hsl(var(--color-text-secondary))]">
                      {record.product?.name || '未知产品'}
                    </div>
                    <div className="mt-1 text-[11px] font-bold text-slate-400">
                      单据号：{record.recordNumber}
                    </div>
                    {record.openingImportBatchId ? (
                      <div className="mt-1 font-mono text-[11px] break-all text-blue-600">
                        导入批次：{record.openingImportBatchId}
                      </div>
                    ) : null}
                    <div className="mt-1 text-xs text-[hsl(var(--color-text-secondary))]">
                      规格：
                      {formatSpecification(record.product?.specification) ||
                        '-'}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-2 text-[11px] text-[hsl(var(--color-text-secondary))]">
                      <span className="flex items-center gap-1">
                        批次：
                        <Badge
                          variant="outline"
                          className="h-4 border-amber-100 bg-amber-50 px-1 text-[9px] font-bold text-amber-600"
                        >
                          {record.batchNumber || '-'}
                        </Badge>
                      </span>
                      <span className="flex items-center gap-1">
                        每件片数：
                        <span className="font-bold text-slate-600">
                          {piecesPerUnit > 0
                            ? `${piecesPerUnit} 片/件`
                            : '未填写'}
                        </span>
                      </span>
                      <span>重量：{getActualWeight(record)}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-[hsl(var(--color-text-secondary))]">
                    <div className="mb-1 flex flex-wrap justify-end gap-1">
                      <Badge
                        variant={getOperationTypeVariant(record.reason)}
                        className="text-xs font-medium"
                      >
                        {getOperationTypeLabel(record.reason)}
                      </Badge>
                      {showDamage ? (
                        <Badge
                          variant="destructive"
                          className="text-xs font-bold"
                        >
                          有破损
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <User className="h-3 w-3" />
                      <RelativeTime date={record.createdAt} />
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-50 pt-3 text-xs">
                  <span className="font-bold text-slate-500">
                    {showDamage ? '合格入库' : '入库数量'}
                  </span>
                  <span className="font-semibold text-blue-600">
                    {formatQuantity(record.quantity, piecesPerUnit)}
                  </span>
                </div>

                {showDamage ? (
                  <div className="mt-2 flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2 text-xs">
                    <span className="font-bold text-blue-600">到货总量</span>
                    <span className="font-semibold text-blue-700">
                      {formatQuantity(
                        getArrivalQuantity(record),
                        piecesPerUnit
                      )}
                    </span>
                  </div>
                ) : null}

                {showDamage ? (
                  <div className="mt-2 flex items-center justify-between rounded-lg border border-red-100 bg-red-50/70 px-3 py-2 text-xs">
                    <span className="font-bold text-red-600">到货破损</span>
                    <span className="font-semibold text-red-600">
                      {formatQuantity(damagedQuantity, piecesPerUnit)}
                    </span>
                  </div>
                ) : null}

                {record.remarks && (
                  <div className="mt-2 text-[11px] text-slate-400 italic">
                    备注：{record.remarks}
                  </div>
                )}

                {canManageOpeningBalance &&
                record.reason === 'opening_balance' ? (
                  <div className="mt-3 rounded-md border border-amber-100 bg-amber-50/70 p-3">
                    <div className="mb-2 text-[11px] font-bold text-amber-700">
                      期初纠错
                    </div>
                    <OpeningBalanceRecordActions record={record} compact />
                  </div>
                ) : null}

                <div className="mt-3 border-t border-slate-50 pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    asChild
                    className="w-full"
                  >
                    <Link
                      href={`/inventory/inbound/${encodeURIComponent(
                        record.recordNumber
                      )}`}
                    >
                      查看详情
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 分页器 */}
      {pagination && onPageChange && (
        <div className="border-t border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-tertiary))] px-4 py-3">
          <Pagination
            pagination={pagination}
            onPageChange={onPageChange}
            showRange
            showTotal
            disabled={isLoading}
          />
        </div>
      )}
    </div>
  );
}

function TableHeading({ count }: { count: number }) {
  return (
    <div className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] px-4 py-3">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-[hsl(var(--color-primary))]" />
        <span className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
          入库记录 ({count} 条)
        </span>
      </div>
    </div>
  );
}

function RecordsTable({
  records,
  canManageOpeningBalance,
}: {
  records: InboundRecordWithProduct[];
  canManageOpeningBalance: boolean;
}) {
  const colSpan = canManageOpeningBalance ? 10 : 9;

  return (
    <Table className="min-w-[980px] table-fixed 2xl:min-w-[1220px] [&_th]:whitespace-nowrap">
      <TableHeader className="bg-slate-50">
        <TableRow className="border-b border-slate-200 hover:bg-transparent">
          <TableHead>单据编号</TableHead>
          <TableHead>产品编码/名称</TableHead>
          <TableHead>产品批次</TableHead>
          <TableHead className="hidden 2xl:table-cell">规格型号</TableHead>
          <TableHead className="hidden 2xl:table-cell">装箱数</TableHead>
          <TableHead className="text-right">合格入库 / 到货</TableHead>
          <TableHead>业务类型</TableHead>
          <TableHead>记账时间</TableHead>
          <TableHead className="hidden 2xl:table-cell">备注说明</TableHead>
          {canManageOpeningBalance ? (
            <TableHead className="hidden 2xl:table-cell">期初纠错</TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.length === 0 ? (
          <TableRow>
            <TableCell colSpan={colSpan} className="p-8">
              <EmptyState
                title="暂无入库记录"
                description="还没有任何入库流水，您可以先创建一条入库记录。"
                icon={<Package className="text-muted-foreground h-6 w-6" />}
                action={
                  <Button size="sm" asChild>
                    <Link href="/inventory/inbound/create">去新增入库</Link>
                  </Button>
                }
                compact
              />
            </TableCell>
          </TableRow>
        ) : (
          records.map(record => (
            <InboundRecordRow
              key={record.id}
              record={record}
              canManageOpeningBalance={canManageOpeningBalance}
            />
          ))
        )}
      </TableBody>
    </Table>
  );
}

function InboundRecordRow({
  record,
  canManageOpeningBalance,
}: {
  record: InboundRecordWithProduct;
  canManageOpeningBalance: boolean;
}) {
  const piecesPerUnit = getActualPiecesPerUnit(record);
  const damagedQuantity = getDamagedQuantity(record);
  const showDamage = hasDamagedQuantity(record);

  return (
    <TableRow className="h-14 border-b border-slate-100 transition-colors hover:bg-blue-50/30">
      <TableCell className="max-w-[180px] truncate font-mono text-[11px] font-bold tracking-tight whitespace-nowrap text-slate-400">
        <div className="space-y-1">
          <Link
            href={`/inventory/inbound/${encodeURIComponent(record.recordNumber)}`}
            className="text-slate-500 transition-colors hover:text-blue-600 hover:underline"
          >
            <CopyableText text={record.recordNumber} showIcon="never" />
          </Link>
          {record.openingImportBatchId ? (
            <div className="font-mono text-[10px] break-all text-blue-600">
              {record.openingImportBatchId}
            </div>
          ) : null}
          {canManageOpeningBalance && record.reason === 'opening_balance' ? (
            <div className="mt-2 space-y-2 rounded-md border border-amber-100 bg-amber-50/70 p-2 2xl:hidden">
              <div className="text-[11px] font-bold text-amber-700">
                期初纠错
              </div>
              <OpeningBalanceRecordActions record={record} compact />
            </div>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="min-w-[180px]">
        <div className="flex flex-col py-1">
          <span className="text-sm leading-tight font-semibold text-slate-900">
            {record.product?.code || record.productId}
          </span>
          <span className="mt-1 text-[11px] font-bold text-slate-400">
            {record.product?.name || '未知产品'}
          </span>
          <span className="mt-1 text-[11px] font-medium text-slate-500 2xl:hidden">
            规格：{formatSpecification(record.product?.specification) || '-'}
          </span>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {record.batchNumber ? (
          <Badge
            variant="outline"
            className="border-amber-100 bg-amber-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-600"
          >
            <CopyableText text={record.batchNumber} />
          </Badge>
        ) : (
          <span className="text-slate-300">-</span>
        )}
        <div className="mt-1 text-[10px] font-medium text-slate-400 2xl:hidden">
          {piecesPerUnit > 0 ? `${piecesPerUnit}片/件` : '未记录装箱'} ·{' '}
          {getActualWeight(record)}
        </div>
      </TableCell>
      <TableCell className="hidden text-xs font-medium whitespace-nowrap text-slate-500 2xl:table-cell">
        <div className="flex flex-col gap-1">
          <span>
            {formatSpecification(record.product?.specification) || '-'}
          </span>
          <span className="text-[10px] font-bold text-slate-400">
            {getActualWeight(record)}
          </span>
        </div>
      </TableCell>
      <TableCell className="hidden text-xs font-bold whitespace-nowrap text-slate-500 2xl:table-cell">
        {piecesPerUnit > 0 ? (
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-slate-700">
              {piecesPerUnit}
            </span>
            <span className="rounded-md border border-blue-50 bg-blue-50/30 px-1.5 py-0.5 text-[10px] font-semibold text-blue-500">
              片/件
            </span>
          </div>
        ) : (
          <span className="text-xs text-slate-400">未记录</span>
        )}
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <div className="flex flex-col items-end gap-1">
          <span className="text-sm font-semibold text-blue-600">
            {formatQuantity(record.quantity, piecesPerUnit)}
          </span>
          {showDamage ? (
            <>
              <span className="text-[11px] font-bold text-slate-500">
                到货 {formatQuantity(getArrivalQuantity(record), piecesPerUnit)}
              </span>
              <span className="text-[11px] font-bold text-red-500">
                破损 {formatQuantity(damagedQuantity, piecesPerUnit)}
              </span>
            </>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="flex flex-wrap gap-1">
          <Badge
            variant={getOperationTypeVariant(record.reason)}
            className="text-[10px] font-semibold"
          >
            {getOperationTypeLabel(record.reason)}
          </Badge>
          {showDamage ? (
            <Badge variant="destructive" className="text-[10px] font-semibold">
              有破损
            </Badge>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-xs whitespace-nowrap text-slate-500">
        <div className="flex flex-col gap-1">
          <RelativeTime date={record.createdAt} />
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
            <User className="h-2.5 w-2.5" />
            操作员
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden max-w-[150px] truncate text-xs text-slate-400 italic 2xl:table-cell">
        {record.remarks || '-'}
      </TableCell>
      {canManageOpeningBalance ? (
        <TableCell className="hidden min-w-[220px] 2xl:table-cell">
          {record.reason === 'opening_balance' ? (
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-amber-700">
                这批期初数据可在这里直接修改
              </div>
              <OpeningBalanceRecordActions record={record} compact />
            </div>
          ) : (
            <span className="text-xs text-slate-300">-</span>
          )}
        </TableCell>
      ) : null}
    </TableRow>
  );
}
