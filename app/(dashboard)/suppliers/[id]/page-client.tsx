'use client';

import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronRight,
  Edit,
  History,
  MapPin,
  Phone,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import { useBreadcrumbTitle } from '@/components/common/BreadcrumbContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
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

  useBreadcrumbTitle(supplier.name);

  const totalRemainingAmount = supplier.payableRecords.reduce(
    (sum, record) => sum + record.remainingAmount,
    0
  );

  const totalShipmentAmount = supplier.factoryShipments.reduce(
    (sum, shipment) => sum + shipment.totalAmount,
    0
  );

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-[1680px] space-y-12 p-4 transition-all duration-500 lg:p-10 xl:p-14">
        {/* Identity Wall Header */}
        <div className="relative overflow-hidden rounded-[2.5rem] border border-white bg-white/60 p-8 shadow-sm backdrop-blur-xl transition-all duration-500 hover:shadow-xl">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-amber-50/50 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-blue-50/30 blur-3xl" />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-900 text-white shadow-2xl transition-transform duration-500 hover:scale-110">
                <Building2 className="h-10 w-10" />
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-4xl font-black tracking-tighter text-slate-900">
                    {supplier.name}
                  </h1>
                  <div
                    className={cn(
                      'rounded-full px-4 py-1.5 text-xs font-black tracking-[0.2em] uppercase',
                      supplier.status === 'active'
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                        : 'bg-slate-100 text-slate-500'
                    )}
                  >
                    {supplier.status === 'active' ? '正常合作' : '暂停合作'}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                    <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                      供应商编号
                    </span>
                    <span className="font-black text-slate-700">
                      {supplier.id.substring(0, 8).toUpperCase()}
                    </span>
                  </div>
                  <span className="h-1 w-1 rounded-full bg-slate-200" />
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                    <span className="flex items-center gap-2 font-black text-slate-600">
                      <Phone className="h-4 w-4 text-slate-300" />{' '}
                      {supplier.phone || '未留电话'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="lg"
                onClick={() => router.push(`/suppliers/${supplier.id}/edit`)}
                className="h-14 rounded-2xl border-none bg-white px-8 font-black text-slate-600 shadow-sm transition-all hover:bg-slate-900 hover:text-white active:scale-95"
              >
                <Edit className="mr-2 h-5 w-5" />
                编辑资料
              </Button>
              <Button
                size="lg"
                className="h-14 rounded-2xl bg-slate-900 px-10 font-black text-white shadow-xl transition-all hover:shadow-slate-200 active:scale-95"
                onClick={() =>
                  router.push(
                    `/factory-shipments/create?supplierId=${supplier.id}`
                  )
                }
              >
                <Truck className="mr-2 h-5 w-5" />
                新建厂家发货单
              </Button>
            </div>
          </div>
        </div>

        {/* Insight Metrics Grid */}
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-4 rounded-3xl border border-white bg-white/60 p-8 shadow-sm backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-slate-400" />
                  <span className="text-xs font-black tracking-widest text-slate-500 uppercase">
                    联系信息
                  </span>
                </div>
                <p className="text-xl leading-tight font-black text-slate-900">
                  {supplier.address || '未填写地址'}
                </p>
                <div className="flex items-center gap-4 pt-4">
                  <div className="text-xs font-bold text-slate-500">
                    建档时间{' '}
                    <span className="ml-1 text-slate-900">
                      {formatDate(supplier.createdAt)}
                    </span>
                  </div>
                  <span className="h-1 w-1 rounded-full bg-slate-200" />
                  <div className="text-xs font-bold text-slate-500">
                    最后更新{' '}
                    <span className="ml-1 text-slate-900">
                      {formatDate(supplier.updatedAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-3xl border border-rose-100 bg-rose-50/20 p-8 shadow-sm backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-rose-400" />
                  <span className="text-xs font-black tracking-widest text-rose-600/80 uppercase">
                    风险与待付预警
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-black text-rose-400">¥</span>
                  <span className="text-4xl font-black tracking-tighter text-rose-600">
                    {totalRemainingAmount.toLocaleString('zh-CN', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <p className="text-xs font-bold text-rose-400">
                  当前共计{' '}
                  {
                    supplier.payableRecords.filter(r => r.remainingAmount > 0)
                      .length
                  }{' '}
                  笔待付款
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="space-y-6 rounded-3xl border border-white bg-white/60 p-8 shadow-sm backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                  业务活跃度
                </span>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <span className="text-xs font-bold text-slate-600">
                      累计供货金额
                    </span>
                  </div>
                  <span className="text-sm font-black text-slate-900">
                    {formatCurrency(totalShipmentAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                    <span className="text-xs font-bold text-slate-600">
                      发货单数
                    </span>
                  </div>
                  <span className="text-sm font-black text-slate-900">
                    {supplier._count.factoryShipments} 批次
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-slate-300" />
                    <span className="text-xs font-bold text-slate-600">
                      应付单数
                    </span>
                  </div>
                  <span className="text-sm font-black text-slate-900">
                    {supplier._count.payableRecords} 记录
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Audit Stream Tabs */}
        <div className="rounded-[2.5rem] border border-white bg-white/40 p-1 shadow-sm backdrop-blur-md">
          <div className="p-8 pb-4">
            <h2 className="text-2xl font-black tracking-tight text-slate-900">
              供货记录与应付款
            </h2>
            <p className="mt-1 text-sm font-bold text-slate-400">
              查看厂家发货进度和对应应付款情况。
            </p>
          </div>

          <Tabs defaultValue="shipments" className="w-full">
            <div className="mb-8 flex items-center justify-between px-8">
              <TabsList className="h-14 rounded-2xl border border-slate-200/50 bg-slate-100/50 p-1.5">
                <TabsTrigger
                  value="shipments"
                  className="h-10 rounded-xl px-6 font-black transition-all data-[state=active]:bg-white data-[state=active]:shadow-xl"
                >
                  发货记录 ({supplier._count.factoryShipments})
                </TabsTrigger>
                <TabsTrigger
                  value="payables"
                  className="h-10 rounded-xl px-6 font-black transition-all data-[state=active]:bg-white data-[state=active]:shadow-xl"
                >
                  应付款 ({supplier._count.payableRecords})
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="space-y-4 p-2">
              <TabsContent
                value="shipments"
                className="focus-visible:outline-none"
              >
                {supplier.factoryShipments.length > 0 ? (
                  <div className="grid gap-4 px-6 pb-6">
                    {supplier.factoryShipments.map(shipment => (
                      <div
                        key={shipment.id}
                        onClick={() =>
                          router.push(`/factory-shipments/${shipment.id}`)
                        }
                        className="group relative flex cursor-pointer items-center justify-between rounded-2xl border border-white bg-white/40 p-5 backdrop-blur-md transition-all duration-500 hover:-translate-y-1 hover:bg-white hover:shadow-xl"
                      >
                        <div className="flex items-center gap-6">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-all duration-500 group-hover:bg-slate-900 group-hover:text-white">
                            <Truck className="h-5 w-5" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-black tracking-tight text-slate-900 transition-colors group-hover:text-blue-600">
                                #{shipment.shipmentNumber}
                              </span>
                              <div className="rounded-md border border-slate-200/50 bg-slate-100 px-2 py-0.5 text-xs font-bold tracking-widest text-slate-500 uppercase">
                                {shipment.status}
                              </div>
                            </div>
                            <p className="text-xs font-bold text-slate-500">
                              创建于 {formatDateTime(shipment.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-8">
                          <div className="text-right">
                            <p className="text-lg font-black tracking-tighter text-slate-900">
                              {formatCurrency(shipment.totalAmount)}
                            </p>
                            <span className="text-xs font-bold tracking-widest text-slate-400 uppercase italic">
                              发货金额
                            </span>
                          </div>
                          <ChevronRight className="h-5 w-5 text-slate-200 transition-all group-hover:translate-x-1 group-hover:text-slate-900" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="m-6 flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 py-20">
                    <History className="mb-4 h-10 w-10 text-slate-200" />
                    <p className="text-sm font-black tracking-widest text-slate-400 uppercase">
                      暂无厂家发货记录
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent
                value="payables"
                className="focus-visible:outline-none"
              >
                {supplier.payableRecords.length > 0 ? (
                  <div className="grid gap-4 px-6 pb-6">
                    {supplier.payableRecords.map(record => (
                      <div
                        key={record.id}
                        onClick={() =>
                          router.push(`/finance/payables/${record.id}`)
                        }
                        className={cn(
                          'group relative flex cursor-pointer items-center justify-between rounded-2xl border p-5 backdrop-blur-md transition-all duration-500 hover:-translate-y-1 hover:shadow-xl',
                          record.remainingAmount > 0
                            ? 'border-rose-100 bg-rose-50/20 hover:bg-white'
                            : 'border-white bg-white/40 hover:bg-white'
                        )}
                      >
                        <div className="flex items-center gap-6">
                          <div
                            className={cn(
                              'flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-500',
                              record.remainingAmount > 0
                                ? 'bg-rose-100 text-rose-500 group-hover:bg-rose-500 group-hover:text-white'
                                : 'bg-emerald-50 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white'
                            )}
                          >
                            {record.remainingAmount > 0 ? (
                              <AlertCircle className="h-5 w-5" />
                            ) : (
                              <CheckCircle2 className="h-5 w-5" />
                            )}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-black tracking-tight text-slate-900 transition-colors group-hover:text-blue-600">
                                #{record.payableNumber}
                              </span>
                              <div
                                className={cn(
                                  'rounded-md px-2 py-0.5 text-xs font-bold tracking-widest uppercase',
                                  record.status === 'paid'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-rose-100 text-rose-700'
                                )}
                              >
                                {record.status === 'paid'
                                  ? '结算完成'
                                  : '待处理应付'}
                              </div>
                            </div>
                            <p className="text-xs font-bold text-slate-500">
                              {record.dueDate
                                ? `应于 ${formatDate(record.dueDate)} 前结算`
                                : `账单日 ${formatDate(record.createdAt)}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-8">
                          <div className="text-right">
                            <div className="flex flex-col items-end">
                              <span
                                className={cn(
                                  'text-lg font-black tracking-tighter',
                                  record.remainingAmount > 0
                                    ? 'text-rose-600'
                                    : 'text-slate-900'
                                )}
                              >
                                {formatCurrency(record.remainingAmount)}
                              </span>
                              <span className="text-[9px] font-black tracking-widest text-slate-300 uppercase">
                                / {formatCurrency(record.payableAmount)}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-slate-200 transition-all group-hover:translate-x-1 group-hover:text-slate-900" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="m-6 flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 py-20">
                    <History className="mb-4 h-10 w-10 text-slate-200" />
                    <p className="text-sm font-black tracking-widest text-slate-400 uppercase">
                      暂无账务历史
                    </p>
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
