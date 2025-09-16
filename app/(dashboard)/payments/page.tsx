'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, MoreHorizontal, Eye, CreditCard, DollarSign, Calendar, User } from 'lucide-react'

// UI Components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MobileDataTable } from '@/components/ui/mobile-data-table'

/**
 * 支付管理页面
 * 严格遵循全栈项目统一约定规范
 */
export default function PaymentsPage() {
  const router = useRouter()
  const [queryParams, setQueryParams] = React.useState({
    page: 1,
    limit: 20,
    search: '',
    status: undefined as string | undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc' as 'asc' | 'desc',
  })

  // 模拟数据 - 实际项目中应该从API获取
  const mockData = {
    data: [
      {
        id: '1',
        paymentNumber: 'PAY-2025-001',
        customer: { name: '张三建材' },
        amount: 15000.00,
        status: 'completed',
        paymentMethod: 'bank_transfer',
        createdAt: '2025-01-16T10:00:00Z',
      },
      {
        id: '2',
        paymentNumber: 'PAY-2025-002',
        customer: { name: '李四装饰' },
        amount: 8500.00,
        status: 'pending',
        paymentMethod: 'cash',
        createdAt: '2025-01-15T14:30:00Z',
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    }
  }

  // 搜索处理
  const handleSearch = (value: string) => {
    setQueryParams(prev => ({ ...prev, search: value, page: 1 }))
  }

  // 筛选处理
  const handleFilter = (key: string, value: any) => {
    setQueryParams(prev => ({ ...prev, [key]: value, page: 1 }))
  }

  // 状态标签渲染
  const getStatusBadge = (status: string) => {
    const statusMap = {
      completed: { label: '已完成', variant: 'default' as const },
      pending: { label: '待处理', variant: 'secondary' as const },
      failed: { label: '失败', variant: 'destructive' as const },
      cancelled: { label: '已取消', variant: 'outline' as const },
    }
    const config = statusMap[status as keyof typeof statusMap] || { label: status, variant: 'outline' as const }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  // 支付方式标签
  const getPaymentMethodLabel = (method: string) => {
    const methodMap = {
      cash: '现金',
      bank_transfer: '银行转账',
      credit_card: '信用卡',
      alipay: '支付宝',
      wechat: '微信支付',
    }
    return methodMap[method as keyof typeof methodMap] || method
  }

  // 格式化金额
  const formatAmount = (amount: number) => {
    return `¥${amount.toFixed(2)}`
  }

  // 移动端表格列配置
  const mobileColumns = [
    { key: 'paymentNumber', title: '支付单号', mobilePrimary: true },
    { key: 'customer', title: '客户', render: (item: any) => item.customer?.name || '-' },
    { key: 'status', title: '状态', render: (item: any) => getStatusBadge(item.status) },
    { key: 'amount', title: '金额', render: (item: any) => formatAmount(item.amount) },
  ]

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">支付管理</h1>
          <p className="text-muted-foreground">管理客户支付记录和应收账款</p>
        </div>
        <Button onClick={() => router.push('/payments/create')}>
          <Plus className="mr-2 h-4 w-4" />
          新建支付记录
        </Button>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索支付单号或客户名称..."
                  value={queryParams.search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select
                value={queryParams.status || 'all'}
                onValueChange={(value) => handleFilter('status', value === 'all' ? undefined : value)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                  <SelectItem value="pending">待处理</SelectItem>
                  <SelectItem value="failed">失败</SelectItem>
                  <SelectItem value="cancelled">已取消</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 支付记录列表 */}
      <Card>
        <CardHeader>
          <CardTitle>支付记录</CardTitle>
          <CardDescription>
            共 {mockData.pagination.total} 条支付记录
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* 桌面端表格 */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>支付单号</TableHead>
                  <TableHead>客户</TableHead>
                  <TableHead>支付金额</TableHead>
                  <TableHead>支付方式</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>支付时间</TableHead>
                  <TableHead className="w-[100px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockData.data.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        {payment.paymentNumber}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {payment.customer.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        {formatAmount(payment.amount)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getPaymentMethodLabel(payment.paymentMethod)}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/payments/${payment.id}`)}>
                            <Eye className="mr-2 h-4 w-4" />
                            查看详情
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* 移动端卡片 */}
          <div className="md:hidden">
            <MobileDataTable
              data={mockData.data}
              columns={mobileColumns}
              onItemClick={(item) => router.push(`/payments/${item.id}`)}
              renderActions={(item) => (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => router.push(`/payments/${item.id}`)}>
                      <Eye className="mr-2 h-4 w-4" />
                      查看详情
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
