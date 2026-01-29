import {
  Briefcase,
  Calendar,
  Clock,
  Edit,
  Eye,
  Loader2,
  MapPin,
  MoreHorizontal,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Pagination } from '@/components/ui/pagination';
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
  onCreateNew?: () => void;
  onViewDetail?: (customer: Customer) => void;
  onEdit?: (customer: Customer) => void;
  onDelete?: (customer: Customer) => void;
  onPageChange?: (page: number) => void;
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
  const handleDelete = (customer: Customer) => onDelete && onDelete(customer);

  const handlePageChange = (page: number) => {
    if (onPageChange) {
      onPageChange(page);
    } else {
      const params = new URLSearchParams(window.location.search);
      if (page > 1) params.set('page', page.toString());
      else params.delete('page');
      router.push(`/customers?${params.toString()}`);
    }
  };

  if (isLoading && customers.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-3xl border border-white bg-white/40 backdrop-blur-md">
        <EmptyState
          title="正在同步客户中枢..."
          icon={<Loader2 className="h-10 w-10 animate-spin text-slate-300" />}
          compact
        />
      </div>
    );
  }

  if (!isLoading && customers.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white/20 p-20 text-center">
        <EmptyState
          title="暂无往来客户登记"
          description="开始建立您的业务中枢"
          action={
            <Button
              onClick={handleCreateNew}
              className="h-12 rounded-2xl bg-slate-900 px-8 font-black"
            >
              登记首位客户
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* List Container */}
      <div className="grid gap-4">
        {customers.map((customer, index) => (
          <div
            key={customer.id}
            onClick={() => handleViewDetail(customer)}
            className={cn(
              'group relative flex flex-col gap-6 rounded-[2rem] border border-white bg-white/60 p-6 backdrop-blur-xl transition-all duration-500',
              'cursor-pointer hover:-translate-y-1 hover:bg-white hover:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)]',
              'animate-in fade-in slide-in-from-bottom-4',
              `duration-${(index + 1) * 100}`
            )}
          >
            {/* Main Content Info */}
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              {/* Left: Identity Section */}
              <div className="flex min-w-[300px] items-center gap-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-xl transition-transform duration-500 group-hover:scale-110">
                  <User className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-black tracking-tight text-slate-900 transition-colors group-hover:text-blue-600">
                    {customer.name}
                  </h3>
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      合作始于{' '}
                      {formatDateTime(customer.createdAt).split(' ')[0]}
                    </span>
                    <span className="h-1 w-1 rounded-full bg-slate-200" />
                    <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                      ID: {customer.id.slice(-6)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Middle: Contact & Status */}
              <div className="flex flex-wrap items-center gap-4 lg:flex-1 lg:px-8">
                <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-1.5">
                  <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-sm font-bold text-slate-600">
                    {customer.phone || '未留电话'}
                  </span>
                </div>
                <div className="flex max-w-[240px] items-center gap-2 truncate rounded-xl border border-slate-100 bg-slate-50 px-3 py-1.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span className="truncate text-sm font-bold text-slate-600">
                    {customer.address || '无登记地址'}
                  </span>
                </div>
              </div>

              {/* Right: Business Insights */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex min-w-[80px] flex-col items-center justify-center rounded-2xl border border-blue-100/50 bg-blue-50/50 px-4 py-3">
                  <span className="mb-1 text-xs font-black tracking-widest text-blue-600 uppercase">
                    交易次数
                  </span>
                  <div className="flex items-center gap-1 text-blue-700">
                    <TrendingUp className="h-3 w-3" />
                    <span className="text-sm font-black">
                      {customer.transactionCount || 0}
                    </span>
                  </div>
                </div>
                <div className="flex min-w-[80px] flex-col items-center justify-center rounded-2xl border border-emerald-100/50 bg-emerald-50/50 px-4 py-3">
                  <span className="mb-1 text-xs font-black tracking-widest text-emerald-600 uppercase">
                    合作天数
                  </span>
                  <div className="flex items-center gap-1 text-emerald-700">
                    <Calendar className="h-3 w-3" />
                    <span className="text-sm font-black">
                      {customer.cooperationDays || 0}天
                    </span>
                  </div>
                </div>
                <div className="flex min-w-[80px] flex-col items-center justify-center rounded-2xl border border-rose-100/50 bg-rose-50/50 px-4 py-3">
                  <span className="mb-1 text-xs font-black tracking-widest text-rose-600 uppercase">
                    退货频率
                  </span>
                  <div className="flex items-center gap-1 text-rose-700">
                    <TrendingDown className="h-3 w-3" />
                    <span className="text-sm font-black">
                      {customer.returnOrderCount || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Menu */}
              <div className="hidden lg:block">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-xl hover:bg-slate-100"
                      onClick={e => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-5 w-5 text-slate-400" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="rounded-2xl border-none p-2 shadow-2xl"
                  >
                    <DropdownMenuItem
                      className="rounded-xl py-2.5 font-bold"
                      onClick={e => {
                        e.stopPropagation();
                        handleViewDetail(customer);
                      }}
                    >
                      <Eye className="mr-2 h-4 w-4" /> 察看资产详情
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="rounded-xl py-2.5 font-bold"
                      onClick={e => {
                        e.stopPropagation();
                        handleEdit(customer);
                      }}
                    >
                      <Edit className="mr-2 h-4 w-4" /> 修订档案
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="rounded-xl py-2.5 font-bold text-rose-600 focus:bg-rose-500 focus:text-white"
                      onClick={e => {
                        e.stopPropagation();
                        handleDelete(customer);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> 归档并删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Status Badges Overlay (Optional refinement) */}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'rounded-full px-3 py-1 text-[10px] font-black tracking-[0.2em] uppercase',
                  customer.cooperationDays && customer.cooperationDays > 30
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-100 text-slate-400'
                )}
              >
                {customer.cooperationDays && customer.cooperationDays > 30
                  ? '活跃账户'
                  : '新签合作'}
              </div>
              {customer.returnOrderCount && customer.returnOrderCount > 5 && (
                <div className="rounded-full bg-rose-100 px-3 py-1 text-xs font-black tracking-[0.2em] text-rose-700 uppercase">
                  高退货风险
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Container */}
      {pagination && pagination.total > 0 && (
        <div className="flex items-center justify-center py-10">
          <div className="group flex h-16 items-center gap-6 rounded-3xl border border-white bg-white/60 px-8 py-3 shadow-sm backdrop-blur-xl transition-all hover:bg-white hover:shadow-xl">
            <div className="mr-2 flex items-center gap-1.5 border-r border-slate-100 pr-6">
              <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                数据范围
              </span>
              <span className="text-sm font-black text-slate-900">
                {pagination.total} 位合作伙伴
              </span>
            </div>
            <Pagination
              pagination={pagination}
              onPageChange={handlePageChange}
              showRange={false}
              showTotal={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}
