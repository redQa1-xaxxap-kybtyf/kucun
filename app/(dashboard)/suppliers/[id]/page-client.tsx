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
    Truck
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
      <div className="mx-auto max-w-[1680px] space-y-12 p-4 lg:p-10 xl:p-14 transition-all duration-500">
        
        {/* Identity Wall Header */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-white/60 p-8 backdrop-blur-xl border border-white shadow-sm transition-all duration-500 hover:shadow-xl">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-50/50 blur-3xl" />
          <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-blue-50/30 blur-3xl" />
          
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-900 text-white shadow-2xl transition-transform hover:scale-110 duration-500">
                <Building2 className="h-10 w-10" />
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-4xl font-black tracking-tighter text-slate-900">
                    {supplier.name}
                  </h1>
                    <div className={cn(
                      "text-xs uppercase font-black tracking-[0.2em] px-4 py-1.5 rounded-full",
                      supplier.status === 'active' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200" : "bg-slate-100 text-slate-500"
                    )}>
                    {supplier.status === 'active' ? '正式启用' : '暂停合作'}
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-6">
                   <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                     <span className="uppercase text-xs font-bold tracking-widest text-slate-400">证照编码</span>
                     <span className="text-slate-700 font-black">{supplier.id.substring(0, 8).toUpperCase()}</span>
                   </div>
                   <span className="h-1 w-1 rounded-full bg-slate-200" />
                   <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                     <span className="flex items-center gap-2 text-slate-600 font-black">
                       <Phone className="h-4 w-4 text-slate-300" /> {supplier.phone || '未留电话'}
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
                className="h-14 rounded-2xl bg-white font-black text-slate-600 shadow-sm border-none hover:bg-slate-900 hover:text-white transition-all active:scale-95 px-8"
              >
                <Edit className="mr-2 h-5 w-5" />
                修订档案
              </Button>
              <Button 
                 size="lg" 
                 className="h-14 rounded-2xl bg-slate-900 font-black text-white shadow-xl hover:shadow-slate-200 transition-all active:scale-95 px-10"
                 onClick={() => router.push(`/factory-shipments/create?supplierId=${supplier.id}`)}
              >
                <Truck className="mr-2 h-5 w-5" />
                建立发货单
              </Button>
            </div>
          </div>
        </div>

        {/* Insight Metrics Grid */}
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-4">
          <div className="lg:col-span-3">
             <div className="grid gap-6 sm:grid-cols-2">
                 <div className="rounded-3xl border border-white bg-white/60 p-8 backdrop-blur-md shadow-sm space-y-4">
                    <div className="flex items-center gap-3">
                       <MapPin className="h-5 w-5 text-slate-400" />
                       <span className="text-xs font-black uppercase tracking-widest text-slate-500">地理位置与联系信息</span>
                    </div>
                    <p className="text-xl font-black text-slate-900 leading-tight">
                       {supplier.address || "暂无登记物理地址"}
                    </p>
                    <div className="pt-4 flex items-center gap-4">
                       <div className="text-xs font-bold text-slate-500">
                         合作始于 <span className="text-slate-900 ml-1">{formatDate(supplier.createdAt)}</span>
                       </div>
                       <span className="h-1 w-1 rounded-full bg-slate-200" />
                       <div className="text-xs font-bold text-slate-500">
                         最后更新 <span className="text-slate-900 ml-1">{formatDate(supplier.updatedAt)}</span>
                       </div>
                    </div>
                 </div>
                
                <div className="rounded-3xl border border-rose-100 bg-rose-50/20 p-8 backdrop-blur-md shadow-sm space-y-4">
                   <div className="flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-rose-400" />
                      <span className="text-xs font-black uppercase tracking-widest text-rose-600/80">风险与待付预警</span>
                   </div>
                   <div className="flex items-baseline gap-1">
                      <span className="text-sm font-black text-rose-400">¥</span>
                      <span className="text-4xl font-black tracking-tighter text-rose-600">
                        {totalRemainingAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </span>
                   </div>
                   <p className="text-xs font-bold text-rose-400">
                     当前共计 {supplier.payableRecords.filter(r => r.remainingAmount > 0).length} 笔待处理应收款项
                   </p>
                </div>
             </div>
          </div>

          <div className="lg:col-span-1">
             <div className="rounded-3xl border border-white bg-white/60 p-8 backdrop-blur-md shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">业务活跃度</span>
                   <TrendingUp className="h-4 w-4 text-blue-500" />
                </div>
                <div className="space-y-4">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                         <div className="h-2 w-2 rounded-full bg-blue-500" />
                         <span className="text-xs font-bold text-slate-600">累计发</span>
                      </div>
                      <span className="text-sm font-black text-slate-900">{formatCurrency(totalShipmentAmount)}</span>
                   </div>
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                         <div className="h-2 w-2 rounded-full bg-amber-500" />
                         <span className="text-xs font-bold text-slate-600">供货频次</span>
                      </div>
                      <span className="text-sm font-black text-slate-900">{supplier._count.factoryShipments} 批次</span>
                   </div>
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                         <div className="h-2 w-2 rounded-full bg-slate-300" />
                         <span className="text-xs font-bold text-slate-600">应付笔数</span>
                      </div>
                      <span className="text-sm font-black text-slate-900">{supplier._count.payableRecords} 记录</span>
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* Audit Stream Tabs */}
        <div className="rounded-[2.5rem] border border-white bg-white/40 p-1 backdrop-blur-md shadow-sm">
          <div className="p-8 pb-4">
            <h2 className="text-2xl font-black tracking-tight text-slate-900">供货审计与账务往来</h2>
            <p className="text-slate-400 text-sm font-bold mt-1">
              追踪厂家发货的物流状态及对应的财务结算全生命周期。
            </p>
          </div>
          
          <Tabs defaultValue="shipments" className="w-full">
            <div className="flex items-center justify-between mb-8 px-8">
               <TabsList className="bg-slate-100/50 p-1.5 rounded-2xl h-14 border border-slate-200/50">
                 <TabsTrigger value="shipments" className="rounded-xl px-6 font-black data-[state=active]:bg-white data-[state=active]:shadow-xl transition-all h-10">
                   发货审计 ({supplier._count.factoryShipments})
                 </TabsTrigger>
                 <TabsTrigger value="payables" className="rounded-xl px-6 font-black data-[state=active]:bg-white data-[state=active]:shadow-xl transition-all h-10">
                   账务结算 ({supplier._count.payableRecords})
                 </TabsTrigger>
               </TabsList>
            </div>

            <div className="p-2 space-y-4">
              <TabsContent value="shipments" className="focus-visible:outline-none">
                {supplier.factoryShipments.length > 0 ? (
                  <div className="grid gap-4 px-6 pb-6">
                    {supplier.factoryShipments.map((shipment) => (
                      <div
                        key={shipment.id}
                        onClick={() => router.push(`/factory-shipments/${shipment.id}`)}
                        className="group relative flex items-center justify-between rounded-2xl border border-white bg-white/40 p-5 backdrop-blur-md transition-all duration-500 hover:bg-white hover:shadow-xl hover:-translate-y-1 cursor-pointer"
                      >
                        <div className="flex items-center gap-6">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all duration-500">
                             <Truck className="h-5 w-5" />
                          </div>
                          <div className="space-y-1">
                             <div className="flex items-center gap-3">
                               <span className="text-sm font-black tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">#{shipment.shipmentNumber}</span>
                               <div className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200/50">
                                 {shipment.status}
                               </div>
                             </div>
                             <p className="text-xs font-bold text-slate-500">
                               登记于 {formatDateTime(shipment.createdAt)}
                             </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-8">
                          <div className="text-right">
                            <p className="text-lg font-black tracking-tighter text-slate-900">
                              {formatCurrency(shipment.totalAmount)}
                            </p>
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-400 italic">Shipment Value</span>
                          </div>
                          <ChevronRight className="h-5 w-5 text-slate-200 group-hover:text-slate-900 transition-all group-hover:translate-x-1" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-3xl m-6 border border-dashed border-slate-200">
                    <History className="h-10 w-10 text-slate-200 mb-4" />
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">暂无发货审计记录</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="payables" className="focus-visible:outline-none">
                {supplier.payableRecords.length > 0 ? (
                  <div className="grid gap-4 px-6 pb-6">
                    {supplier.payableRecords.map((record) => (
                      <div
                        key={record.id}
                        onClick={() => router.push(`/finance/payables/${record.id}`)}
                        className={cn(
                          "group relative flex items-center justify-between rounded-2xl border transition-all duration-500 hover:shadow-xl hover:-translate-y-1 cursor-pointer p-5 backdrop-blur-md",
                          record.remainingAmount > 0 ? "border-rose-100 bg-rose-50/20 hover:bg-white" : "border-white bg-white/40 hover:bg-white"
                        )}
                      >
                        <div className="flex items-center gap-6">
                          <div className={cn(
                            "flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-500",
                            record.remainingAmount > 0 ? "bg-rose-100 text-rose-500 group-hover:bg-rose-500 group-hover:text-white" : "bg-emerald-50 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white"
                          )}>
                             {record.remainingAmount > 0 ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                          </div>
                          <div className="space-y-1">
                             <div className="flex items-center gap-3">
                               <span className="text-sm font-black tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">#{record.payableNumber}</span>
                               <div className={cn(
                                 "text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-md",
                                 record.status === 'paid' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                               )}>
                                 {record.status === 'paid' ? '结算完成' : '待处理应付'}
                               </div>
                             </div>
                             <p className="text-xs font-bold text-slate-500">
                              {record.dueDate ? `应于 ${formatDate(record.dueDate)} 前结算` : `账单日 ${formatDate(record.createdAt)}`}
                             </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-8">
                          <div className="text-right">
                             <div className="flex flex-col items-end">
                                <span className={cn(
                                  "text-lg font-black tracking-tighter",
                                  record.remainingAmount > 0 ? "text-rose-600" : "text-slate-900"
                                )}>
                                  {formatCurrency(record.remainingAmount)}
                                </span>
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">
                                  / {formatCurrency(record.payableAmount)}
                                </span>
                             </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-slate-200 group-hover:text-slate-900 transition-all group-hover:translate-x-1" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-3xl m-6 border border-dashed border-slate-200">
                    <History className="h-10 w-10 text-slate-200 mb-4" />
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">暂无账务历史</p>
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
