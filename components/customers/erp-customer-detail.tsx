/* eslint-disable max-lines-per-function */
'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  Edit,
  MapPin,
  Phone,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { customerQueryKeys, getCustomer } from '@/lib/api/customers';
import { CUSTOMER_FIELD_LABELS, type Customer } from '@/lib/types/customer';
import { formatDate } from '@/lib/utils/datetime';
import { getFriendlyErrorMessage } from '@/lib/utils/user-friendly-error';
import { parseExtendedInfo } from '@/lib/validations/customer';

interface ERPCustomerDetailProps {
  customerId: string;
  onEdit?: (customer: Customer) => void;
  onBack?: () => void;
  showActions?: boolean;
}

/**
 * ERP风格的客户详情组件
 * 采用紧凑布局，符合中国ERP系统用户习惯
 */
export function ERPCustomerDetail({
  customerId,
  onEdit,
  onBack,
  showActions = true,
}: ERPCustomerDetailProps) {
  const router = useRouter();

  const {
    data: customer,
    isLoading,
    error,
  } = useQuery({
    queryKey: customerQueryKeys.detail(customerId),
    queryFn: () => getCustomer(customerId),
    enabled: !!customerId,
  });

  // 处理返回
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  // 处理编辑
  const handleEdit = () => {
    if (customer) {
      if (onEdit) {
        onEdit(customer);
      } else {
        router.push(`/customers/${customer.id}/edit`);
      }
    }
  };

  const formatExtendedInfoValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return '-';
    }
    if (Array.isArray(value)) {
      return value.length ? value.join('、') : '-';
    }
    if (value instanceof Date) {
      return formatDate(value.toISOString());
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded border">
        <div className="bg-muted/30 border-b px-3 py-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">客户详情</h3>
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="text-muted-foreground text-center text-xs">
            加载中...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card rounded border">
        <div className="bg-muted/30 border-b px-3 py-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">客户详情</h3>
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="text-center text-xs text-[hsl(var(--color-error))]">
            加载失败: {getFriendlyErrorMessage(error, '请稍后重试')}
          </div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="bg-card rounded border">
        <div className="bg-muted/30 border-b px-3 py-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">客户详情</h3>
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="text-muted-foreground text-center text-xs">
            客户不存在
          </div>
        </div>
      </div>
    );
  }

  const parsedExtendedInfo =
    typeof customer.extendedInfo === 'string'
      ? parseExtendedInfo(customer.extendedInfo)
      : customer.extendedInfo || {};

  const extendedInfoEntries = Object.entries(parsedExtendedInfo).filter(
    ([, value]) => {
      if (value === null || value === undefined) {
        return false;
      }
      if (typeof value === 'string') {
        return value.trim().length > 0;
      }
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return true;
    }
  );

  return (
    <div className="bg-card rounded border">
      {/* ERP标准工具栏 */}
      <div className="bg-muted/30 border-b px-3 py-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">客户详情</h3>
          {showActions && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={handleBack}
              >
                <ArrowLeft className="mr-1 h-3 w-3" />
                返回
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={handleEdit}
              >
                <Edit className="mr-1 h-3 w-3" />
                编辑
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 详情内容 */}
      <div className="px-3 py-2">
        {/* 基本信息区域 */}
        <div className="space-y-3">
          <div className="text-muted-foreground text-xs font-medium">
            基本信息
          </div>

          {/* 客户名称 */}
          <div className="flex items-center gap-2">
            <Users className="text-muted-foreground h-3 w-3" />
            <span className="text-sm font-medium">{customer.name}</span>
          </div>

          {/* 联系信息 */}
          <div className="grid grid-cols-1 gap-y-2 md:grid-cols-2">
            {customer.phone && (
              <div className="flex items-center gap-2">
                <Phone className="text-muted-foreground h-3 w-3" />
                <span className="text-xs">{customer.phone}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Calendar className="text-muted-foreground h-3 w-3" />
              <span className="text-xs">
                创建于 {formatDate(customer.createdAt)}
              </span>
            </div>
          </div>

          {/* 地址信息 */}
          {customer.address && (
            <div className="flex items-start gap-2">
              <MapPin className="text-muted-foreground mt-0.5 h-3 w-3" />
              <span className="text-xs">{customer.address}</span>
            </div>
          )}
        </div>

        {/* 业务统计区域 */}
        <div className="mt-4 space-y-3">
          <div className="text-muted-foreground text-xs font-medium">
            业务统计
          </div>
          <div className="grid grid-cols-3 gap-2">
            {/* 交易次数 */}
            <div className="rounded border border-[hsl(var(--color-primary-light))] bg-[hsl(var(--color-primary-light))] px-2 py-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <TrendingUp className="h-3 w-3 text-[hsl(var(--color-primary))]" />
                <span className="text-sm font-medium text-[hsl(var(--color-primary))]">
                  {customer.transactionCount || 0}
                </span>
              </div>
              <div className="text-muted-foreground text-xs">交易次数</div>
            </div>

            {/* 合作天数 */}
            <div className="rounded border border-[hsl(var(--color-success-light))] bg-[hsl(var(--color-success-light))] px-2 py-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <Calendar className="h-3 w-3 text-[hsl(var(--color-success))]" />
                <span className="text-sm font-medium text-[hsl(var(--color-success))]">
                  {customer.cooperationDays !== undefined
                    ? customer.cooperationDays
                    : '-'}
                </span>
              </div>
              <div className="text-muted-foreground text-xs">
                {customer.cooperationDays !== undefined ? '合作天数' : '未下单'}
              </div>
            </div>

            {/* 退货次数 */}
            <div className="rounded border border-[hsl(var(--color-error-light))] bg-[hsl(var(--color-error-light))] px-2 py-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <TrendingDown className="h-3 w-3 text-[hsl(var(--color-error))]" />
                <span className="text-sm font-medium text-[hsl(var(--color-error))]">
                  {customer.returnOrderCount || 0}
                </span>
              </div>
              <div className="text-muted-foreground text-xs">退货次数</div>
            </div>
          </div>
        </div>

        {/* 客户状态 */}
        <div className="mt-4 space-y-3">
          <div className="text-muted-foreground text-xs font-medium">
            客户状态
          </div>
          {(() => {
            const transactionCount = customer.transactionCount ?? 0;
            const returnOrderCount = customer.returnOrderCount ?? 0;
            const cooperationDays = customer.cooperationDays;
            const statusVariant =
              cooperationDays !== undefined && cooperationDays > 0
                ? 'default'
                : transactionCount > 0
                  ? 'secondary'
                  : 'outline';
            const statusLabel =
              cooperationDays !== undefined && cooperationDays > 0
                ? '活跃客户'
                : transactionCount > 0
                  ? '潜在客户'
                  : '新客户';
            const hasReturnRecord = returnOrderCount > 0;

            return (
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant} className="text-xs">
                  {statusLabel}
                </Badge>

                {hasReturnRecord && (
                  <Badge variant="destructive" className="text-xs">
                    有退货记录
                  </Badge>
                )}
              </div>
            );
          })()}
        </div>

        {/* 扩展信息 */}
        {extendedInfoEntries.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="text-muted-foreground text-xs font-medium">
              扩展信息
            </div>
            <div className="bg-muted/5 rounded border px-2 py-2">
              <div className="space-y-2">
                {extendedInfoEntries.map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-muted-foreground text-xs">
                      {CUSTOMER_FIELD_LABELS[
                        key as keyof typeof CUSTOMER_FIELD_LABELS
                      ] || key}
                    </span>
                    <span className="text-xs">
                      {formatExtendedInfoValue(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
