'use client';

import { Calendar, Clock, Contact2, MapPin, Phone, Users } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/utils/datetime';

interface StatementBasicInfoProps {
  entity: {
    name: string;
    phone?: string;
    address?: string;
  };
  partnerRole: 'customer' | 'supplier' | 'both';
  lastTransactionDate?: Date | string | null;
  lastPaymentDate?: Date | string | null;
}

const ROLE_LABEL_MAP: Record<StatementBasicInfoProps['partnerRole'], string> = {
  customer: '客户',
  supplier: '供应商',
  both: '客户 / 供应商',
};

export function StatementBasicInfo({
  entity,
  partnerRole,
  lastTransactionDate,
  lastPaymentDate,
}: StatementBasicInfoProps) {
  return (
    <Card className="overflow-hidden border-slate-200/60 transition-all hover:shadow-lg">
      <CardHeader className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-400 italic">
          <Contact2 className="h-4 w-4" />
          伙伴关系名片 (Entity Profile)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-100">
          <div className="grid grid-cols-2 gap-px bg-slate-100">
            <div className="bg-white p-6">
              <div className="flex items-center gap-3 text-slate-400 mb-2">
                <MapPin className="h-4 w-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">物理地址</span>
              </div>
              <p className="text-sm font-bold text-slate-600 line-clamp-2 min-h-[40px]">
                {entity.address || '暂无登记地址'}
              </p>
            </div>
            <div className="bg-white p-6">
              <div className="flex items-center gap-3 text-slate-400 mb-2">
                <Phone className="h-4 w-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">联系方式</span>
              </div>
              <p className="text-lg font-black font-mono text-slate-900">
                {entity.phone || '未绑定电话'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-px bg-slate-100">
            {[
              { label: '上游类型', value: ROLE_LABEL_MAP[partnerRole], icon: Users },
              { 
                label: '末次交易', 
                value: lastTransactionDate ? formatDateTime(lastTransactionDate, 'MM-dd HH:mm') : '无记录',
                icon: Clock 
              },
              { 
                label: '最近对账', 
                value: lastPaymentDate ? formatDateTime(lastPaymentDate, 'MM-dd HH:mm') : '待对账',
                icon: Calendar 
              },
            ].map((item, idx) => (
              <div key={idx} className="bg-slate-50/30 p-4 transition-colors hover:bg-white group">
                <div className="flex items-center gap-2 mb-1">
                  <item.icon className="h-3 w-3 text-slate-400 group-hover:text-blue-500 transition-colors" />
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</span>
                </div>
                <div className="text-xs font-black text-slate-700 truncate">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
