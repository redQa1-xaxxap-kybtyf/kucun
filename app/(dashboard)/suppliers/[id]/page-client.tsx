'use client';

import {
    ArrowLeft,
    Building2,
    Calendar,
    CreditCard,
    Edit,
    MapPin,
    Phone,
    Truck,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { EmptyState } from '@/components/common/empty-state';
import { RelativeTime } from '@/components/common/relative-time';
import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePayableStatistics } from '@/hooks/use-payable-statistics';
import {
    getCommonStatusBadgeVariant,
    getPayableStatusBadgeVariant,
} from '@/lib/utils/badge-helpers';
import { formatDate, formatDateTime } from '@/lib/utils/datetime';
import { formatCurrency } from '@/lib/utils/format';

interface SupplierDetail {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    factoryShipments: number;
    payableRecords: number;
  };
  factoryShipments: Array<{
    id: string;
    shipmentNumber: string;
    status: string;
    totalAmount: number;
    createdAt: string;
  }>;
  payableRecords: Array<{
    id: string;
    payableNumber: string;
    status: string;
    payableAmount: number;
    remainingAmount: number;
    dueDate: string | null;
    createdAt: string;
  }>;
}

interface SupplierDetailPageClientProps {
  supplier: SupplierDetail;
}

/**
 * 供应商详情页面客户端组件
 * 负责用户交互和状态管理
 * 严格遵循前端架构规范：Client Component 层
 */
