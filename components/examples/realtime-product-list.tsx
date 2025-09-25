'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConnectionStatus } from '@/components/ui/connection-status';
import { useWebSocket } from '@/hooks/use-websocket';
import { getProducts, productQueryKeys } from '@/lib/api/products';

/**
 * 实时产品列表示例组件
 * 展示Redis缓存和WebSocket实时更新的集成使用
 */
export function RealtimeProductList() {
  const queryClient = useQueryClient();

  // 获取产品列表数据（带缓存）
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: productQueryKeys.list({ page: 1, limit: 10 }),
    queryFn: () => getProducts({ page: 1, limit: 10 }),
  });

  // WebSocket实时更新
  useWebSocket({
    channels: ['products'],
    onMessage: message => {
      if (message.channel === 'products') {
        console.log('收到产品更新消息:', message.data);

        // 实时刷新产品列表
        queryClient.invalidateQueries({ queryKey: productQueryKeys.all });

        // 可以根据消息类型做更精细的处理
        const { type } = message.data as {
          type: string;
          id?: string;
          code?: string;
        };
        switch (type) {
          case 'created':
            console.log('新产品已创建');
            break;
          case 'updated':
            console.log('产品已更新');
            break;
          case 'deleted':
            console.log('产品已删除');
            break;
          default:
            break;
        }
      }
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            实时产品列表
            <ConnectionStatus />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">加载中...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            实时产品列表
            <ConnectionStatus />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center">
            <p className="mb-4 text-red-600">加载失败: {error.message}</p>
            <Button onClick={() => refetch()} variant="outline">
              重试
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const products = data?.data || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          实时产品列表
          <div className="flex items-center gap-2">
            <ConnectionStatus />
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="sm"
              className="gap-1"
            >
              <RefreshCw className="h-4 w-4" />
              刷新
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {products.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              暂无产品数据
            </p>
          ) : (
            products.map(product => (
              <div
                key={product.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{product.name}</span>
                    <Badge variant="outline">{product.code}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {product.specification}
                  </p>
                </div>
                <div className="text-right">
                  <Badge
                    variant={
                      product.status === 'active' ? 'default' : 'secondary'
                    }
                  >
                    {product.status === 'active' ? '启用' : '停用'}
                  </Badge>
                  <p className="mt-1 text-xs text-muted-foreground">
                    库存: {product.inventory?.totalQuantity || 0} {product.unit}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {data?.pagination && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            显示 {products.length} / {data.pagination.total} 条记录
          </div>
        )}
      </CardContent>
    </Card>
  );
}
