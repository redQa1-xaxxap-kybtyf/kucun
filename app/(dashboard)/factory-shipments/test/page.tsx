'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * 厂家发货功能测试页面
 * 用于验证厂家发货管理功能的基本操作
 */
export default function FactoryShipmentTestPage() {
  const [testResults, setTestResults] = useState<string[]>([]);

  const addResult = (result: string) => {
    setTestResults(prev => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${result}`,
    ]);
  };

  const testDatabaseConnection = async () => {
    try {
      const response = await fetch('/api/factory-shipments');
      if (response.ok) {
        addResult('✅ 数据库连接成功 - API响应正常');
      } else {
        addResult(`❌ 数据库连接失败 - 状态码: ${response.status}`);
      }
    } catch (error) {
      addResult(`❌ 数据库连接失败 - 错误: ${error}`);
    }
  };

  const testNavigation = () => {
    addResult('✅ 导航测试 - 厂家发货测试页面加载成功');
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="container mx-auto py-6">
      <div className="space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">厂家发货功能测试</h1>
          <p className="mt-2 text-gray-600">
            验证厂家发货管理功能的基本操作和数据库连接
          </p>
        </div>

        {/* 功能概述 */}
        <Card>
          <CardHeader>
            <CardTitle>厂家发货管理功能概述</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <h3 className="font-semibold text-gray-900">核心业务特点</h3>
                <ul className="mt-2 space-y-1 text-sm text-gray-600">
                  <li>• 绕过库存系统，商品直接从供应商发往客户</li>
                  <li>• 复用智能产品搜索功能</li>
                  <li>• 支持多供应商订单</li>
                  <li>• 财务简化，只记录应收账款</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">订单状态流程</h3>
                <ul className="mt-2 space-y-1 text-sm text-gray-600">
                  <li>• 草稿 → 计划中 → 待定金 → 已付定金</li>
                  <li>• 工厂发货 → 运输中 → 到港 → 已收货</li>
                  <li>• 已完成（货款付完）</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 测试操作 */}
        <Card>
          <CardHeader>
            <CardTitle>功能测试</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <Button onClick={testNavigation} variant="outline">
                  测试页面导航
                </Button>
                <Button onClick={testDatabaseConnection} variant="outline">
                  测试数据库连接
                </Button>
                <Button onClick={clearResults} variant="secondary">
                  清空结果
                </Button>
              </div>

              {/* 快速导航 */}
              <div className="border-t pt-4">
                <h3 className="mb-3 font-semibold text-gray-900">快速导航</h3>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link href="/factory-shipments">厂家发货列表</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/factory-shipments/create">创建发货订单</Link>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 测试结果 */}
        {testResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>测试结果</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {testResults.map((result, index) => (
                  <div
                    key={index}
                    className="rounded-md bg-gray-50 p-3 font-mono text-sm"
                  >
                    {result}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 技术实现说明 */}
        <Card>
          <CardHeader>
            <CardTitle>技术实现说明</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <h3 className="font-semibold text-gray-900">数据库设计</h3>
                <ul className="mt-2 space-y-1 text-sm text-gray-600">
                  <li>• FactoryShipmentOrder - 厂家发货订单主表</li>
                  <li>• FactoryShipmentOrderItem - 订单明细表</li>
                  <li>• 支持库存商品和临时商品</li>
                  <li>• 完整的关系映射和约束</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">API接口</h3>
                <ul className="mt-2 space-y-1 text-sm text-gray-600">
                  <li>• GET /api/factory-shipments - 订单列表</li>
                  <li>• POST /api/factory-shipments - 创建订单</li>
                  <li>• GET /api/factory-shipments/[id] - 订单详情</li>
                  <li>• PUT /api/factory-shipments/[id] - 更新订单</li>
                  <li>• DELETE /api/factory-shipments/[id] - 删除订单</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">前端组件</h3>
                <ul className="mt-2 space-y-1 text-sm text-gray-600">
                  <li>• FactoryShipmentOrderList - 订单列表</li>
                  <li>• FactoryShipmentOrderForm - 订单表单</li>
                  <li>• FactoryShipmentOrderDetail - 订单详情</li>
                  <li>• 复用IntelligentProductInput组件</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">类型安全</h3>
                <ul className="mt-2 space-y-1 text-sm text-gray-600">
                  <li>• TypeScript严格模式</li>
                  <li>• Zod数据验证</li>
                  <li>• Prisma类型生成</li>
                  <li>• 端到端类型安全</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
