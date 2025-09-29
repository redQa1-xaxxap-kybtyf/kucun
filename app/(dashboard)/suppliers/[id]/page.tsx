'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Edit,
  Mail,
  MapPin,
  Phone,
  Truck,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorMessage } from '@/components/ui/error-message';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatDate } from '@/lib/utils';

interface SupplierDetail {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  contactPerson?: string;
  status: string;
  paymentTerms?: string;
  remarks?: string;
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
    dueDate: string;
    createdAt: string;
  }>;
}

async function fetchSupplierDetail(id: string): Promise<SupplierDetail> {
  const response = await fetch(`/api/suppliers/${id}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('获取供应商详情失败');
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '获取供应商详情失败');
  }

  return result.data;
}

export default function SupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const {
    data: supplier,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['supplier', id],
    queryFn: () => fetchSupplierDetail(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorMessage
        title="加载失败"
        message={error instanceof Error ? error.message : '获取供应商详情失败'}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!supplier) {
    return (
      <ErrorMessage
        title="供应商不存在"
        message="未找到指定的供应商"
        onRetry={() => router.push('/suppliers')}
      />
    );
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'inactive':
        return 'secondary';
      case 'suspended':
        return 'destructive';
      default:
        return 'outline';
    }
  };

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

  const getPayableStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">待付款</Badge>;
      case 'partial':
        return <Badge variant="secondary">部分付款</Badge>;
      case 'paid':
        return <Badge variant="success">已付款</Badge>;
      case 'overdue':
        return <Badge variant="destructive">逾期</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>返回</span>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{supplier.name}</h1>
            <p className="text-muted-foreground">供应商详情</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/suppliers/${id}/edit`)}
          >
            <Edit className="mr-2 h-4 w-4" />
            编辑
          </Button>
          <Button size="sm">
            <Truck className="mr-2 h-4 w-4" />
            创建发货
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 基本信息 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    供应商状态
                  </label>
                  <div className="mt-1">
                    <Badge variant={getStatusBadgeVariant(supplier.status)}>
                      {getStatusLabel(supplier.status)}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    联系人
                  </label>
                  <p className="mt-1">{supplier.contactPerson || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    电话号码
                  </label>
                  <div className="mt-1 flex items-center space-x-2">
                    {supplier.phone ? (
                      <>
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{supplier.phone}</span>
                      </>
                    ) : (
                      <span>-</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    邮箱地址
                  </label>
                  <div className="mt-1 flex items-center space-x-2">
                    {supplier.email ? (
                      <>
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{supplier.email}</span>
                      </>
                    ) : (
                      <span>-</span>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    地址
                  </label>
                  <div className="mt-1 flex items-start space-x-2">
                    {supplier.address ? (
                      <>
                        <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <span>{supplier.address}</span>
                      </>
                    ) : (
                      <span>-</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    付款条件
                  </label>
                  <p className="mt-1">{supplier.paymentTerms || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    创建时间
                  </label>
                  <div className="mt-1 flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{formatDate(supplier.createdAt)}</span>
                  </div>
                </div>
              </div>
              {supplier.remarks && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    备注信息
                  </label>
                  <p className="mt-1 text-sm">{supplier.remarks}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 统计信息 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>交易统计</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(totalShipmentAmount)}
                </p>
                <p className="text-sm text-muted-foreground">累计发货金额</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-lg font-semibold">
                    {supplier._count.factoryShipments}
                  </p>
                  <p className="text-xs text-muted-foreground">发货记录</p>
                </div>
                <div>
                  <p className="text-lg font-semibold">
                    {supplier._count.payableRecords}
                  </p>
                  <p className="text-xs text-muted-foreground">应付记录</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>应付款统计</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(totalRemainingAmount)}
                </p>
                <p className="text-sm text-muted-foreground">待付款金额</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-muted-foreground">
                  {formatCurrency(totalPayableAmount)}
                </p>
                <p className="text-xs text-muted-foreground">累计应付金额</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 交易历史 */}
      <Card>
        <CardHeader>
          <CardTitle>交易历史</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="shipments" className="w-full">
            <TabsList>
              <TabsTrigger
                value="shipments"
                className="flex items-center space-x-2"
              >
                <Truck className="h-4 w-4" />
                <span>厂家发货 ({supplier._count.factoryShipments})</span>
              </TabsTrigger>
              <TabsTrigger
                value="payables"
                className="flex items-center space-x-2"
              >
                <DollarSign className="h-4 w-4" />
                <span>应付款 ({supplier._count.payableRecords})</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="shipments" className="space-y-4">
              {supplier.factoryShipments.length > 0 ? (
                <div className="space-y-3">
                  {supplier.factoryShipments.map(shipment => (
                    <div
                      key={shipment.id}
                      className="flex cursor-pointer items-center justify-between rounded-lg border p-4 hover:bg-muted/50"
                      onClick={() =>
                        router.push(`/factory-shipments/${shipment.id}`)
                      }
                    >
                      <div>
                        <p className="font-medium">{shipment.shipmentNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(shipment.createdAt)}
                        </p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="font-medium">
                          {formatCurrency(shipment.totalAmount)}
                        </p>
                        <Badge variant="outline">{shipment.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  暂无发货记录
                </div>
              )}
            </TabsContent>

            <TabsContent value="payables" className="space-y-4">
              {supplier.payableRecords.length > 0 ? (
                <div className="space-y-3">
                  {supplier.payableRecords.map(record => (
                    <div
                      key={record.id}
                      className="flex cursor-pointer items-center justify-between rounded-lg border p-4 hover:bg-muted/50"
                      onClick={() =>
                        router.push(`/finance/payables/${record.id}`)
                      }
                    >
                      <div>
                        <p className="font-medium">{record.payableNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          到期：{formatDate(record.dueDate)}
                        </p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="font-medium">
                          {formatCurrency(record.remainingAmount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          / {formatCurrency(record.payableAmount)}
                        </p>
                        {getPayableStatusBadge(record.status)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  暂无应付款记录
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