export function SupplierDetailPageClient({
  supplier,
}: SupplierDetailPageClientProps) {
  const router = useRouter();

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return '活跃';
      case 'inactive':
        return '非活跃';
      case 'suspended':
        return '暂停合作';
      default:
        return status;
    }
  };

  const getPayableStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return '待付款';
      case 'partial':
        return '部分付款';
      case 'paid':
        return '已付款';
      case 'overdue':
        return '逾期';
      default:
        return status;
    }
  };

  const totalPayableAmount = supplier.payableRecords.reduce(
    (sum, record) => sum + record.payableAmount,
    0
  );

  const totalRemainingAmount = supplier.payableRecords.reduce(
    (sum, record) => sum + record.remainingAmount,
    0
  );

  const totalShipmentAmount = supplier.factoryShipments.reduce(
    (sum, shipment) => sum + shipment.totalAmount,
    0
  );

  // 获取该供应商的应付统计，包括货款+运费+总成本
  const { data: payableStats } = usePayableStatistics({
    filters: {
      page: 1,
      limit: 1,
      supplierId: supplier.id,
    },
    enabled: true,
  });

  return (
    <div className="flex h-full flex-col overflow-auto p-4">
      <div className="space-y-4">
        {/* 顶部操作栏 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <Link href="/suppliers">
                <ArrowLeft className="h-3.5 w-3.5" />
                返回列表
              </Link>
            </Button>
            <div className="h-5 w-px bg-gray-300"></div>
            <h1 className="text-lg font-semibold text-gray-900">
              供应商详情
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => router.push(`/suppliers/${supplier.id}/edit`)}
            >
              <Edit className="h-3.5 w-3.5" />
              编辑
            </Button>
            <Button size="sm" className="gap-1.5">
              <Truck className="h-3.5 w-3.5" />
              创建发货
            </Button>
          </div>
        </div>

        {/* 顶部核心信息卡片 */}
        <Card className="overflow-hidden border border-[hsl(var(--color-border-secondary))] shadow-lg">
          <CardContent className="p-0">
            <div className="border-b border-[hsl(var(--color-border-secondary))]/50 bg-gradient-to-br from-[hsl(var(--color-bg-secondary))] via-[hsl(var(--color-bg-tertiary))] to-white px-6 py-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-md">
                    <Building2 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-[hsl(var(--color-text-primary))]">
                        {supplier.name}
                      </h2>
                      <Badge
                        variant={getCommonStatusBadgeVariant(supplier.status)}
                      >
                        {getStatusLabel(supplier.status)}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-[hsl(var(--color-text-secondary))]">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{supplier.phone || '暂无联系电话'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                      累计发货
                    </p>
                    <p className="text-2xl font-bold text-[hsl(var(--color-primary))]">
                      {formatCurrency(totalShipmentAmount)}
                    </p>
                  </div>
                  <div className="h-8 w-px bg-[hsl(var(--color-border-secondary))]"></div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                      待付金额
                    </p>
                    <p className="text-2xl font-bold text-[hsl(var(--color-warning))]">
                      {formatCurrency(totalRemainingAmount)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 左侧：基本信息和交易历史 */}
          <div className="space-y-6 lg:col-span-2">
            {/* 基本信息 */}
            <Card className="overflow-hidden shadow-sm">
              <CardHeader className="border-b bg-[hsl(var(--color-bg-secondary))]/50 pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4 text-[hsl(var(--color-primary))]" />
                  基本信息
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                      联系地址
                    </span>
                    <div className="flex items-start gap-2 text-sm text-[hsl(var(--color-text-primary))]">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 text-[hsl(var(--color-text-tertiary))]" />
                      {supplier.address || '-'}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                      创建时间
                    </span>
                    <div className="flex items-center gap-2 text-sm text-[hsl(var(--color-text-primary))]">
                      <Calendar className="h-3.5 w-3.5 text-[hsl(var(--color-text-tertiary))]" />
                      {formatDateTime(supplier.createdAt)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 交易历史 */}
            <Card className="overflow-hidden shadow-sm">
              <CardHeader className="border-b bg-[hsl(var(--color-bg-secondary))]/50 pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="h-4 w-4 text-[hsl(var(--color-primary))]" />
                  交易历史
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Tabs defaultValue="shipments" className="w-full">
                  <div className="border-b px-4">
                    <TabsList className="h-12 bg-transparent p-0">
                      <TabsTrigger
                        value="shipments"
                        className="data-[state=active]:border-primary h-12 rounded-none border-b-2 border-transparent px-4 pb-3 pt-3 font-medium data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                      >
                        <Truck className="mr-2 h-4 w-4" />
                        厂家发货 ({supplier._count.factoryShipments})
                      </TabsTrigger>
                      <TabsTrigger
                        value="payables"
                        className="data-[state=active]:border-primary h-12 rounded-none border-b-2 border-transparent px-4 pb-3 pt-3 font-medium data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                      >
                        <ChineseYuan className="mr-2 h-4 w-4" />
                        应付款 ({supplier._count.payableRecords})
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="shipments" className="m-0">
                    {supplier.factoryShipments.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-[hsl(var(--color-bg-tertiary))]/50 hover:bg-[hsl(var(--color-bg-tertiary))]/50">
                            <TableHead className="h-9">发货单号</TableHead>
                            <TableHead className="h-9">发货日期</TableHead>
                            <TableHead className="h-9 text-right">
                              金额
                            </TableHead>
                            <TableHead className="h-9 w-[100px] text-center">
                              状态
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {supplier.factoryShipments.map(shipment => (
                            <TableRow
                              key={shipment.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() =>
                                router.push(
                                  `/factory-shipments/${shipment.id}`
                                )
                              }
                            >
                              <TableCell className="font-medium text-blue-600">
                                {shipment.shipmentNumber}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2 text-sm text-[hsl(var(--color-text-secondary))]">
                                  <Calendar className="h-3.5 w-3.5" />
                                  <RelativeTime date={shipment.createdAt} />
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(shipment.totalAmount)}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline">
                                  {shipment.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="py-8">
                        <EmptyState
                          icon={
                            <Truck className="h-8 w-8 text-[hsl(var(--color-border-secondary))]" />
                          }
                          title="暂无发货记录"
                          description="该供应商暂无发货记录"
                          compact
                        />
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="payables" className="m-0">
                    {supplier.payableRecords.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-[hsl(var(--color-bg-tertiary))]/50 hover:bg-[hsl(var(--color-bg-tertiary))]/50">
                            <TableHead className="h-9">应付单号</TableHead>
                            <TableHead className="h-9">到期日</TableHead>
                            <TableHead className="h-9 text-right">
                              剩余/总额
                            </TableHead>
                            <TableHead className="h-9 w-[100px] text-center">
                              状态
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {supplier.payableRecords.map(record => (
                            <TableRow
                              key={record.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() =>
                                router.push(`/finance/payables/${record.id}`)
                              }
                            >
                              <TableCell className="font-medium text-blue-600">
                                {record.payableNumber}
                              </TableCell>
                              <TableCell>
                                <div className="text-sm text-[hsl(var(--color-text-secondary))]">
                                  {record.dueDate
                                    ? formatDate(record.dueDate)
                                    : '-'}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-col items-end">
                                  <span className="font-medium text-[hsl(var(--color-warning))]">
                                    {formatCurrency(record.remainingAmount)}
                                  </span>
                                  <span className="text-xs text-[hsl(var(--color-text-tertiary))]">
                                    / {formatCurrency(record.payableAmount)}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge
                                  variant={getPayableStatusBadgeVariant(
                                    record.status
                                  )}
                                >
                                  {getPayableStatusLabel(record.status)}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="py-8">
                        <EmptyState
                          icon={
                            <ChineseYuan className="h-8 w-8 text-[hsl(var(--color-border-secondary))]" />
                          }
                          title="暂无应付款记录"
                          description="该供应商暂无应付款记录"
                          compact
                        />
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* 右侧：财务统计 */}
          <div className="space-y-6">
            <Card className="overflow-hidden shadow-sm">
              <CardHeader className="border-b bg-[hsl(var(--color-bg-secondary))]/50 pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ChineseYuan className="h-4 w-4 text-[hsl(var(--color-warning))]" />
                  财务统计
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[hsl(var(--color-text-secondary))]">
                      累计应付
                    </span>
                    <span className="font-semibold text-[hsl(var(--color-text-primary))]">
                      {formatCurrency(totalPayableAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[hsl(var(--color-text-secondary))]">
                      累计发货
                    </span>
                    <span className="font-semibold text-[hsl(var(--color-primary))]">
                      {formatCurrency(totalShipmentAmount)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                      待付总额
                    </span>
                    <span className="text-lg font-bold text-[hsl(var(--color-warning))]">
                      {formatCurrency(totalRemainingAmount)}
                    </span>
                  </div>

                  {payableStats && (
                    <div className="mt-4 rounded-lg bg-[hsl(var(--color-bg-secondary))] p-3 text-xs">
                      <div className="mb-2 font-medium text-[hsl(var(--color-text-primary))]">
                        成本概览
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[hsl(var(--color-text-secondary))]">
                            货款合计
                          </span>
                          <span className="font-medium">
                            {formatCurrency(
                              payableStats.purchaseGoodsAmount ?? 0
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[hsl(var(--color-text-secondary))]">
                            运费等费用
                          </span>
                          <span className="font-medium">
                            {formatCurrency(
                              payableStats.purchaseFreightAmount ?? 0
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-t border-[hsl(var(--color-border-secondary))]/50 pt-2">
                          <span className="text-[hsl(var(--color-text-secondary))]">
                            总成本
                          </span>
                          <span className="font-semibold text-[hsl(var(--color-primary))]">
                            {formatCurrency(
                              payableStats.purchaseTotalCost ?? 0
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
