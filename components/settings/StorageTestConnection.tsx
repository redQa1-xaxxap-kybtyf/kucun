/**
 * 存储连接测试组件
 * 严格遵循全栈项目统一约定规范
 */

'use client';

import { AlertCircle, CheckCircle, Info, Loader2, XCircle } from 'lucide-react';
import React from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { QiniuStorageTestResponse } from '@/lib/types/settings';

interface StorageTestConnectionProps {
  /** 测试结果 */
  testResult?: QiniuStorageTestResponse | null;
  /** 是否正在测试 */
  isTesting?: boolean;
  /** 测试错误信息 */
  testError?: string | null;
  /** 重新测试函数 */
  onRetry?: () => void;
}

/**
 * 存储连接测试组件
 * 显示连接测试结果和相关信息
 */
export const StorageTestConnection = ({
  testResult,
  isTesting = false,
  testError,
  onRetry,
}: StorageTestConnectionProps) => {
  // 如果没有测试结果且不在测试中，不显示组件
  if (!testResult && !isTesting && !testError) {
    return null;
  }

  // 正在测试中
  if (isTesting) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            正在测试连接
          </CardTitle>
          <CardDescription>
            正在验证七牛云存储配置，请稍候...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>测试中</AlertTitle>
            <AlertDescription>
              正在连接七牛云服务器，验证Access Key、Secret Key和存储空间配置...
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // 测试失败
  if (testError || (testResult && !testResult.success)) {
    const errorMessage = testError || testResult?.message || '连接测试失败';
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-destructive">
            <XCircle className="mr-2 h-5 w-5" />
            连接测试失败
          </CardTitle>
          <CardDescription>
            七牛云存储配置验证失败，请检查配置信息
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>错误信息</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
          
          <div className="space-y-2">
            <h4 className="text-sm font-medium">请检查以下配置：</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Access Key 和 Secret Key 是否正确</li>
              <li>• 存储空间名称是否存在</li>
              <li>• 存储区域是否匹配</li>
              <li>• 网络连接是否正常</li>
            </ul>
          </div>

          {onRetry && (
            <Button variant="outline" onClick={onRetry} className="w-full sm:w-auto">
              重新测试
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // 测试成功
  if (testResult && testResult.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-green-600">
            <CheckCircle className="mr-2 h-5 w-5" />
            连接测试成功
          </CardTitle>
          <CardDescription>
            七牛云存储配置验证通过，可以正常使用
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">配置验证成功</AlertTitle>
            <AlertDescription className="text-green-700">
              {testResult.message || '七牛云存储连接正常，配置信息正确'}
            </AlertDescription>
          </Alert>

          {/* 存储空间信息 */}
          {testResult.bucketInfo && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">存储空间信息</h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm text-muted-foreground">空间名称</span>
                  <Badge variant="secondary">{testResult.bucketInfo.name}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm text-muted-foreground">存储区域</span>
                  <Badge variant="secondary">{testResult.bucketInfo.region}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm text-muted-foreground">访问权限</span>
                  <Badge variant={testResult.bucketInfo.private ? 'destructive' : 'default'}>
                    {testResult.bucketInfo.private ? '私有' : '公开'}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg bg-blue-50 p-3">
            <div className="flex items-start">
              <Info className="mr-2 h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-800">配置提示</p>
                <p className="text-blue-700 mt-1">
                  配置验证成功后，您可以保存配置并开始使用七牛云存储服务。
                  建议定期检查存储空间的使用情况和费用。
                </p>
              </div>
            </div>
          </div>

          {onRetry && (
            <Button variant="outline" onClick={onRetry} className="w-full sm:w-auto">
              重新测试
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
};
