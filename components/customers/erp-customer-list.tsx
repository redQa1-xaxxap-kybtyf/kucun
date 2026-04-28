import {
  Calendar,
  Edit,
  Eye,
  Loader2,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  ShoppingCart,
  Trash2,
  User,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import { CopyableText } from '@/components/common/copyable-text';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Customer } from '@/lib/types/customer';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/utils/datetime';

interface ERPCustomerListProps {
  customers: Customer[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  isLoading?: boolean;
  isRefreshing?: boolean;
  onCreateNew?: () => void;
  onViewDetail?: (customer: Customer) => void;
  onEdit?: (customer: Customer) => void;
  onDelete?: (customer: Customer) => void;
  onPageChange?: (page: number) => void;
}

function formatDate(value: string) {
  return formatDateTime(value).split(' ')[0];
}

function getCooperationText(customer: Customer) {
  if (typeof customer.cooperationDays !== 'number') {
    return '未下单';
  }
  return customer.cooperationDays > 0
    ? `${customer.cooperationDays} 天`
    : '首单客户';
}

function CustomerActions({
  customer,
  onView,
  onEdit,
  onDelete,
}: {
  customer: Customer;
  onView: (customer: Customer) => void;
  onEdit: (customer: Customer) => void;
  onDelete?: (customer: Customer) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg"
          onClick={event => event.stopPropagation()}
          aria-label="客户操作"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        <DropdownMenuItem
          onClick={event => {
            event.stopPropagation();
            onView(customer);
          }}
        >
          <Eye className="mr-2 h-4 w-4" />
          查看详情
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={event => {
            event.stopPropagation();
            onEdit(customer);
          }}
        >
          <Edit className="mr-2 h-4 w-4" />
          编辑资料
        </DropdownMenuItem>
        {onDelete && (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={event => {
              event.stopPropagation();
              onDelete(customer);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            删除客户
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ERPCustomerList({
  customers,
  pagination,
  isLoading = false,
  onCreateNew,
  onViewDetail,
  onEdit,
  onDelete,
  onPageChange,
  isRefreshing = false,
}: ERPCustomerListProps) {
  const router = useRouter();

  const handleCreateNew = () =>
    onCreateNew ? onCreateNew() : router.push('/customers/create');
  const handleViewDetail = (customer: Customer) =>
    onViewDetail
      ? onViewDetail(customer)
      : router.push(`/customers/${customer.id}`);
  const handleEdit = (customer: Customer) =>
    onEdit ? onEdit(customer) : router.push(`/customers/${customer.id}/edit`);
  const handleDelete = (customer: Customer) => onDelete?.(customer);

  const handlePageChange = (page: number) => {
    if (onPageChange) {
      onPageChange(page);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (page > 1) params.set('page', page.toString());
    else params.delete('page');
    router.push(`/customers?${params.toString()}`);
  };

  if (isLoading && customers.length === 0) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-lg border bg-white">
        <EmptyState
          title="正在加载客户资料"
          icon={<Loader2 className="h-9 w-9 animate-spin text-slate-300" />}
          compact
        />
      </div>
    );
  }

  if (!isLoading && customers.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-white p-10 text-center">
        <EmptyState
          title="暂无客户资料"
          description="先新增客户，开单时可直接选择"
          action={
            <Button onClick={handleCreateNew} className="h-10 rounded-lg">
              <Plus className="mr-2 h-4 w-4" />
              新增客户
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="relative space-y-4" aria-busy={isRefreshing}>
      {isRefreshing && (
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-center rounded-lg border bg-white/95 px-3 py-2 text-xs font-medium text-[hsl(var(--color-text-secondary))] shadow-sm">
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin text-[hsl(var(--color-primary))]" />
          正在更新列表
        </div>
      )}

      <div
        className={cn(
          'hidden overflow-x-auto rounded-lg border bg-white transition-opacity lg:block',
          isRefreshing && 'opacity-60'
        )}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[220px]">客户名称</TableHead>
              <TableHead className="w-[140px]">联系电话</TableHead>
              <TableHead className="min-w-[240px]">地址</TableHead>
              <TableHead className="w-[100px] text-right">销售单数</TableHead>
              <TableHead className="w-[100px] text-right">退货次数</TableHead>
              <TableHead className="w-[120px]">合作情况</TableHead>
              <TableHead className="w-[120px]">建档日期</TableHead>
              <TableHead className="w-[90px] text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map(customer => (
              <TableRow
                key={customer.id}
                className="cursor-pointer"
                onClick={() => handleViewDetail(customer)}
              >
                <TableCell>
                  <div className="min-w-0">
                    <div className="font-medium text-[hsl(var(--color-text-primary))]">
                      {customer.name}
                    </div>
                    <div className="mt-1 text-xs text-[hsl(var(--color-text-tertiary))]">
                      编号后六位：
                      <CopyableText text={customer.id.slice(-6)} />
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {customer.phone ? (
                    <span className="font-mono text-sm">{customer.phone}</span>
                  ) : (
                    <span className="text-sm text-[hsl(var(--color-text-tertiary))]">
                      未填写
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div
                    className="max-w-[360px] truncate text-sm"
                    title={customer.address || '未填写地址'}
                  >
                    {customer.address || (
                      <span className="text-[hsl(var(--color-text-tertiary))]">
                        未填写地址
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {customer.transactionCount ?? customer.totalOrders ?? 0}
                </TableCell>
                <TableCell className="text-right">
                  {customer.returnOrderCount ?? 0}
                </TableCell>
                <TableCell className="text-sm">
                  {getCooperationText(customer)}
                </TableCell>
                <TableCell className="text-sm">
                  {formatDate(customer.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="flex justify-center">
                    <CustomerActions
                      customer={customer}
                      onView={handleViewDetail}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div
        className={cn(
          'grid gap-3 transition-opacity lg:hidden',
          isRefreshing && 'opacity-60'
        )}
      >
        {customers.map(customer => (
          <div
            key={customer.id}
            role="button"
            tabIndex={0}
            onClick={() => handleViewDetail(customer)}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleViewDetail(customer);
              }
            }}
            className="rounded-lg border bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 shrink-0 text-[hsl(var(--color-primary))]" />
                  <div className="truncate font-medium">{customer.name}</div>
                </div>
                <div className="mt-2 space-y-1.5 text-xs text-[hsl(var(--color-text-secondary))]">
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{customer.phone || '未填写电话'}</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="line-clamp-2">
                      {customer.address || '未填写地址'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>建档 {formatDate(customer.createdAt)}</span>
                  </div>
                </div>
              </div>
              <CustomerActions
                customer={customer}
                onView={handleViewDetail}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-center text-xs">
              <div>
                <div className="flex items-center justify-center gap-1 font-semibold text-[hsl(var(--color-text-primary))]">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  {customer.transactionCount ?? customer.totalOrders ?? 0}
                </div>
                <div className="mt-0.5 text-[hsl(var(--color-text-tertiary))]">
                  销售单数
                </div>
              </div>
              <div>
                <div className="font-semibold text-[hsl(var(--color-text-primary))]">
                  {customer.returnOrderCount ?? 0}
                </div>
                <div className="mt-0.5 text-[hsl(var(--color-text-tertiary))]">
                  退货次数
                </div>
              </div>
              <div>
                <div className="font-semibold text-[hsl(var(--color-text-primary))]">
                  {getCooperationText(customer)}
                </div>
                <div className="mt-0.5 text-[hsl(var(--color-text-tertiary))]">
                  合作情况
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {pagination && pagination.total > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-[hsl(var(--color-text-secondary))]">
            共
            <span className="mx-1 font-semibold text-[hsl(var(--color-text-primary))]">
              {pagination.total}
            </span>
            位客户
          </div>
          <Pagination
            pagination={pagination}
            onPageChange={handlePageChange}
            showRange={false}
            showTotal={false}
            disabled={isRefreshing}
          />
        </div>
      )}
    </div>
  );
}
