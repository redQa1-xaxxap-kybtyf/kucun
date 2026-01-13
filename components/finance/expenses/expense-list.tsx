'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ArrowUpDown,
    Eye,
    FileText,
    Package,
    Pencil,
    Receipt,
    ShoppingCart,
    Trash2,
    Truck,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { CopyableText } from '@/components/common/copyable-text';
import { RelativeTime } from '@/components/common/relative-time';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { queryKeys } from '@/lib/queryKeys';
import {
    EXPENSE_RELATED_TYPE_LABELS,
    EXPENSE_STATUS_LABELS,
    EXPENSE_TYPE_LABELS,
    type ExpenseQueryParams,
    type ExpenseRecord,
} from '@/lib/types/expense';
import { cn } from '@/lib/utils';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';
import { formatCurrency } from '@/lib/utils/format';

// 顶层工具函数：表格视图和移动端卡片公用，避免作用域问题导致运行时错误
const getExpenseTypeBadgeVariant = (type: string) => {
  const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
    shipping: 'default',
    storage: 'secondary',
    labor: 'outline',
    travel: 'default',
    living: 'secondary',
    loading_unloading: 'outline',
    other: 'secondary',
  };
  return variants[type] || 'default';
};

const getStatusBadgeVariant = (status: string) => {
  const variants: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600 border-slate-200',
    approved: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    cancelled: 'bg-rose-50 text-rose-600 border-rose-200',
  };
  return variants[status] || 'bg-slate-100 text-slate-600 border-slate-200';
};

const getRelatedTypeIcon = (type: string) => {
  switch (type) {
    case 'sales_order':
      return <ShoppingCart className="h-3 w-3" />;
    case 'purchase_order':
      return <ShoppingCart className="h-3 w-3" />;
    case 'inbound':
      return <Package className="h-3 w-3" />;
    case 'outbound':
      return <Truck className="h-3 w-3" />;
    default:
      return <FileText className="h-3 w-3" />;
  }
};

interface ExpenseListProps {
  filters: ExpenseQueryParams;
  onPageChange: (page: number) => void;
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  hasManagePermission: boolean;
}

