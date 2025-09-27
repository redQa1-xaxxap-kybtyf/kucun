'use client';

import {
  Download,
  Eye,
  Filter,
  Receipt,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { paginationConfig } from '@/lib/env';

/**
 * 往来账单管理页面
 * 管理客户和供应商的综合账务往来
 */
export default function StatementsPage() {
  const router = useRouter();
  const [queryParams, setQueryParams] = React.useState({
    page: 1,
    limit: paginationConfig.defaultPageSize,
    search: '',
    type: 'customer' as 'customer' | 'supplier',
    sortBy: 'totalAmount',
    sortOrder: 'desc' as 'asc' | 'desc',
  });

  // 模拟数据 - 实际项目中应该从API获取
  const mockData = {
    data: [
      {
        id: '1',
        name: '张三建材',
        type: 'customer',
        totalOrders: 15,
        totalAmount: 125000.0,
        paidAmount: 85000.0,
        pendingAmount: 40000.0,
        overdueAmount: 15000.0,
        lastTransactionDate: '2025-01-15',
        creditLimit: 50000.0,
        paymentTerms: '30天',
      },
      {
        id: '2',
        name: '李四装饰',
        type: 'customer',
        totalOrders: 8,
        totalAmount: 68000.0,
        paidAmount: 68000.0,
        pendingAmount: 0.0,
        overdueAmount: 0.0,
        lastTransactionDate: '2025-01-12',
        creditLimit: 30000.0,
        paymentTerms: '15天',
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    },
    summary: {
      totalCustomers: 25,
      totalSuppliers: 8,
      totalReceivable: 125000.0,
      totalPayable: 45000.0,
    },
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(amount);

  const getBalanceStatus = (pendingAmount: number, overdueAmount: number) => {
    if (overdueAmount > 0) {
      return { label: '逾期', variant: 'destructive' as const };
    }
    if (pendingAmount > 0) {
      return { label: '待收款', variant: 'secondary' as const };
    }
    return { label: '已结清', variant: 'default' as const };
  };

  const handleSearch = (value: string) => {
    setQueryParams(prev => ({ ...prev, search: value, page: 1 }));
  };

  const handleTypeFilter = (value: string) => {
    setQueryParams(prev => ({
      ...prev,
      type: value as 'customer' | 'supplier',
      page: 1,
    }));
  };

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">往来账单</h1>
          <p className="text-muted-foreground">
            管理客户和供应商的综合账务往来
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            导出对账单
          </Button>
          <Button variant="outline" size="sm">
            <Receipt className="mr-2 h-4 w-4" />
            生成报表
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">客户数量</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {mockData.summary.totalCustomers}
            </div>
            <p className="text-xs text-muted-foreground">活跃客户</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总应收金额</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(mockData.summary.totalReceivable)}
            </div>
            <p className="text-xs text-muted-foreground">客户应收账款</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">供应商数量</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {mockData.summary.totalSuppliers}
            </div>
            <p className="text-xs text-muted-foreground">合作供应商</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总应付金额</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(mockData.summary.totalPayable)}
            </div>
            <p className="text-xs text-muted-foreground">供应商应付账款</p>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardHeader>
          <CardTitle>往来账单列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索客户或供应商名称..."
                  value={queryParams.search}
                  onChange={e => handleSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={queryParams.type} onValueChange={handleTypeFilter}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">客户</SelectItem>
                  <SelectItem value="supplier">供应商</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 往来账单列表 */}
          <div className="mt-6 space-y-4">
            {mockData.data.map(statement => {
              const balanceStatus = getBalanceStatus(
                statement.pendingAmount,
                statement.overdueAmount
              );
              return (
                <Card
                  key={statement.id}
                  className="transition-shadow hover:shadow-md"
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">{statement.name}</h3>
                          <Badge variant={balanceStatus.variant}>
                            {balanceStatus.label}
                          </Badge>
                          <Badge variant="outline">
                            {statement.type === 'customer' ? '客户' : '供应商'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>总订单：{statement.totalOrders} 个</span>
                          <span>账期：{statement.paymentTerms}</span>
                          <span>
                            信用额度：{formatCurrency(statement.creditLimit)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          最后交易：{statement.lastTransactionDate}
                        </p>
                      </div>
                      <div className="space-y-2 text-right">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            总交易金额
                          </p>
                          <p className="font-semibold">
                            {formatCurrency(statement.totalAmount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            已付金额
                          </p>
                          <p className="font-semibold text-green-600">
                            {formatCurrency(statement.paidAmount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {statement.type === 'customer'
                              ? '待收金额'
                              : '待付金额'}
                          </p>
                          <p className="font-semibold text-orange-600">
                            {formatCurrency(statement.pendingAmount)}
                          </p>
                        </div>
                        {statement.overdueAmount > 0 && (
                          <div>
                            <p className="text-sm text-muted-foreground">
                              逾期金额
                            </p>
                            <p className="font-semibold text-red-600">
                              {formatCurrency(statement.overdueAmount)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(`/finance/statements/${statement.id}`)
                        }
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        查看明细
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(
                            `/finance/statements/${statement.id}/export`
                          )
                        }
                      >
                        <Download className="mr-2 h-4 w-4" />
                        导出对账单
                      </Button>
                      {statement.type === 'customer' &&
                        statement.pendingAmount > 0 && (
                          <Button
                            size="sm"
                            onClick={() =>
                              router.push(
                                `/payments/create?customerId=${statement.id}`
                              )
                            }
                          >
                            收款
                          </Button>
                        )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* 分页 */}
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              共 {mockData.pagination.total} 条记录
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>
                上一页
              </Button>
              <Button variant="outline" size="sm" disabled>
                下一页
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
