'use client';

import {
  Briefcase,
  Building2,
  CreditCard,
  FileText,
  Mail,
  MapPin,
  Phone,
  Star,
  User,
  Wallet,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/format';

import type { CustomerExtendedInfo } from './types';

interface CustomerContactCardProps {
  phone?: string;
  address?: string;
  extendedInfo: CustomerExtendedInfo;
  createdAt: string;
  updatedAt: string;
  formatDateTime: (value: string) => string;
}

export function CustomerContactCard({
  phone,
  address,
  extendedInfo,
  createdAt,
  updatedAt,
  formatDateTime,
}: CustomerContactCardProps) {
  return (
    <div className="space-y-4">
      {/* 核心联系人信息分区 */}
      <section className="rounded-lg border bg-white p-4 sm:p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-900">联系信息</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SectionItem
            icon={
              <IconBadge
                color="indigo"
                icon={<User className="h-3.5 w-3.5" />}
              />
            }
            label="联系人"
            value={extendedInfo.contactPerson || '未填写'}
          />
          <SectionItem
            icon={
              <IconBadge
                color="emerald"
                icon={<Phone className="h-3.5 w-3.5" />}
              />
            }
            label="联系电话"
            value={
              <span className="font-mono font-bold text-slate-900">
                {phone || '无'}
              </span>
            }
          />
          <SectionItem
            icon={
              <IconBadge
                color="purple"
                icon={<Mail className="h-3.5 w-3.5" />}
              />
            }
            label="电子邮箱"
            value={
              <span className="font-mono font-bold text-slate-600">
                {extendedInfo.email || '未填写'}
              </span>
            }
          />
        </div>

        <div className="mt-5 flex items-start gap-3 border-t pt-4">
          <IconBadge color="slate" icon={<MapPin className="h-3.5 w-3.5" />} />
          <div className="flex-1">
            <p className="text-xs font-medium text-slate-500">地址</p>
            <p className="mt-1 text-sm font-medium text-slate-700">
              {address || '未填写'}
            </p>
          </div>
        </div>
      </section>

      {/* 属性与财务分区 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* 客户画像属性 */}
        <section className="rounded-lg border bg-white p-4 sm:p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900">客户信息</h3>
          </div>
          <div className="grid gap-4">
            <SectionItem
              icon={
                <IconBadge
                  color="amber"
                  icon={<Building2 className="h-3.5 w-3.5" />}
                />
              }
              label="客户类型"
              value={
                <span className="font-bold text-slate-700">
                  {getCustomerTypeLabel(extendedInfo.customerType)}
                </span>
              }
            />
            <SectionItem
              icon={
                <IconBadge
                  color="orange"
                  icon={<Star className="h-3.5 w-3.5" />}
                />
              }
              label="客户等级"
              value={
                <span className="font-bold text-slate-700">
                  {extendedInfo.level
                    ? `${extendedInfo.level} 级客户`
                    : '标准级'}
                </span>
              }
            />
            <SectionItem
              icon={
                <IconBadge
                  color="teal"
                  icon={<Briefcase className="h-3.5 w-3.5" />}
                />
              }
              label="所属行业"
              value={
                <span className="font-bold text-slate-700">
                  {extendedInfo.industry || '通用贸易'}
                </span>
              }
            />
          </div>
        </section>

        {/* 财务授信用档案 */}
        <section className="rounded-lg border bg-white p-4 sm:p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900">结算信息</h3>
          </div>
          <div className="grid gap-4">
            <SectionItem
              icon={
                <IconBadge
                  color="emerald"
                  icon={<Wallet className="h-3.5 w-3.5" />}
                />
              }
              label="信用额度"
              value={
                <span className="font-mono font-semibold text-emerald-600">
                  {formatCurrency(extendedInfo.creditLimit || 0)}
                </span>
              }
            />
            <SectionItem
              icon={
                <IconBadge
                  color="blue"
                  icon={<CreditCard className="h-3.5 w-3.5" />}
                />
              }
              label="结算条款"
              value={
                <span className="font-bold text-slate-700">
                  {extendedInfo.paymentTerms || '现结/预付'}
                </span>
              }
            />
            <SectionItem
              icon={
                <IconBadge
                  color="slate"
                  icon={<FileText className="h-3.5 w-3.5" />}
                />
              }
              label="税号"
              value={
                <span className="font-mono text-sm font-bold text-slate-700">
                  {extendedInfo.taxNumber || '未填写'}
                </span>
              }
            />
          </div>
        </section>
      </div>

      {/* 备注与时间印戳 */}
      <section className="rounded-lg border bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl flex-1">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-900">补充备注</h3>
            </div>
            <p className="text-sm leading-relaxed text-slate-600">
              {extendedInfo.notes || '暂无补充说明'}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 border-t pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500">创建时间</p>
              <p className="font-mono text-xs text-slate-700">
                {formatDateTime(createdAt)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500">最后更新</p>
              <p className="font-mono text-xs text-slate-700">
                {formatDateTime(updatedAt)}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function getCustomerTypeLabel(type?: string) {
  if (!type) return '普通客户';
  const mapping: Record<string, string> = {
    company: '公司客户',
    store: '门店客户',
    individual: '个人客户',
  };
  return mapping[type] || type;
}

function SectionItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div className="space-y-0.5">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <div className="text-sm font-medium text-slate-700">{value}</div>
      </div>
    </div>
  );
}

function IconBadge({
  color,
  icon,
}: {
  color:
    | 'indigo'
    | 'emerald'
    | 'purple'
    | 'slate'
    | 'amber'
    | 'orange'
    | 'teal'
    | 'blue';
  icon: ReactNode;
}) {
  const styles = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    teal: 'bg-teal-50 text-teal-600 border-teal-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
  };

  return (
    <div
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-lg border',
        styles[color]
      )}
    >
      {icon}
    </div>
  );
}
