'use client';

import { ArrowLeft, Calculator, DollarSign, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ERPSalesOrderForm } from '@/components/sales-orders/erp-sales-order-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * 调货销售单品成本价测试页面
 * 用于验证调货销售功能的业务逻辑优化
 */
export default function TransferCostTestPage() {
  const router = useRouter();

  const handleSuccess = (orderId: string) => {
    // 订单创建成功，跳转到订单详情页
    router.push(`/sales-orders/${orderId}`);
  };

  const handleCancel = () => {
    router.push('/sales-orders');
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/sales-orders">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回订单列表
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">调货销售成本价测试</h1>
            <p className="text-muted-foreground">
              测试调货销售功能的单品成本价管理和财务计算
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="text-sm">
          测试功能
        </Badge>
      </div>

      {/* 功能说明卡片 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4 text-blue-500" />
              单品成本价
            </CardTitle>
            <CardDescription className="text-sm">
              每个产品可以单独设置成本价格
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">支持功能</span>
              <span className="font-medium">✓ 独立成本价</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">计算方式</span>
              <span className="font-medium">成本价 × 数量</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">零库存</span>
              <span className="font-medium">✓ 允许选择</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4 text-green-500" />
              财务计算
            </CardTitle>
            <CardDescription className="text-sm">
              自动计算成本、毛利和毛利率
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">总成本</span>
              <span className="font-medium">自动汇总</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">总毛利</span>
              <span className="font-medium">销售额 - 成本</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">毛利率</span>
              <span className="font-medium">毛利 ÷ 销售额</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              业务流程
            </CardTitle>
            <CardDescription className="text-sm">
              调货销售的完整业务逻辑
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">订单类型</span>
              <span className="font-medium">调货销售</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">供应商</span>
              <span className="font-medium">必填选择</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">库存处理</span>
              <span className="font-medium">支持零库存</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 测试说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">测试指南</CardTitle>
          <CardDescription>
            按照以下步骤测试调货销售的单品成本价功能
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <h4 className="text-sm font-medium">基础功能测试</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>1. 选择"调货销售"订单类型</li>
                <li>2. 选择供应商（必填）</li>
                <li>3. 添加产品明细</li>
                <li>4. 为每个产品设置成本价</li>
                <li>5. 观察毛利和毛利率的实时计算</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="text-sm font-medium">高级功能测试</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>1. 测试零库存产品选择</li>
                <li>2. 验证成本价输入验证</li>
                <li>3. 检查财务汇总计算准确性</li>
                <li>4. 测试多产品不同成本价场景</li>
                <li>5. 验证订单保存和数据完整性</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 销售订单表单 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">创建调货销售订单</CardTitle>
          <CardDescription>
            使用下面的表单测试调货销售的单品成本价功能
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ERPSalesOrderForm
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </CardContent>
      </Card>
    </div>
  );
}
