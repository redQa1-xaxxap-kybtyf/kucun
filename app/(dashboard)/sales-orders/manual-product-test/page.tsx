'use client';

import { ArrowLeft, CheckCircle, Package, PenTool } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

/**
 * 调货销售手动输入商品功能测试页面
 *
 * 功能说明：
 * 1. 支持两种产品选择模式：库存选择和手动输入
 * 2. 手动输入模式允许用户输入临时商品信息
 * 3. 库存选择模式保持原有的产品搜索功能
 * 4. 调货销售订单可以混合使用两种模式
 */
export default function ManualProductTestPage() {
  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-4">
        <Link href="/sales-orders">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回订单列表
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">调货销售手动输入商品功能测试</h1>
          <p className="text-muted-foreground">
            测试调货销售订单的产品选择体验优化功能
          </p>
        </div>
      </div>

      {/* 功能概述 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            功能概述
          </CardTitle>
          <CardDescription>
            为调货销售订单提供灵活的产品选择方式，支持库存商品选择和临时商品手动输入
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-600" />
                <span className="font-medium">库存选择模式</span>
              </div>
              <ul className="ml-6 space-y-1 text-sm text-muted-foreground">
                <li>• 从现有商品库存中搜索和选择</li>
                <li>• 自动填充商品规格、单位等信息</li>
                <li>• 支持零库存产品选择（调货销售专用）</li>
                <li>• 保持与现有功能的兼容性</li>
              </ul>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <PenTool className="h-4 w-4 text-amber-600" />
                <span className="font-medium">手动输入模式</span>
              </div>
              <ul className="ml-6 space-y-1 text-sm text-muted-foreground">
                <li>• 手动输入临时商品名称和规格</li>
                <li>• 支持重量、单位等详细信息</li>
                <li>• 不会保存到商品库存中</li>
                <li>• 适用于一次性调货商品</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 测试指南 */}
      <Card>
        <CardHeader>
          <CardTitle>测试指南</CardTitle>
          <CardDescription>按照以下步骤测试手动输入商品功能</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">
                1
              </Badge>
              <div>
                <p className="font-medium">创建调货销售订单</p>
                <p className="text-sm text-muted-foreground">
                  访问销售订单创建页面，选择"调货销售"类型
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">
                2
              </Badge>
              <div>
                <p className="font-medium">测试产品选择模式切换</p>
                <p className="text-sm text-muted-foreground">
                  在产品明细中，观察"库存选择"和"手动输入"两个切换按钮
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">
                3
              </Badge>
              <div>
                <p className="font-medium">测试库存选择模式</p>
                <p className="text-sm text-muted-foreground">
                  点击"库存选择"，测试现有的产品搜索和选择功能
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">
                4
              </Badge>
              <div>
                <p className="font-medium">测试手动输入模式</p>
                <p className="text-sm text-muted-foreground">
                  点击"手动输入"，填写商品名称、规格、重量、单位等信息
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">
                5
              </Badge>
              <div>
                <p className="font-medium">测试混合使用</p>
                <p className="text-sm text-muted-foreground">
                  在同一个订单中，添加多个明细，分别使用不同的输入模式
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">
                6
              </Badge>
              <div>
                <p className="font-medium">验证数据保存</p>
                <p className="text-sm text-muted-foreground">
                  保存订单后，查看订单详情，确认手动输入的商品信息正确显示
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 技术实现要点 */}
      <Card>
        <CardHeader>
          <CardTitle>技术实现要点</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-medium">数据库扩展</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• productId字段改为可选</li>
                <li>• 新增isManualProduct标识字段</li>
                <li>• 新增手动输入商品信息字段</li>
                <li>• 保持向后兼容性</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">前端组件</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• EnhancedProductInput组件</li>
                <li>• 模式切换按钮</li>
                <li>• 条件显示输入字段</li>
                <li>• 实时表单验证</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 快速操作 */}
      <Card>
        <CardHeader>
          <CardTitle>快速操作</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link href="/sales-orders/create">
              <Button>
                <PenTool className="mr-2 h-4 w-4" />
                创建调货销售订单
              </Button>
            </Link>
            <Link href="/sales-orders">
              <Button variant="outline">
                <Package className="mr-2 h-4 w-4" />
                查看订单列表
              </Button>
            </Link>
            <Link href="/sales-orders/transfer-cost-test">
              <Button variant="outline">成本价管理测试</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* 页面底部信息 */}
      <div className="text-center text-sm text-muted-foreground">
        <p>调货销售手动输入商品功能 - 提升用户体验，支持临时商品管理</p>
        <p className="mt-1">
          技术栈：Next.js 15.4 + Prisma + TypeScript + shadcn/ui
        </p>
      </div>
    </div>
  );
}
