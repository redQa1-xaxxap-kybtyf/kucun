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
import type { Customer } from '@/lib/types/customer';

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

  const { data: customer, isLoading, error } = useQuery({
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

  // 格式化日期
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('zh-CN');

  if (isLoading) {
    return (
      <div className="rounded border bg-card">
        <div className="border-b bg-muted/30 px-3 py-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">客户详情</h3>
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="text-center text-xs text-muted-foreground">
            加载中...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded border bg-card">
        <div className="border-b bg-muted/30 px-3 py-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">客户详情</h3>
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="text-center text-xs text-red-600">
            加载失败: {error instanceof Error ? error.message : '未知错误'}
          </div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="rounded border bg-card">
        <div className="border-b bg-muted/30 px-3 py-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">客户详情</h3>
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="text-center text-xs text-muted-foreground">
            客户不存在
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded border bg-card">
      {/* ERP标准工具栏 */}
      <div className="border-b bg-muted/30 px-3 py-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">客户详情</h3>
          {showActions && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-7" onClick={handleBack}>
                <ArrowLeft className="mr-1 h-3 w-3" />
                返回
              </Button>
              <Button variant="outline" size="sm" className="h-7" onClick={handleEdit}>
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
          <div className="text-xs font-medium text-muted-foreground">基本信息</div>
          
          {/* 客户名称 */}
          <div className="flex items-center gap-2">
            <Users className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm font-medium">{customer.name}</span>
          </div>

          {/* 联系信息 */}
          <div className="grid grid-cols-1 gap-y-2 md:grid-cols-2">
            {customer.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs">{customer.phone}</span>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs">创建于 {formatDate(customer.createdAt)}</span>
            </div>
          </div>

          {/* 地址信息 */}
          {customer.address && (
            <div className="flex items-start gap-2">
              <MapPin className="h-3 w-3 text-muted-foreground mt-0.5" />
              <span className="text-xs">{customer.address}</span>
            </div>
          )}
        </div>

        {/* 业务统计区域 */}
        <div className="mt-4 space-y-3">
          <div className="text-xs font-medium text-muted-foreground">业务统计</div>
          <div className="grid grid-cols-3 gap-2">
            {/* 交易次数 */}
            <div className="rounded border bg-muted/10 px-2 py-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <TrendingUp className="h-3 w-3 text-blue-600" />
                <span className="text-sm font-medium text-blue-600">
                  {customer.transactionCount || 0}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">交易次数</div>
            </div>

            {/* 合作天数 */}
            <div className="rounded border bg-muted/10 px-2 py-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <Calendar className="h-3 w-3 text-green-600" />
                <span className="text-sm font-medium text-green-600">
                  {customer.cooperationDays !== undefined 
                    ? customer.cooperationDays 
                    : '-'
                  }
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {customer.cooperationDays !== undefined ? '合作天数' : '未下单'}
              </div>
            </div>

            {/* 退货次数 */}
            <div className="rounded border bg-muted/10 px-2 py-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <TrendingDown className="h-3 w-3 text-red-600" />
                <span className="text-sm font-medium text-red-600">
                  {customer.returnOrderCount || 0}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">退货次数</div>
            </div>
          </div>
        </div>

        {/* 客户状态 */}
        <div className="mt-4 space-y-3">
          <div className="text-xs font-medium text-muted-foreground">客户状态</div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                customer.cooperationDays !== undefined && customer.cooperationDays > 0
                  ? 'default'
                  : customer.transactionCount && customer.transactionCount > 0
                  ? 'secondary'
                  : 'outline'
              }
              className="text-xs"
            >
              {customer.cooperationDays !== undefined && customer.cooperationDays > 0
                ? '活跃客户'
                : customer.transactionCount && customer.transactionCount > 0
                ? '潜在客户'
                : '新客户'}
            </Badge>
            
            {customer.returnOrderCount && customer.returnOrderCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                有退货记录
              </Badge>
            )}
          </div>
        </div>

        {/* 扩展信息 */}
        {customer.extendedInfo && Object.keys(customer.extendedInfo).length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="text-xs font-medium text-muted-foreground">扩展信息</div>
            <div className="rounded border bg-muted/5 px-2 py-2">
              <div className="text-xs text-muted-foreground">
                {JSON.stringify(customer.extendedInfo, null, 2)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
