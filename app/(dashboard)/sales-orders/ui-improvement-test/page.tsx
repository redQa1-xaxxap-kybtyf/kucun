'use client';

import {
  ArrowLeft,
  CheckCircle,
  Eye,
  Lightbulb,
  Users,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

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
 * 调货销售UI改进测试页面
 *
 * 展示针对中国用户习惯的界面优化方案
 */
export default function UIImprovementTestPage() {
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
          <h1 className="text-2xl font-bold">
            调货销售界面优化 - 中国用户友好版
          </h1>
          <p className="text-muted-foreground">
            基于中国用户习惯的产品选择界面改进方案
          </p>
        </div>
      </div>

      {/* 改进概述 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-600" />
            设计理念：渐进式披露 + 智能检测
          </CardTitle>
          <CardDescription>
            摒弃复杂的模式切换，采用更符合中国用户习惯的统一界面设计
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <h4 className="font-medium text-green-700">✅ 改进后的优势</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span>
                    <strong>统一界面</strong>：无需模式切换，减少认知负担
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span>
                    <strong>渐进式披露</strong>：按需显示功能，界面更清爽
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span>
                    <strong>智能检测</strong>：自动识别用户意图，无需手动切换
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span>
                    <strong>视觉层次</strong>：清晰的信息架构，符合中国用户习惯
                  </span>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium text-red-700">❌ 原设计的问题</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-red-500">×</span>
                  <span>双按钮切换增加选择困难</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-red-500">×</span>
                  <span>界面跳动影响用户体验</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-red-500">×</span>
                  <span>Card组件层级过多，视觉混乱</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-red-500">×</span>
                  <span>不符合中国用户的操作习惯</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 设计原则 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            中国用户体验设计原则
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <Eye className="h-6 w-6 text-blue-600" />
              </div>
              <h4 className="font-medium">简洁优先</h4>
              <p className="text-sm text-muted-foreground">
                减少界面元素，突出核心功能，避免信息过载
              </p>
            </div>
            <div className="space-y-2 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <Zap className="h-6 w-6 text-green-600" />
              </div>
              <h4 className="font-medium">智能感知</h4>
              <p className="text-sm text-muted-foreground">
                系统主动识别用户意图，减少手动操作步骤
              </p>
            </div>
            <div className="space-y-2 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                <CheckCircle className="h-6 w-6 text-purple-600" />
              </div>
              <h4 className="font-medium">渐进披露</h4>
              <p className="text-sm text-muted-foreground">
                按需显示高级功能，保持界面整洁有序
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 具体改进点 */}
      <Card>
        <CardHeader>
          <CardTitle>具体改进措施</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-medium text-blue-700">1. 统一搜索入口</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                主搜索框提示&ldquo;搜索并选择商品，或在下方手动输入&rdquo;，给用户明确的操作指引
              </p>
            </div>

            <div className="border-l-4 border-green-500 pl-4">
              <h4 className="font-medium text-green-700">2. 智能模式切换</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                当用户开始输入商品名称时，系统自动切换到手动输入模式，无需手动切换
              </p>
            </div>

            <div className="border-l-4 border-purple-500 pl-4">
              <h4 className="font-medium text-purple-700">3. 渐进式显示</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                手动输入字段默认隐藏，通过&ldquo;手动输入临时商品信息&rdquo;按钮按需展开
              </p>
            </div>

            <div className="border-l-4 border-amber-500 pl-4">
              <h4 className="font-medium text-amber-700">4. 视觉层次优化</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                使用虚线边框和浅色背景区分临时商品区域，添加明确的标识和说明
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 技术实现 */}
      <Card>
        <CardHeader>
          <CardTitle>技术实现要点</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-medium">前端组件</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• UnifiedProductInput - 统一产品输入组件</li>
                <li>• 智能状态检测和自动切换逻辑</li>
                <li>• 渐进式字段显示/隐藏动画</li>
                <li>• 清晰的视觉层次和信息架构</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">交互逻辑</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• 监听用户输入自动切换模式</li>
                <li>• 智能清理冲突字段数据</li>
                <li>• 保持表单验证的完整性</li>
                <li>• 优化的错误提示和用户引导</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 测试指南 */}
      <Card>
        <CardHeader>
          <CardTitle>测试新界面</CardTitle>
          <CardDescription>体验改进后的产品选择界面</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">
                1
              </Badge>
              <div>
                <p className="font-medium">访问销售订单创建页面</p>
                <p className="text-sm text-muted-foreground">
                  选择&ldquo;调货销售&rdquo;类型，观察新的产品选择界面
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">
                2
              </Badge>
              <div>
                <p className="font-medium">测试库存商品选择</p>
                <p className="text-sm text-muted-foreground">
                  在搜索框中输入商品名称，选择库存商品
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">
                3
              </Badge>
              <div>
                <p className="font-medium">测试手动输入功能</p>
                <p className="text-sm text-muted-foreground">
                  点击&ldquo;手动输入临时商品信息&rdquo;按钮，体验渐进式显示
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">
                4
              </Badge>
              <div>
                <p className="font-medium">测试智能切换</p>
                <p className="text-sm text-muted-foreground">
                  在手动输入区域输入商品名称，观察自动模式切换
                </p>
              </div>
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
                <Eye className="mr-2 h-4 w-4" />
                体验新界面
              </Button>
            </Link>
            <Link href="/sales-orders/manual-product-test">
              <Button variant="outline">对比原界面</Button>
            </Link>
            <Link href="/sales-orders">
              <Button variant="outline">查看订单列表</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* 页面底部信息 */}
      <div className="text-center text-sm text-muted-foreground">
        <p>调货销售界面优化 - 更符合中国用户习惯的设计方案</p>
        <p className="mt-1">设计原则：简洁优先 + 智能感知 + 渐进披露</p>
      </div>
    </div>
  );
}
