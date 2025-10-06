'use client';

import { useQuery } from '@tanstack/react-query';
import { Edit, Eye, MoreHorizontal, Plus, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useState } from 'react';

import { ContentLoading } from '@/components/common/loading';
import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { paginationConfig } from '@/lib/env';
import { queryKeys } from '@/lib/queryKeys';
import {
  type ReturnOrder,
  type ReturnOrderQueryParams,
  RETURN_ORDER_STATUS_LABELS,
  RETURN_ORDER_TYPE_LABELS,
  RETURN_PROCESS_TYPE_LABELS,
} from '@/lib/types/return-order';

interface ERPReturnOrderListProps {
  onCreateNew?: () => void;
  onViewDetail?: (returnOrder: ReturnOrder) => void;
  onEdit?: (returnOrder: ReturnOrder) => void;
  onDelete?: (returnOrder: ReturnOrder) => void;
}

/**
 * ERP风格的退货订单管理列表组件
 * 采用紧凑布局，符合中国ERP系统用户习惯
 */
export function ERPReturnOrderList({
  onCreateNew,
  onViewDetail,
  onEdit,
  onDelete,
}: ERPReturnOrderListProps) {
  const router = useRouter();

  // 查询参数状态
  const [queryParams, setQueryParams] = useState<ReturnOrderQueryParams>({
    page: 1,
    limit: paginationConfig.defaultPageSize,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  // 获取退货订单数据
  const {
    data: queryData,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.returnOrders.list(queryParams),
    queryFn: async () =>
      // 待办：实现真实的退货订单API
      // 目前返回空数据，等待后端API实现
      ({
        success: true,
        data: {
          returnOrders: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 1,
          },
        },
      }),
    staleTime: 5 * 60 * 1000, // 5分钟内认为数据是新鲜的
    refetchOnWindowFocus: false,
  });

  // 临时模拟数据（当API不可用时）
  const mockData = {
    success: true,
    data: {
      returnOrders: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1,
      },
    },
  };

  // 如果API失败，使用模拟数据
  const displayData = error ? mockData : queryData;

  // 处理搜索
  const handleSearch = React.useCallback((search: string) => {
    setQueryParams(prev => ({
      ...prev,
      search: search || undefined,
      page: 1,
    }));
  }, []);

  // 统一处理筛选器变更
  const handleFilterChange = React.useCallback(
    (key: string, value: string | undefined) => {
      if (key === 'status') {
        setQueryParams(prev => ({
          ...prev,
          status: value === 'all' || !value ? undefined : value,
          page: 1,
        }));
      } else if (key === 'sortBy') {
        setQueryParams(prev => ({
          ...prev,
          sortBy: value || 'createdAt',
          page: 1,
        }));
      }
    },
    []
  );

  // 处理新建
  const handleCreateNew = () => {
    if (onCreateNew) {
      onCreateNew();
    } else {
      router.push('/return-orders/create');
    }
  };

  // 处理查看详情
  const handleViewDetail = (returnOrder: ReturnOrder) => {
    if (onViewDetail) {
      onViewDetail(returnOrder);
    } else {
      router.push(`/return-orders/${returnOrder.id}`);
    }
  };

  // 处理编辑
  const handleEdit = (returnOrder: ReturnOrder) => {
    if (onEdit) {
      onEdit(returnOrder);
    } else {
      router.push(`/return-orders/${returnOrder.id}/edit`);
    }
  };

  // 处理删除
  const handleDelete = (returnOrder: ReturnOrder) => {
    if (onDelete) {
      onDelete(returnOrder);
    }
  };

  // 格式化金额
  const formatAmount = (amount: number) =>
    new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 2,
    }).format(amount);

  // 格式化日期
  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'secondary';
      case 'submitted':
        return 'default';
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      case 'processing':
        return 'default';
      case 'completed':
        return 'default';
      case 'cancelled':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  // 如果有真实数据错误且没有模拟数据，显示错误
  if (error && !displayData) {
    return (
      <div className="space-y-4">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
          <CardContent className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
                  <TrendingDown className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    退货订单管理
                  </h1>
                  <p className="text-sm text-gray-600">
                    管理客户退货订单，处理退货申请和退款流程
                  </p>
                </div>
              </div>
              <Link href="/return-orders/create">
                <Button
                  size="lg"
                  className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  新建退货
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg shadow-gray-200/50">
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              加载退货订单失败: {error.message}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 页面标题卡片 */}
      <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
        <CardContent className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
                <TrendingDown className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                  退货订单管理
                </h1>
                <p className="text-sm text-gray-600">
                  管理客户退货订单，处理退货申请和退款流程
                </p>
              </div>
            </div>
            <Link href="/return-orders/create">
              <Button
                size="lg"
                className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
              >
                <Plus className="mr-2 h-4 w-4" />
                新建退货
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* 搜索和筛选 */}
      <Card className="shadow-md shadow-gray-200/50">
        <CardContent className="pt-6">
          <UnifiedSearchBar
            // 搜索配置
            searchValue={queryParams.search || ''}
            onSearchChange={handleSearch}
            searchPlaceholder="搜索退货单号或客户名称..."
            debounceDelay={400}
            compact={true}
            // 筛选器配置
            filters={[
              {
                key: 'status',
                label: '状态',
                options: [
                  { label: '全部状态', value: 'all' },
                  { label: '草稿', value: 'draft' },
                  { label: '已提交', value: 'submitted' },
                  { label: '已审核', value: 'approved' },
                  { label: '已拒绝', value: 'rejected' },
                  { label: '处理中', value: 'processing' },
                  { label: '已完成', value: 'completed' },
                  { label: '已取消', value: 'cancelled' },
                ],
                width: 'w-24',
              },
              {
                key: 'sortBy',
                label: '排序',
                options: [
                  { label: '创建时间', value: 'createdAt' },
                  { label: '退货单号', value: 'returnNumber' },
                  { label: '退货金额', value: 'totalAmount' },
                  { label: '订单状态', value: 'status' },
                ],
                width: 'w-24',
              },
            ]}
            filterValues={{
              status: queryParams.status || 'all',
              sortBy: queryParams.sortBy || 'createdAt',
            }}
            onFilterChange={handleFilterChange}
          />
        </CardContent>
      </Card>

      {/* 数据表格 */}
      <div className="overflow-hidden rounded-lg border bg-white shadow-lg shadow-gray-200/50">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>退货单号</TableHead>
              <TableHead>关联销售单</TableHead>
              <TableHead>客户名称</TableHead>
              <TableHead>退货类型</TableHead>
              <TableHead>处理方式</TableHead>
              <TableHead>退货金额</TableHead>
              <TableHead>订单状态</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9}>
                  <ContentLoading text="加载退货订单数据..." />
                </TableCell>
              </TableRow>
            ) : displayData?.data.returnOrders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-muted-foreground h-16 text-center text-xs"
                >
                  暂无退货订单数据
                </TableCell>
              </TableRow>
            ) : (
              displayData?.data.returnOrders.map((returnOrder: ReturnOrder) => (
                <TableRow
                  key={returnOrder.id}
                  className="cursor-pointer transition-colors hover:bg-blue-50/50"
                  onClick={() => handleViewDetail(returnOrder)}
                >
                  <TableCell className="font-mono font-medium text-blue-600">
                    {returnOrder.returnNumber}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono">
                    {returnOrder.salesOrder?.orderNumber || '-'}
                  </TableCell>
                  <TableCell className="font-medium text-gray-900">
                    {returnOrder.customer?.name || '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {RETURN_ORDER_TYPE_LABELS[returnOrder.type]}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {RETURN_PROCESS_TYPE_LABELS[returnOrder.processType]}
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatAmount(returnOrder.totalAmount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(returnOrder.status)}>
                      {RETURN_ORDER_STATUS_LABELS[returnOrder.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(returnOrder.createdAt)}
                  </TableCell>
                  <TableCell className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={e => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={e => {
                            e.stopPropagation();
                            handleViewDetail(returnOrder);
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          查看详情
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={e => {
                            e.stopPropagation();
                            handleEdit(returnOrder);
                          }}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          编辑
                        </DropdownMenuItem>
                        {onDelete && (
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={e => {
                              e.stopPropagation();
                              handleDelete(returnOrder);
                            }}
                          >
                            <TrendingDown className="mr-2 h-4 w-4" />
                            删除
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