export function ExpenseList({
  filters,
  onPageChange,
  onSortChange,
  hasManagePermission,
}: ExpenseListProps) {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = React.useState<ExpenseRecord | null>(
    null
  );
  const [approveTarget, setApproveTarget] =
    React.useState<ExpenseRecord | null>(null);

  // 获取费用记录列表
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.finance.expensesList(filters),
    // ✅ 覆盖全局设置：每次挂载时都重新拉取，确保从创建/编辑页面返回后列表是最新的
    refetchOnMount: 'always',
    queryFn: async () => {
      const searchParams = new URLSearchParams();

      if (filters.page) searchParams.set('page', filters.page.toString());
      if (filters.pageSize)
        searchParams.set('pageSize', filters.pageSize.toString());
      if (filters.expenseType)
        searchParams.set('expenseType', filters.expenseType);
      if (filters.startDate) searchParams.set('startDate', filters.startDate);
      if (filters.endDate) searchParams.set('endDate', filters.endDate);
      if (filters.relatedType)
        searchParams.set('relatedType', filters.relatedType);
      if (filters.sortBy) searchParams.set('sortBy', filters.sortBy);
      if (filters.sortOrder) searchParams.set('sortOrder', filters.sortOrder);

      const response = await fetch(
        `/api/finance/expenses?${searchParams.toString()}`
      );

      if (!response.ok) {
        throw new Error('获取费用记录失败');
      }

      const result = await response.json();
      return result.data;
    },
  });

  // 审核费用记录
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(
        `/api/finance/expenses/${id}/approve`,
        getCsrfTokenHeader({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || '审核失败');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.expenses(),
        exact: false,
      });
    },
    onSettled: () => {
      setApproveTarget(null);
    },
  });

  // 删除费用记录
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(
        `/api/finance/expenses/${id}`,
        getCsrfTokenHeader({
          method: 'DELETE',
        })
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '删除失败');
      }

      return response.json();
    },
    onSuccess: () => {
      // ✅ P0修复: 使用 exact: false 失效所有以 ['finance', 'expenses'] 开头的查询
      // 修复前：只匹配 ['finance', 'expenses'] 精确键，无法匹配列表和统计查询
      // 修复后：匹配所有 ['finance', 'expenses', ...] 查询，包括列表和统计
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.expenses(),
        exact: false,
      });
    },
  });

  // 处理删除
  const handleDelete = React.useCallback((expense: ExpenseRecord) => {
    setDeleteTarget(expense);
  }, []);

  // 处理排序
  const handleSort = React.useCallback(
    (sortBy: string) => {
      const newSortOrder =
        filters.sortBy === sortBy && filters.sortOrder === 'desc'
          ? 'asc'
          : 'desc';
      onSortChange(sortBy, newSortOrder);
    },
    [filters.sortBy, filters.sortOrder, onSortChange]
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>费用记录列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>费用记录列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground py-8 text-center">
            加载失败，请稍后重试
          </div>
        </CardContent>
      </Card>
    );
  }

  const { records = [], pagination } = data || {};

  return (
    <>
      <Card className="overflow-hidden border-none shadow-[0_10px_40px_rgba(0,0,0,0.04)]">
        <CardHeader className="border-b border-slate-50 bg-slate-50/30">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-black tracking-tight text-slate-900 border-l-4 border-slate-900 pl-3 uppercase">
              费用开支明细台账
              {pagination && (
                <span className="ml-3 text-xs font-bold text-slate-400 uppercase tracking-widest">
                  共计 {pagination.total} 项流水记录
                </span>
              )}
            </CardTitle>
            <div className="flex gap-2">
               <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">账目实时同步中</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {records.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              暂无费用记录
            </div>
          ) : (
            <>
              {/* 桌面端：表格视图 */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-100">
                      <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-400 py-4 h-auto">流水编号</TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-400 py-4 h-auto text-center">分类/状态</TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-400 py-4 h-auto">费用事宜</TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-400 py-4 h-auto text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('expenseAmount')}
                          className="h-auto p-0 hover:bg-transparent font-black uppercase tracking-widest text-[11px] text-slate-400"
                        >
                          收支金额
                          <ArrowUpDown className="ml-1 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-400 py-4 h-auto text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('expenseDate')}
                          className="h-auto p-0 hover:bg-transparent font-black uppercase tracking-widest text-[11px] text-slate-400"
                        >
                          发生日期
                          <ArrowUpDown className="ml-1 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-400 py-4 h-auto">业务穿透</TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-400 py-4 h-auto text-right">管理操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((expense: ExpenseRecord) => (
                      <TableRow key={expense.id} className="hover:bg-slate-50/30 transition-colors group">
                        <TableCell className="py-4">
                          <div className="font-mono text-xs font-black text-slate-900">
                             <CopyableText text={expense.expenseNumber} />
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-4">
                           <div className="flex flex-col items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className="text-[10px] font-black uppercase border-slate-200 text-slate-500"
                              >
                                {EXPENSE_TYPE_LABELS[expense.expenseType]}
                              </Badge>
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-tighter border",
                                  getStatusBadgeVariant(expense.status)
                                )}
                              >
                                {EXPENSE_STATUS_LABELS[expense.status]}
                              </span>
                           </div>
                        </TableCell>
                        <TableCell className="py-4">
                           <div className="flex flex-col">
                              <span className="text-sm font-black text-slate-900 leading-tight mb-1">{expense.expenseName}</span>
                              {expense.remarks && (
                                 <span className="text-xs font-bold text-slate-400 max-w-[200px] truncate">{expense.remarks}</span>
                              )}
                           </div>
                        </TableCell>
                        <TableCell className="text-right py-4">
                          <span className="font-mono text-base font-black text-slate-900">
                             {formatCurrency(expense.expenseAmount)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center py-4">
                          <span className="text-xs font-bold text-slate-600">
                             <RelativeTime date={expense.expenseDate} />
                          </span>
                        </TableCell>
                        <TableCell className="py-4">
                          {expense.relatedType && expense.relatedNumber ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5 font-black text-xs text-slate-900">
                                {getRelatedTypeIcon(expense.relatedType)}
                                <CopyableText text={expense.relatedNumber} />
                              </div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {
                                  EXPENSE_RELATED_TYPE_LABELS[
                                    expense.relatedType as keyof typeof EXPENSE_RELATED_TYPE_LABELS
                                  ]
                                }
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs font-bold">未关联业务</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right py-4">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link href={`/finance/expenses/${expense.id}`}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            {hasManagePermission && (
                              <>
                                <Link
                                  href={`/finance/expenses/${expense.id}/edit`}
                                >
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900">
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </Link>
                                {expense.status === 'draft' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-xs font-black text-blue-600 hover:text-blue-700 uppercase"
                                    onClick={() => setApproveTarget(expense)}
                                    disabled={approveMutation.isPending}
                                  >
                                    审核生效
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-300 hover:text-rose-600"
                                  onClick={() => handleDelete(expense)}
                                  disabled={
                                    deleteMutation.isPending ||
                                    expense.status === 'approved'
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 移动端：卡片列表视图 */}
              <div className="mt-4 space-y-3 md:hidden">
                {records.map((expense: ExpenseRecord) => (
                  <ExpenseCard
                    key={expense.id}
                    expense={expense}
                    hasManagePermission={hasManagePermission}
                    onDelete={handleDelete}
                    onApprove={exp => setApproveTarget(exp)}
                  />
                ))}
              </div>

              {/* 分页 */}
              {pagination && pagination.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-muted-foreground text-sm">
                    第 {pagination.page} 页，共 {pagination.totalPages} 页
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onPageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                    >
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onPageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages}
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={open => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `确定要删除费用记录 ${deleteTarget.expenseNumber} 吗？此操作不可恢复。`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate(deleteTarget.id);
                }
                setDeleteTarget(null);
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!approveTarget}
        onOpenChange={open => {
          if (!open) {
            setApproveTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认审核</AlertDialogTitle>
            <AlertDialogDescription>
              {approveTarget
                ? `确定要审核费用记录 ${approveTarget.expenseNumber} 吗？审核后将不再允许修改类型、金额、日期和关联业务，只能修改备注。`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approveMutation.isPending}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (approveTarget) {
                  approveMutation.mutate(approveTarget.id);
                }
              }}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? '审核中...' : '确认审核'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ExpenseCard({
  expense,
  hasManagePermission,
  onDelete,
  onApprove,
}: {
  expense: ExpenseRecord;
  hasManagePermission: boolean;
  onDelete: (expense: ExpenseRecord) => void;
  onApprove: (expense: ExpenseRecord) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm active:scale-[0.98] transition-all group">
      {/* 装饰性背景 */}
      <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:scale-110 transition-transform">
        <Receipt size={64} />
      </div>

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-1">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">流水编号</div>
            <div className="font-mono text-xs font-black text-slate-900 leading-none">
              <CopyableText text={expense.expenseNumber} />
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
             <Badge
               variant="outline"
               className="text-[9px] font-black uppercase border-slate-200 text-slate-500 px-1.5 py-0"
             >
               {EXPENSE_TYPE_LABELS[expense.expenseType]}
             </Badge>
             <span
               className={cn(
                 "inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-tighter border",
                 getStatusBadgeVariant(expense.status)
               )}
             >
               {EXPENSE_STATUS_LABELS[expense.status]}
             </span>
          </div>
        </div>

        <div className="mb-5">
           <h4 className="text-sm font-black text-slate-900 leading-tight mb-1">{expense.expenseName}</h4>
           {expense.remarks && (
              <p className="text-xs font-bold text-slate-400 line-clamp-2">{expense.remarks}</p>
           )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 pt-4 border-t border-slate-50">
          <div className="space-y-1">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">收支金额</div>
            <div className="font-mono text-lg font-black text-slate-900">{formatCurrency(expense.expenseAmount)}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">业务日期</div>
            <div className="text-xs font-black text-slate-600">
               <RelativeTime date={expense.expenseDate} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
           {expense.relatedType && expense.relatedNumber ? (
              <div className="flex items-center gap-2">
                 <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                    {getRelatedTypeIcon(expense.relatedType)}
                 </div>
                 <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-900 leading-none mb-1 uppercase tracking-tighter">{expense.relatedNumber}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest line-clamp-1">
                       {EXPENSE_RELATED_TYPE_LABELS[expense.relatedType as keyof typeof EXPENSE_RELATED_TYPE_LABELS]}
                    </span>
                 </div>
              </div>
           ) : (
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">未关联资产</span>
           )}

           <div className="flex gap-1">
              <Link href={`/finance/expenses/${expense.id}`}>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400">
                  <Eye className="h-4 w-4" />
                </Button>
              </Link>
              {hasManagePermission && (
                <Link href={`/finance/expenses/${expense.id}/edit`}>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </Link>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
