'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  Edit,
  Eye,
  Filter,
  MoreHorizontal,
  Package,
  Plus,
  RotateCcw,
  Search,
  TrendingDown,
  User,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { getReturnOrders, returnOrderQueryKeys } from '@/lib/api/return-orders';
import type {
  ReturnOrder,
  ReturnOrderQueryParams,
} from '@/lib/types/return-order';
import {
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
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  // 获取退货订单数据
  const { data, isLoading, error } = useQuery({
    queryKey: returnOrderQueryKeys.list(queryParams),
    queryFn: () => getReturnOrders(queryParams),
    // 临时使用模拟数据，直到API实现
    retry: false,
    meta: {
      errorBoundary: false,
    },
  });

  // 临时模拟数据（当API不可用时）
  const mockData = {
    success: true,
    data: {
      returnOrders: [
        {
          id: '1',
          returnNumber: 'RT202501001',
          salesOrderId: 'SO202501001',
          customerId: 'customer1',
          userId: 'user1',
          type: 'quality_issue' as const,
          processType: 'refund' as const,
          status: 'submitted' as const,
          reason: '产品质量问题，需要退货处理',
          totalAmount: 1580.0,
          refundAmount: 1580.0,
          remarks: '客户反馈产品有质量缺陷',
          submittedAt: '2025-01-15T10:30:00Z',
          createdAt: '2025-01-15T09:00:00Z',
          updatedAt: '2025-01-15T10:30:00Z',
          salesOrder: {
            id: 'SO202501001',
            orderNumber: 'SO202501001',
            customerId: 'customer1',
            userId: 'user1',
            status: 'completed' as const,
            totalAmount: 1580.0,
            createdAt: '2025-01-10T14:20:00Z',
            updatedAt: '2025-01-12T16:45:00Z',
          },
          customer: {
            id: 'customer1',
            name: '北京科技有限公司',
            phone: '010-88888888',
            address: '北京市朝阳区科技园区',
            createdAt: '2024-12-01T00:00:00Z',
            updatedAt: '2024-12-01T00:00:00Z',
          },
        },
        {
          id: '2',
          returnNumber: 'RT202501002',
          salesOrderId: 'SO202501002',
          customerId: 'customer2',
          userId: 'user1',
          type: 'wrong_product' as const,
          processType: 'exchange' as const,
          status: 'approved' as const,
          reason: '发错产品，需要换货',
          totalAmount: 2350.0,
          refundAmount: 0.0,
          remarks: '已安排换货处理',
          submittedAt: '2025-01-16T14:20:00Z',
          approvedAt: '2025-01-16T15:30:00Z',
          createdAt: '2025-01-16T13:45:00Z',
          updatedAt: '2025-01-16T15:30:00Z',
          salesOrder: {
            id: 'SO202501002',
            orderNumber: 'SO202501002',
            customerId: 'customer2',
            userId: 'user1',
            status: 'completed' as const,
            totalAmount: 2350.0,
            createdAt: '2025-01-12T09:15:00Z',
            updatedAt: '2025-01-14T11:20:00Z',
          },
          customer: {
            id: 'customer2',
            name: '上海贸易公司',
            phone: '021-66666666',
            address: '上海市浦东新区商务区',
            createdAt: '2024-11-15T00:00:00Z',
            updatedAt: '2024-11-15T00:00:00Z',
          },
        },
        {
          id: '3',
          returnNumber: 'RT202501003',
          salesOrderId: 'SO202501003',
          customerId: 'customer3',
          userId: 'user1',
          type: 'customer_change' as const,
          processType: 'refund' as const,
          status: 'processing' as const,
          reason: '客户需求变更，申请退货',
          totalAmount: 890.0,
          refundAmount: 890.0,
          remarks: '正在处理退款',
          submittedAt: '2025-01-17T11:10:00Z',
          approvedAt: '2025-01-17T14:20:00Z',
          createdAt: '2025-01-17T10:30:00Z',
          updatedAt: '2025-01-17T14:20:00Z',
          salesOrder: {
            id: 'SO202501003',
            orderNumber: 'SO202501003',
            customerId: 'customer3',
            userId: 'user1',
            status: 'completed' as const,
            totalAmount: 890.0,
            createdAt: '2025-01-14T16:30:00Z',
            updatedAt: '2025-01-16T10:15:00Z',
          },
          customer: {
            id: 'customer3',
            name: '深圳制造企业',
            phone: '0755-99999999',
            address: '深圳市南山区高新园',
            createdAt: '2024-10-20T00:00:00Z',
            updatedAt: '2024-10-20T00:00:00Z',
          },
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1,
      },
    },
  };

  // 如果API失败，使用模拟数据
  const displayData = error ? mockData : data;

  // 处理搜索
  const handleSearch = (search: string) => {
    setQueryParams(prev => ({
      ...prev,
      search: search || undefined,
      page: 1,
    }));
  };

  // 处理状态筛选
  const handleStatusFilter = (status: string) => {
    setQueryParams(prev => ({
      ...prev,
      status: status === 'all' ? undefined : (status as any),
      page: 1,
    }));
  };

  // 处理排序
  const handleSort = (sortBy: string) => {
    setQueryParams(prev => ({
      ...prev,
      sortBy: sortBy as any,
      page: 1,
    }));
  };

  // 重置筛选
  const handleReset = () => {
    setQueryParams({
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  };

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
  const formatAmount = (amount: number) => new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 2,
    }).format(amount);

  // 格式化日期
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('zh-CN', {
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
      <div className="rounded border bg-card">
        <div className="border-b bg-muted/30 px-3 py-2">
          <h3 className="text-sm font-medium">退货订单管理</h3>
        </div>
        <div className="px-3 py-8">
          <div className="text-center text-xs text-muted-foreground">
            加载失败: {error.message}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded border bg-card">
      {/* ERP标准工具栏 */}
      <div className="border-b bg-muted/30 px-3 py-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">退货订单管理</h3>
          <div className="text-xs text-muted-foreground">
            {displayData?.data.pagination
              ? `共 ${displayData.data.pagination.total} 条记录`
              : ''}
          </div>
        </div>
      </div>

      {/* 操作工具栏 */}
      <div className="border-b bg-muted/10 px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => router.back()}
            >
              <ArrowLeft className="mr-1 h-3 w-3" />
              返回
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-7" onClick={handleCreateNew}>
              <Plus className="mr-1 h-3 w-3" />
              新建退货
            </Button>
          </div>
        </div>
      </div>

      {/* 筛选工具栏 */}
      <div className="border-b bg-muted/5 px-3 py-2">
        <div className="flex items-center gap-2">
          <Filter className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">筛选条件</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">搜索订单</span>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="退货单号或客户名称"
                className="h-7 w-48 pl-7 text-xs"
                value={queryParams.search || ''}
                onChange={e => handleSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">订单状态</span>
            <Select
              value={queryParams.status || 'all'}
              onValueChange={handleStatusFilter}
            >
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="submitted">已提交</SelectItem>
                <SelectItem value="approved">已审核</SelectItem>
                <SelectItem value="rejected">已拒绝</SelectItem>
                <SelectItem value="processing">处理中</SelectItem>
                <SelectItem value="completed">已完成</SelectItem>
                <SelectItem value="cancelled">已取消</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">排序方式</span>
            <Select
              value={queryParams.sortBy || 'createdAt'}
              onValueChange={handleSort}
            >
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">创建时间</SelectItem>
                <SelectItem value="returnNumber">退货单号</SelectItem>
                <SelectItem value="totalAmount">退货金额</SelectItem>
                <SelectItem value="status">订单状态</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={handleReset}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              重置
            </Button>
          </div>
        </div>
      </div>

      {/* 数据表格 */}
      <div className="border-b bg-muted/5 px-3 py-1">
        <div className="text-xs text-muted-foreground">退货订单列表</div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead className="h-8 px-2">退货单号</TableHead>
              <TableHead className="h-8 px-2">关联销售单</TableHead>
              <TableHead className="h-8 px-2">客户名称</TableHead>
              <TableHead className="h-8 px-2">退货类型</TableHead>
              <TableHead className="h-8 px-2">处理方式</TableHead>
              <TableHead className="h-8 px-2">退货金额</TableHead>
              <TableHead className="h-8 px-2">订单状态</TableHead>
              <TableHead className="h-8 px-2">创建时间</TableHead>
              <TableHead className="h-8 px-2 text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell className="h-8 px-2">
                    <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell className="h-8 px-2">
                    <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell className="h-8 px-2">
                    <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell className="h-8 px-2">
                    <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell className="h-8 px-2">
                    <div className="h-3 w-12 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell className="h-8 px-2">
                    <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell className="h-8 px-2">
                    <div className="h-3 w-12 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell className="h-8 px-2">
                    <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                  </TableCell>
                  <TableCell className="h-8 px-2">
                    <div className="h-3 w-8 animate-pulse rounded bg-muted" />
                  </TableCell>
                </TableRow>
              ))
            ) : displayData?.data.returnOrders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="h-16 text-center text-xs text-muted-foreground"
                >
                  暂无退货订单数据
                </TableCell>
              </TableRow>
            ) : (
              displayData?.data.returnOrders.map(returnOrder => (
                <TableRow key={returnOrder.id} className="text-xs">
                  <TableCell className="h-8 px-2">
                    <div className="flex items-center gap-1">
                      <Package className="h-3 w-3 text-muted-foreground" />
                      <span className="font-mono">
                        {returnOrder.returnNumber}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="h-8 px-2">
                    <span className="font-mono text-muted-foreground">
                      {returnOrder.salesOrder?.orderNumber || '-'}
                    </span>
                  </TableCell>
                  <TableCell className="h-8 px-2">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span>{returnOrder.customer?.name || '-'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="h-8 px-2">
                    <span className="text-muted-foreground">
                      {RETURN_ORDER_TYPE_LABELS[returnOrder.type]}
                    </span>
                  </TableCell>
                  <TableCell className="h-8 px-2">
                    <span className="text-muted-foreground">
                      {RETURN_PROCESS_TYPE_LABELS[returnOrder.processType]}
                    </span>
                  </TableCell>
                  <TableCell className="h-8 px-2">
                    <div className="flex items-center gap-1">
                      <TrendingDown className="h-3 w-3 text-muted-foreground" />
                      <span className="font-mono">
                        {formatAmount(returnOrder.totalAmount)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="h-8 px-2">
                    <Badge
                      variant={getStatusColor(returnOrder.status)}
                      className="text-xs"
                    >
                      {RETURN_ORDER_STATUS_LABELS[returnOrder.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="h-8 px-2">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span>{formatDate(returnOrder.createdAt)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="h-8 px-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-6 w-6 p-0">
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-xs">
                        <DropdownMenuItem
                          onClick={() => handleViewDetail(returnOrder)}
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          查看详情
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleEdit(returnOrder)}
                        >
                          <Edit className="mr-1 h-3 w-3" />
                          编辑
                        </DropdownMenuItem>
                        {onDelete && (
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDelete(returnOrder)}
                          >
                            <TrendingDown className="mr-1 h-3 w-3" />
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
