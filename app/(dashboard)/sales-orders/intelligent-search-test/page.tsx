'use client';

import { ArrowLeft, CheckCircle, Lightbulb, Search, Zap } from 'lucide-react';
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
 * 智能产品搜索测试页面
 *
 * 展示智能搜索 + 弹窗添加临时产品的功能
 */
export default function IntelligentSearchTestPage() {
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
            智能产品搜索 - 搜索无结果自动弹窗添加
          </h1>
          <p className="text-muted-foreground">
            基于智能搜索 + 弹窗添加机制的产品选择体验优化
          </p>
        </div>
      </div>

      {/* 功能概述 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-600" />
            核心功能：智能搜索 + 弹窗添加机制
          </CardTitle>
          <CardDescription>
            当搜索无结果时，自动提供添加临时产品的选项，实现无缝的用户体验
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <h4 className="font-medium text-green-700">✅ 核心优势</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  <span>
                    <strong>智能搜索</strong>
                    ：支持商品名称、编码、规格的模糊搜索
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  <span>
                    <strong>无缝添加</strong>：搜索无结果时自动提供添加选项
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  <span>
                    <strong>预填信息</strong>：对话框自动预填用户搜索的关键词
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  <span>
                    <strong>通用功能</strong>
                    ：不仅限于调货销售，所有订单都可使用
                  </span>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium text-blue-700">🎯 业务场景支持</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-blue-500">•</span>
                  <span>正常销售：库存商品 + 临时商品混合</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-blue-500">•</span>
                  <span>调货销售：供应商调入商品 + 库存商品</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-blue-500">•</span>
                  <span>成本价管理：调货销售中的灵活成本输入</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-blue-500">•</span>
                  <span>临时商品标识：清晰区分库存商品和临时商品</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 功能流程 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-600" />
            智能搜索流程
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
                <span className="text-sm font-medium text-blue-600">1</span>
              </div>
              <div>
                <h4 className="font-medium">用户输入搜索关键词</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  在产品搜索框中输入商品名称、编码或规格关键词
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100">
                <span className="text-sm font-medium text-green-600">2</span>
              </div>
              <div>
                <h4 className="font-medium">系统执行智能搜索</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  对商品名称、编码、规格进行模糊匹配，显示匹配结果
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <span className="text-sm font-medium text-amber-600">3</span>
              </div>
              <div>
                <h4 className="font-medium">搜索无结果时的智能处理</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  如果没有找到匹配的库存商品，自动显示&ldquo;添加为临时商品&rdquo;按钮
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100">
                <span className="text-sm font-medium text-purple-600">4</span>
              </div>
              <div>
                <h4 className="font-medium">弹窗添加临时商品</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  点击按钮后弹出对话框，自动预填搜索关键词作为商品名称
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100">
                <span className="text-sm font-medium text-indigo-600">5</span>
              </div>
              <div>
                <h4 className="font-medium">完善商品信息并添加</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  用户补充规格、重量、单位等信息，确认添加到订单明细
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 技术特性 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-600" />
            技术实现特性
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-medium">智能搜索组件</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• SmartProductSearch - 智能产品搜索</li>
                <li>• 支持多字段模糊匹配</li>
                <li>• 实时搜索结果过滤</li>
                <li>• 搜索无结果时的智能提示</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">弹窗添加组件</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• AddTemporaryProductDialog - 添加临时产品对话框</li>
                <li>• 自动预填搜索关键词</li>
                <li>• 完整的表单验证</li>
                <li>• 用户友好的交互设计</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 调货销售混合场景 */}
      <Card>
        <CardHeader>
          <CardTitle>调货销售混合场景处理</CardTitle>
          <CardDescription>
            支持在同一订单中混合使用库存商品和临时商品，灵活的成本价管理
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-medium text-blue-700">库存商品 + 成本价</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                选择库存中的现有商品，在调货销售订单中可以输入成本价用于毛利计算
              </p>
            </div>

            <div className="border-l-4 border-green-500 pl-4">
              <h4 className="font-medium text-green-700">临时商品 + 成本价</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                添加从供应商调入的临时商品，同样支持成本价输入和毛利计算
              </p>
            </div>

            <div className="border-l-4 border-purple-500 pl-4">
              <h4 className="font-medium text-purple-700">混合销售判断逻辑</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                在调货销售订单中，如果商品输入了成本价，则按调货商品处理；否则按正常销售处理
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 测试指南 */}
      <Card>
        <CardHeader>
          <CardTitle>功能测试指南</CardTitle>
          <CardDescription>
            按照以下步骤测试智能搜索和临时产品添加功能
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">
                1
              </Badge>
              <div>
                <p className="font-medium">测试智能搜索</p>
                <p className="text-sm text-muted-foreground">
                  在产品搜索框中输入存在的商品关键词，观察搜索结果显示
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">
                2
              </Badge>
              <div>
                <p className="font-medium">测试无结果处理</p>
                <p className="text-sm text-muted-foreground">
                  输入不存在的商品名称，观察&ldquo;添加为临时商品&rdquo;按钮出现
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">
                3
              </Badge>
              <div>
                <p className="font-medium">测试弹窗添加</p>
                <p className="text-sm text-muted-foreground">
                  点击添加按钮，观察对话框弹出并预填搜索关键词
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">
                4
              </Badge>
              <div>
                <p className="font-medium">测试混合场景</p>
                <p className="text-sm text-muted-foreground">
                  在调货销售订单中混合添加库存商品和临时商品，测试成本价功能
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
                <Search className="mr-2 h-4 w-4" />
                体验智能搜索
              </Button>
            </Link>
            <Link href="/sales-orders/ui-improvement-test">
              <Button variant="outline">查看界面优化方案</Button>
            </Link>
            <Link href="/sales-orders">
              <Button variant="outline">返回订单列表</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* 页面底部信息 */}
      <div className="text-center text-sm text-muted-foreground">
        <p>智能产品搜索功能 - 搜索无结果自动弹窗添加临时产品</p>
        <p className="mt-1">核心特性：智能搜索 + 弹窗添加 + 混合场景支持</p>
      </div>
    </div>
  );
}
