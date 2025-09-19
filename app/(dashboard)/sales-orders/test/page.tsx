'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle, Package } from 'lucide-react';

import { customerQueryKeys, getCustomers } from '@/lib/api/customers';
import { getProducts, productQueryKeys } from '@/lib/api/products';
import { getSalesOrders, salesOrderQueryKeys } from '@/lib/api/sales-orders';

/**
 * 销售订单功能测试页面
 * 验证所有相关API和组件是否正常工作
 */
export default function SalesOrderTestPage() {
  const [testResults, setTestResults] = React.useState<Record<string, boolean>>({});

  // 测试客户API
  const { data: customersData, isLoading: customersLoading, error: customersError } = useQuery({
    queryKey: customerQueryKeys.list({ page: 1, limit: 10 }),
    queryFn: () => getCustomers({ page: 1, limit: 10 }),
  });

  // 测试产品API
  const { data: productsData, isLoading: productsLoading, error: productsError } = useQuery({
    queryKey: productQueryKeys.list({ page: 1, limit: 10 }),
    queryFn: () => getProducts({ page: 1, limit: 10 }),
  });

  // 测试销售订单API
  const { data: salesOrdersData, isLoading: salesOrdersLoading, error: salesOrdersError } = useQuery({
    queryKey: salesOrderQueryKeys.list({ page: 1, limit: 10 }),
    queryFn: () => getSalesOrders({ page: 1, limit: 10 }),
  });

  // 测试订单号生成API
  const [orderNumberTest, setOrderNumberTest] = React.useState<{
    loading: boolean;
    result?: any;
    error?: string;
  }>({ loading: false });

  const testOrderNumberGeneration = async () => {
    setOrderNumberTest({ loading: true });
    try {
      const response = await fetch('/api/sales-orders/generate-order-number?action=generate');
      const data = await response.json();
      setOrderNumberTest({ loading: false, result: data });
    } catch (error) {
      setOrderNumberTest({ 
        loading: false, 
        error: error instanceof Error ? error.message : '测试失败' 
      });
    }
  };

  // 获取测试状态
  const getTestStatus = (loading: boolean, error: any, data: any) => {
    if (loading) return 'loading';
    if (error) return 'error';
    if (data) return 'success';
    return 'pending';
  };

  const renderTestResult = (status: string, title: string, description?: string) => {
    const getIcon = () => {
      switch (status) {
        case 'success':
          return <CheckCircle className="h-5 w-5 text-green-600" />;
        case 'error':
          return <XCircle className="h-5 w-5 text-red-600" />;
        case 'loading':
          return <AlertTriangle className="h-5 w-5 text-yellow-600 animate-pulse" />;
        default:
          return <Package className="h-5 w-5 text-gray-400" />;
      }
    };

    const getVariant = () => {
      switch (status) {
        case 'success':
          return 'default';
        case 'error':
          return 'destructive';
        case 'loading':
          return 'secondary';
        default:
          return 'outline';
      }
    };

    return (
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex items-center gap-3">
          {getIcon()}
          <div>
            <div className="font-medium">{title}</div>
            {description && (
              <div className="text-sm text-muted-foreground">{description}</div>
            )}
          </div>
        </div>
        <Badge variant={getVariant()}>
          {status === 'loading' ? '测试中...' : 
           status === 'success' ? '通过' :
           status === 'error' ? '失败' : '待测试'}
        </Badge>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">销售订单功能测试</h1>
        <p className="text-muted-foreground">
          验证销售订单相关的API接口和组件功能
        </p>
      </div>

      {/* API测试结果 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>API接口测试</CardTitle>
            <CardDescription>测试相关API接口的可用性</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderTestResult(
              getTestStatus(customersLoading, customersError, customersData),
              '客户管理API',
              customersData ? `获取到 ${customersData.data?.length || 0} 个客户` : 
              customersError ? '客户API调用失败' : '正在测试...'
            )}

            {renderTestResult(
              getTestStatus(productsLoading, productsError, productsData),
              '产品管理API',
              productsData ? `获取到 ${productsData.data?.length || 0} 个产品` : 
              productsError ? '产品API调用失败' : '正在测试...'
            )}

            {renderTestResult(
              getTestStatus(salesOrdersLoading, salesOrdersError, salesOrdersData),
              '销售订单API',
              salesOrdersData ? `获取到 ${salesOrdersData.data?.length || 0} 个订单` : 
              salesOrdersError ? '订单API调用失败' : '正在测试...'
            )}

            {renderTestResult(
              orderNumberTest.loading ? 'loading' : 
              orderNumberTest.error ? 'error' : 
              orderNumberTest.result ? 'success' : 'pending',
              '订单号生成API',
              orderNumberTest.result ? `生成订单号: ${orderNumberTest.result.data?.orderNumber}` :
              orderNumberTest.error ? orderNumberTest.error : '点击按钮测试'
            )}

            <Button 
              onClick={testOrderNumberGeneration}
              disabled={orderNumberTest.loading}
              className="w-full"
            >
              {orderNumberTest.loading ? '测试中...' : '测试订单号生成'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>数据统计</CardTitle>
            <CardDescription>当前系统数据概览</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {customersData?.data?.length || 0}
                </div>
                <div className="text-sm text-blue-600">客户总数</div>
              </div>
              
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {productsData?.data?.length || 0}
                </div>
                <div className="text-sm text-green-600">产品总数</div>
              </div>
              
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {salesOrdersData?.data?.length || 0}
                </div>
                <div className="text-sm text-purple-600">订单总数</div>
              </div>
              
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {salesOrdersData?.pagination?.total || 0}
                </div>
                <div className="text-sm text-orange-600">历史订单</div>
              </div>
            </div>

            {/* 库存状态统计 */}
            {productsData?.data && (
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">库存状态统计</h4>
                <div className="space-y-2">
                  {(() => {
                    const products = productsData.data;
                    const totalProducts = products.length;
                    const inStock = products.filter(p => 
                      p.inventory && p.inventory.availableInventory > 0
                    ).length;
                    const lowStock = products.filter(p => 
                      p.inventory && p.inventory.availableInventory > 0 && p.inventory.availableInventory <= 10
                    ).length;
                    const outOfStock = totalProducts - inStock;

                    return (
                      <>
                        <div className="flex justify-between text-sm">
                          <span>有库存产品:</span>
                          <Badge className="bg-green-100 text-green-800">{inStock}</Badge>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>库存预警:</span>
                          <Badge variant="secondary" className="text-orange-600">{lowStock}</Badge>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>缺货产品:</span>
                          <Badge variant="destructive">{outOfStock}</Badge>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 功能链接 */}
      <Card>
        <CardHeader>
          <CardTitle>功能导航</CardTitle>
          <CardDescription>快速访问销售订单相关功能</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button asChild className="h-auto p-4">
              <a href="/sales-orders/create" className="flex flex-col items-center gap-2">
                <Package className="h-6 w-6" />
                <span>创建销售订单</span>
              </a>
            </Button>
            
            <Button asChild variant="outline" className="h-auto p-4">
              <a href="/sales-orders" className="flex flex-col items-center gap-2">
                <Package className="h-6 w-6" />
                <span>订单列表</span>
              </a>
            </Button>
            
            <Button asChild variant="outline" className="h-auto p-4">
              <a href="/customers" className="flex flex-col items-center gap-2">
                <Package className="h-6 w-6" />
                <span>客户管理</span>
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 错误信息显示 */}
      {(customersError || productsError || salesOrdersError) && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            检测到API错误，请检查网络连接和服务器状态：
            <ul className="mt-2 list-disc list-inside">
              {customersError && <li>客户API: {customersError.message}</li>}
              {productsError && <li>产品API: {productsError.message}</li>}
              {salesOrdersError && <li>订单API: {salesOrdersError.message}</li>}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
