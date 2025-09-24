'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  Filter,
  Package,
  Plus,
  RotateCcw,
  User,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
  OUTBOUND_TYPE_LABELS,
  OUTBOUND_TYPE_VARIANTS,
  type OutboundRecord,
  type OutboundType,
} from '@/lib/types/inventory';
import { formatDateTimeCN } from '@/lib/utils/datetime';

interface ERPOutboundRecordsProps {
  onCreateNew?: () => void;
}

/**
 * ERP风格的出库记录组件
 * 采用紧凑布局，符合中国ERP系统用户习惯
 */
export function ERPOutboundRecords({ onCreateNew }: ERPOutboundRecordsProps) {
  const router = useRouter();

  // 筛选状态
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    type: '' as OutboundType | '',
  });

  // 获取出库记录数据
  const { data, isLoading } = useQuery({
    queryKey: ['outbound-records', filters],
    queryFn: async () => {
      // 模拟API调用 - 实际项目中替换为真实API
      const mockData: OutboundRecord[] = [
        {
          id: '1',
          recordNumber: 'OUT001',
          type: 'sales_outbound',
          productId: 'prod1',
          quantity: 50,
          userId: 'user1',
          remarks: '销售订单出库',
          createdAt: '2025-09-20T14:30:00Z',
          product: {
            id: 'prod1',
            name: '豪华大理石纹瓷砖',
            code: 'TEST001',
            unit: '片',
            categoryId: 'cat1',
            supplierId: 'sup1',
            createdAt: '2025-09-20T10:00:00Z',
            updatedAt: '2025-09-20T10:00:00Z',
          },
          user: {
            id: 'user1',
            name: '系统管理员',
            email: 'admin@example.com',
            role: 'admin',
            createdAt: '2025-09-20T10:00:00Z',
            updatedAt: '2025-09-20T10:00:00Z',
          },
        },
        {
          id: '2',
          recordNumber: 'OUT002',
          type: 'normal_outbound',
          productId: 'prod2',
          quantity: 25,
          userId: 'user1',
          remarks: '正常出库',
          createdAt: '2025-09-19T16:45:00Z',
          product: {
            id: 'prod2',
            name: '测试分类重置问题',
            code: '3605',
            unit: '片',
            categoryId: 'cat1',
            supplierId: 'sup1',
            createdAt: '2025-09-19T10:00:00Z',
            updatedAt: '2025-09-19T10:00:00Z',
          },
          user: {
            id: 'user1',
            name: '系统管理员',
            email: 'admin@example.com',
            role: 'admin',
            createdAt: '2025-09-20T10:00:00Z',
            updatedAt: '2025-09-20T10:00:00Z',
          },
        },
      ];

      // 应用筛选
      let filteredData = mockData;

      if (filters.type) {
        filteredData = filteredData.filter(
          record => record.type === filters.type
        );
      }

      if (filters.startDate) {
        filteredData = filteredData.filter(
          record => new Date(record.createdAt) >= new Date(filters.startDate)
        );
      }

      if (filters.endDate) {
        filteredData = filteredData.filter(
          record => new Date(record.createdAt) <= new Date(filters.endDate)
        );
      }

      return {
        data: filteredData,
        pagination: {
          page: 1,
          limit: 50,
          total: filteredData.length,
          totalPages: 1,
        },
      };
    },
  });

  const outboundRecords = data?.data || [];

  // 重置筛选
  const resetFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      type: '',
    });
  };

  // 处理创建新出库
  const handleCreateNew = () => {
    if (onCreateNew) {
      onCreateNew();
    } else {
      router.push('/inventory/outbound/create');
    }
  };

  return (
    <div className="rounded border bg-card">
      {/* ERP标准工具栏 */}
      <div className="border-b bg-muted/30 px-3 py-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">出库记录</h3>
          <div className="text-xs text-muted-foreground">
            {data?.pagination ? `共 ${data.pagination.total} 条记录` : ''}
          </div>
        </div>
      </div>

      {/* 操作按钮区 */}
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
              产品出库
            </Button>
          </div>
        </div>
      </div>

      {/* 筛选区域 */}
      <div className="border-b bg-muted/5 px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <Filter className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">筛选条件</span>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">开始日期</label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={e =>
                setFilters(prev => ({ ...prev, startDate: e.target.value }))
              }
              className="h-7 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">结束日期</label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={e =>
                setFilters(prev => ({ ...prev, endDate: e.target.value }))
              }
              className="h-7 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">出库类型</label>
            <Select
              value={filters.type || 'all'}
              onValueChange={value =>
                setFilters(prev => ({
                  ...prev,
                  type: value === 'all' ? '' : (value as OutboundType),
                }))
              }
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="全部类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="normal_outbound">正常出库</SelectItem>
                <SelectItem value="sales_outbound">销售出库</SelectItem>
                <SelectItem value="adjust_outbound">调整出库</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={resetFilters}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              重置
            </Button>
          </div>
        </div>
      </div>

      {/* 表格区域 */}
      <div className="px-3 py-2">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          出库记录列表
        </div>
        <div className="rounded border">
          <Table>
            <TableHeader>
              <TableRow className="h-8">
                <TableHead className="h-8 px-2 text-xs">产品信息</TableHead>
                <TableHead className="h-8 px-2 text-xs">操作类型</TableHead>
                <TableHead className="h-8 px-2 text-xs">数量</TableHead>
                <TableHead className="h-8 px-2 text-xs">操作人</TableHead>
                <TableHead className="h-8 px-2 text-xs">操作时间</TableHead>
                <TableHead className="h-8 px-2 text-xs">备注</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-10 text-center text-xs text-muted-foreground"
                  >
                    加载中...
                  </TableCell>
                </TableRow>
              ) : outboundRecords.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-10 text-center text-xs text-muted-foreground"
                  >
                    暂无出库记录
                  </TableCell>
                </TableRow>
              ) : (
                outboundRecords.map(record => (
                  <TableRow key={record.id} className="h-10">
                    <TableCell className="px-2 py-1">
                      <div className="flex items-center gap-2">
                        <Package className="h-3 w-3 text-muted-foreground" />
                        <div>
                          <div className="text-xs font-medium">
                            {record.product?.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            编码: {record.product?.code}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-1">
                      <Badge
                        variant={OUTBOUND_TYPE_VARIANTS[record.type]}
                        className="text-xs"
                      >
                        {OUTBOUND_TYPE_LABELS[record.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-2 py-1 text-xs font-medium">
                      -{record.quantity}
                      {record.product?.unit}
                    </TableCell>
                    <TableCell className="px-2 py-1">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs">{record.user?.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-1">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs">
                          {formatDateTimeCN(record.createdAt)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-1 text-xs">
                      {record.remarks || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
