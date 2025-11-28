'use client';

import {
  Briefcase,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  Globe,
  Mail,
  MapPin,
  Phone,
  Star,
  User,
  Wallet,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/utils';

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
    <Card>
      <CardContent className="p-4">
        <div className="space-y-3">
          <BasicContactInfo
            contactPerson={extendedInfo.contactPerson}
            phone={phone}
            phone2={extendedInfo.phone2}
            phone3={extendedInfo.phone3}
            email={extendedInfo.email}
            fax={extendedInfo.fax}
            address={address}
            website={extendedInfo.website}
          />

          {(extendedInfo.customerType ||
            extendedInfo.level ||
            extendedInfo.industry ||
            extendedInfo.region) && (
            <>
              <Separator />
              <CustomerAttributes
                customerType={extendedInfo.customerType}
                level={extendedInfo.level}
                industry={extendedInfo.industry}
                region={extendedInfo.region}
              />
            </>
          )}

          {(extendedInfo.creditLimit ||
            extendedInfo.paymentTerms ||
            extendedInfo.taxNumber ||
            extendedInfo.bankAccount) && (
            <>
              <Separator />
              <FinancialInfo
                creditLimit={extendedInfo.creditLimit}
                paymentTerms={extendedInfo.paymentTerms}
                taxNumber={extendedInfo.taxNumber}
                bankAccount={extendedInfo.bankAccount}
              />
            </>
          )}

          {extendedInfo.notes && (
            <>
              <Separator />
              <NotesInfo notes={extendedInfo.notes} />
            </>
          )}

          <Separator />
          <div className="grid gap-2 sm:grid-cols-2">
            <DateLabel
              icon={<CalendarIcon />}
              label="创建时间"
              value={formatDateTime(createdAt)}
            />
            <DateLabel
              icon={<CalendarIcon />}
              label="最后更新"
              value={formatDateTime(updatedAt)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CalendarIcon() {
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100">
      <Calendar className="h-3.5 w-3.5 text-gray-600" />
    </div>
  );
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
    <div className="flex items-center gap-2">
      {icon}
      <div className="flex-1">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function BasicContactInfo({
  contactPerson,
  phone,
  phone2,
  phone3,
  email,
  fax,
  address,
  website,
}: {
  contactPerson?: string;
  phone?: string;
  phone2?: string;
  phone3?: string;
  email?: string;
  fax?: string;
  address?: string;
  website?: string;
}) {
  return (
    <div className="space-y-2">
      {contactPerson && (
        <SectionItem
          icon={
            <IconBadge
              color="bg-[hsl(var(--color-primary-light))]"
              icon={
                <User className="h-3.5 w-3.5 text-[hsl(var(--color-primary))]" />
              }
            />
          }
          label="联系人"
          value={contactPerson}
        />
      )}
      {phone && (
        <SectionItem
          icon={
            <IconBadge
              color="bg-green-100"
              icon={<Phone className="h-3.5 w-3.5 text-green-600" />}
            />
          }
          label="联系电话"
          value={<span className="font-mono text-sm font-medium">{phone}</span>}
        />
      )}
      {phone2 && (
        <SectionItem
          icon={
            <IconBadge
              color="bg-green-100"
              icon={<Phone className="h-3.5 w-3.5 text-green-600" />}
            />
          }
          label="备用电话1"
          value={
            <span className="font-mono text-sm font-medium">{phone2}</span>
          }
        />
      )}
      {phone3 && (
        <SectionItem
          icon={
            <IconBadge
              color="bg-green-100"
              icon={<Phone className="h-3.5 w-3.5 text-green-600" />}
            />
          }
          label="备用电话2"
          value={
            <span className="font-mono text-sm font-medium">{phone3}</span>
          }
        />
      )}
      {email && (
        <SectionItem
          icon={
            <IconBadge
              color="bg-purple-100"
              icon={<Mail className="h-3.5 w-3.5 text-purple-600" />}
            />
          }
          label="邮箱地址"
          value={<span className="font-mono text-sm">{email}</span>}
        />
      )}
      {fax && (
        <SectionItem
          icon={
            <IconBadge
              color="bg-gray-100"
              icon={<Phone className="h-3.5 w-3.5 text-gray-600" />}
            />
          }
          label="传真号码"
          value={<span className="font-mono text-sm">{fax}</span>}
        />
      )}
      {address && (
        <div className="flex items-start gap-2">
          <IconBadge
            color="bg-indigo-100"
            icon={<MapPin className="h-3.5 w-3.5 text-indigo-600" />}
          />
          <div className="flex-1">
            <p className="text-muted-foreground text-xs">地址</p>
            <p className="text-sm">{address}</p>
          </div>
        </div>
      )}
      {website && (
        <SectionItem
          icon={
            <IconBadge
              color="bg-cyan-100"
              icon={<Globe className="h-3.5 w-3.5 text-cyan-600" />}
            />
          }
          label="网站"
          value={website}
        />
      )}
    </div>
  );
}

function CustomerAttributes({
  customerType,
  level,
  industry,
  region,
}: Pick<
  CustomerExtendedInfo,
  'customerType' | 'level' | 'industry' | 'region'
>) {
  const typeLabel =
    customerType === 'company'
      ? '公司'
      : customerType === 'store'
        ? '门店'
        : customerType === 'individual'
          ? '个人'
          : customerType;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {customerType && (
        <SectionItem
          icon={
            <IconBadge
              color="bg-yellow-100"
              icon={<Building2 className="h-3.5 w-3.5 text-yellow-600" />}
            />
          }
          label="客户类型"
          value={typeLabel}
        />
      )}
      {level && (
        <SectionItem
          icon={
            <IconBadge
              color="bg-orange-100"
              icon={<Star className="h-3.5 w-3.5 text-orange-600" />}
            />
          }
          label="客户等级"
          value={`${level}级`}
        />
      )}
      {industry && (
        <SectionItem
          icon={
            <IconBadge
              color="bg-teal-100"
              icon={<Briefcase className="h-3.5 w-3.5 text-teal-600" />}
            />
          }
          label="所属行业"
          value={industry}
        />
      )}
      {region && (
        <SectionItem
          icon={
            <IconBadge
              color="bg-pink-100"
              icon={<MapPin className="h-3.5 w-3.5 text-pink-600" />}
            />
          }
          label="所属区域"
          value={region}
        />
      )}
    </div>
  );
}

function FinancialInfo({
  creditLimit,
  paymentTerms,
  taxNumber,
  bankAccount,
}: Pick<
  CustomerExtendedInfo,
  'creditLimit' | 'paymentTerms' | 'taxNumber' | 'bankAccount'
>) {
  return (
    <div className="space-y-2">
      {typeof creditLimit === 'number' && (
        <SectionItem
          icon={
            <IconBadge
              color="bg-emerald-100"
              icon={<Wallet className="h-3.5 w-3.5 text-emerald-600" />}
            />
          }
          label="信用额度"
          value={
            <span className="text-sm font-semibold text-emerald-600">
              {formatCurrency(creditLimit)}
            </span>
          }
        />
      )}
      {paymentTerms && (
        <SectionItem
          icon={
            <IconBadge
              color="bg-amber-100"
              icon={<FileText className="h-3.5 w-3.5 text-amber-600" />}
            />
          }
          label="付款条款"
          value={paymentTerms}
        />
      )}
      {taxNumber && (
        <SectionItem
          icon={
            <IconBadge
              color="bg-slate-100"
              icon={<CreditCard className="h-3.5 w-3.5 text-slate-600" />}
            />
          }
          label="税号"
          value={<span className="font-mono text-sm">{taxNumber}</span>}
        />
      )}
      {bankAccount && (
        <SectionItem
          icon={
            <IconBadge
              color="bg-sky-100"
              icon={<CreditCard className="h-3.5 w-3.5 text-sky-600" />}
            />
          }
          label="银行账号"
          value={<span className="font-mono text-sm">{bankAccount}</span>}
        />
      )}
    </div>
  );
}

function NotesInfo({ notes }: { notes: string }) {
  return (
    <div className="flex items-start gap-2">
      <IconBadge
        color="bg-amber-100"
        icon={<FileText className="h-3.5 w-3.5 text-amber-600" />}
      />
      <div className="flex-1">
        <p className="text-muted-foreground text-xs">备注信息</p>
        <p className="text-muted-foreground text-sm">{notes}</p>
      </div>
    </div>
  );
}

function DateLabel({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div className="flex-1">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}

function IconBadge({ color, icon }: { color: string; icon: ReactNode }) {
  return (
    <div
      className={`flex h-7 w-7 items-center justify-center rounded-lg ${color}`}
    >
      {icon}
    </div>
  );
}
