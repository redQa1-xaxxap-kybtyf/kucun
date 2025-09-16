'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

// API imports
import { getProducts, productQueryKeys } from '@/lib/api/products'
import { getCustomers, customerQueryKeys } from '@/lib/api/customers'
import { getSalesOrders, salesOrderQueryKeys } from '@/lib/api/sales-orders'

/**
 * API集成测试页面
 * 用于验证所有API是否正常工作
 */
export default function TestApiPage() {
  // 测试产品API
  const {
    data: productsData,
    isLoading: productsLoading,
    error: productsError,
    refetch: refetchProducts
  } = useQuery({
    queryKey: productQueryKeys.list({ page: 1, limit: 5 }),
    queryFn: () => getProducts({ page: 1, limit: 5 }),
  })

  // 测试客户API
  const {
    data: customersData,
    isLoading: customersLoading,
    error: customersError,
    refetch: refetchCustomers
  } = useQuery({
    queryKey: customerQueryKeys.list({ page: 1, limit: 5 }),
    queryFn: () => getCustomers({ page: 1, limit: 5 }),
  })

  // 测试销售订单API
  const {
    data: salesOrdersData,
    isLoading: salesOrdersLoading,
    error: salesOrdersError,
    refetch: refetchSalesOrders
  } = useQuery({
    queryKey: salesOrderQueryKeys.list({ page: 1, limit: 5 }),
    queryFn: () => getSalesOrders({ page: 1, limit: 5 }),
  })

  const renderApiStatus = (
    title: string,
    isLoading: boolean,
    error: Error | null,
    data: any,
    refetch: () => void
  ) => {
    let status: 'loading' | 'success' | 'error' = 'loading'
    let statusIcon = <Loader2 className="h-4 w-4 animate-spin" />
    let statusColor = 'bg-blue-500'

    if (!isLoading) {
      if (error) {
        status = 'error'
        statusIcon = <XCircle className="h-4 w-4" />
        statusColor = 'bg-red-500'
      } else if (data) {
        status = 'success'
        statusIcon = <CheckCircle className="h-4 w-4" />
        statusColor = 'bg-green-500'
      }
    }

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{title}</CardTitle>
            <Badge variant="outline" className={`${statusColor} text-white`}>
              <div className="flex items-center gap-1">
                {statusIcon}
                {status === 'loading' && '加载中'}
                {status === 'success' && '成功'}
                {status === 'error' && '失败'}
              </div>
            </Badge>
          </div>
          <CardDescription>
            {status === 'loading' && '正在测试API连接...'}
            {status === 'success' && `成功获取 ${data?.data?.length || 0} 条记录`}
            {status === 'error' && `错误: ${error?.message}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {status === 'success' && data?.data && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  总记录数: {data.pagination?.total || data.data.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  当前页: {data.pagination?.page || 1} / {data.pagination?.totalPages || 1}
                </div>
                {data.data.slice(0, 3).map((item: any, index: number) => (
                  <div key={index} className="p-2 bg-muted rounded text-sm">
                    {item.name || item.orderNumber || item.id}
                  </div>
                ))}
              </div>
            )}
            
            {status === 'error' && (
              <div className="space-y-2">
                <div className="text-sm text-red-600">
                  {error?.message}
                </div>
                <Button variant="outline" size="sm" onClick={refetch}>
                  重试
                </Button>
              </div>
            )}
            
            {status === 'loading' && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const allSuccess = !productsLoading && !customersLoading && !salesOrdersLoading &&
                    !productsError && !customersError && !salesOrdersError &&
                    productsData && customersData && salesOrdersData

  const hasErrors = productsError || customersError || salesOrdersError

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">API集成测试</h1>
        <p className="text-muted-foreground">
          验证所有API接口是否正常工作
        </p>
      </div>

      {/* 总体状态 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {allSuccess && <CheckCircle className="h-5 w-5 text-green-500" />}
            {hasErrors && <XCircle className="h-5 w-5 text-red-500" />}
            {!allSuccess && !hasErrors && <AlertCircle className="h-5 w-5 text-yellow-500" />}
            API集成状态
          </CardTitle>
          <CardDescription>
            {allSuccess && '所有API接口工作正常'}
            {hasErrors && '部分API接口存在问题'}
            {!allSuccess && !hasErrors && '正在检测API接口状态...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">
                {[productsData, customersData, salesOrdersData].filter(Boolean).length}
              </div>
              <div className="text-sm text-muted-foreground">成功</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {[productsError, customersError, salesOrdersError].filter(Boolean).length}
              </div>
              <div className="text-sm text-muted-foreground">失败</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">
                {[productsLoading, customersLoading, salesOrdersLoading].filter(Boolean).length}
              </div>
              <div className="text-sm text-muted-foreground">加载中</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API测试结果 */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {renderApiStatus(
          '产品管理API',
          productsLoading,
          productsError,
          productsData,
          refetchProducts
        )}
        
        {renderApiStatus(
          '客户管理API',
          customersLoading,
          customersError,
          customersData,
          refetchCustomers
        )}
        
        {renderApiStatus(
          '销售订单API',
          salesOrdersLoading,
          salesOrdersError,
          salesOrdersData,
          refetchSalesOrders
        )}
      </div>

      {/* 测试说明 */}
      <Card>
        <CardHeader>
          <CardTitle>测试说明</CardTitle>
          <CardDescription>
            此页面用于验证API集成是否正常工作
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div>• <strong>产品管理API</strong>: 测试产品列表获取功能</div>
            <div>• <strong>客户管理API</strong>: 测试客户列表获取功能</div>
            <div>• <strong>销售订单API</strong>: 测试销售订单列表获取功能</div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="font-medium text-blue-900">注意事项:</div>
              <div className="text-blue-700">
                如果某个API测试失败，请检查对应的API路由实现和数据库连接。
                所有API都应该返回统一的响应格式：{`{ success: boolean, data?: T, error?: string }`}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
