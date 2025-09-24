/**
 * 七牛云存储设置页面
 * 严格遵循全栈项目统一约定规范
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Package } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import React from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type {
  QiniuStorageConfig,
  QiniuStorageTestResponse,
  SettingsApiResponse,
} from '@/lib/types/settings';

import { QiniuStorageForm } from '@/components/settings/QiniuStorageForm';
import { StorageTestConnection } from '@/components/settings/StorageTestConnection';

export default function StorageSettingsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 连接测试结果状态
  const [testResult, setTestResult] =
    React.useState<QiniuStorageTestResponse | null>(null);
  const [testError, setTestError] = React.useState<string | null>(null);

  // 获取七牛云存储配置
  const {
    data: storageConfig,
    isLoading: isLoadingConfig,
    error: configError,
  } = useQuery({
    queryKey: ['storage-config'],
    queryFn: async () => {
      const response = await fetch('/api/settings/storage');
      if (!response.ok) {
        throw new Error('获取存储配置失败');
      }
      const result: SettingsApiResponse<QiniuStorageConfig> =
        await response.json();
      if (!result.success) {
        throw new Error(result.error || '获取存储配置失败');
      }
      return result.data!;
    },
  });

  // 保存配置
  const saveConfigMutation = useMutation({
    mutationFn: async (data: QiniuStorageConfig) => {
      const response = await fetch('/api/settings/storage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '保存配置失败');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: '成功', description: '七牛云存储配置保存成功' });
      queryClient.invalidateQueries({ queryKey: ['storage-config'] });
      // 清除测试结果
      setTestResult(null);
      setTestError(null);
    },
    onError: (error: Error) => {
      toast({
        title: '保存失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // 测试连接
  const testConnectionMutation = useMutation({
    mutationFn: async (data: QiniuStorageConfig) => {
      const response = await fetch('/api/settings/storage/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessKey: data.accessKey,
          secretKey: data.secretKey,
          bucket: data.bucket,
          region: data.region,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '连接测试失败');
      }
      const result: SettingsApiResponse<QiniuStorageTestResponse> =
        await response.json();
      if (!result.success) {
        throw new Error(result.error || '连接测试失败');
      }
      return result.data!;
    },
    onSuccess: data => {
      setTestResult(data);
      setTestError(null);
      if (data.success) {
        toast({ title: '测试成功', description: '七牛云存储连接正常' });
      } else {
        toast({
          title: '测试失败',
          description: data.message,
          variant: 'destructive',
        });
      }
    },
    onError: (error: Error) => {
      setTestResult(null);
      setTestError(error.message);
      toast({
        title: '测试失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // 检查权限
  if (session?.user?.role !== 'admin') {
    return (
      <div className="container mx-auto space-y-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/settings">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回设置
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">七牛云存储</h1>
              <p className="text-muted-foreground">文件上传和存储配置</p>
            </div>
          </div>
        </div>
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center text-amber-800">
              <Package className="mr-2 h-5 w-5" />
              权限不足
            </CardTitle>
            <CardDescription className="text-amber-700">
              只有管理员可以访问七牛云存储配置。
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleSaveConfig = (data: QiniuStorageConfig) => {
    saveConfigMutation.mutate(data);
  };

  const handleTestConnection = (data: QiniuStorageConfig) => {
    testConnectionMutation.mutate(data);
  };

  const handleRetryTest = () => {
    if (storageConfig) {
      testConnectionMutation.mutate(storageConfig);
    }
  };

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* 页面标题和导航 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/settings">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回设置
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">七牛云存储</h1>
            <p className="text-muted-foreground">配置文件上传和存储服务</p>
          </div>
        </div>
      </div>

      {/* 配置表单 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Package className="mr-2 h-5 w-5" />
            七牛云存储配置
          </CardTitle>
          <CardDescription>
            配置七牛云对象存储服务，用于文件上传和管理
          </CardDescription>
        </CardHeader>
        <CardContent>
          {configError ? (
            <div className="flex h-32 flex-col items-center justify-center text-muted-foreground">
              <p>加载配置失败</p>
              <Button
                variant="outline"
                onClick={() =>
                  queryClient.invalidateQueries({
                    queryKey: ['storage-config'],
                  })
                }
                className="mt-2"
              >
                重试
              </Button>
            </div>
          ) : (
            <QiniuStorageForm
              initialData={storageConfig}
              onSubmit={handleSaveConfig}
              onTestConnection={handleTestConnection}
              isSaving={saveConfigMutation.isPending}
              isTesting={testConnectionMutation.isPending}
            />
          )}
        </CardContent>
      </Card>

      {/* 连接测试结果 */}
      <StorageTestConnection
        testResult={testResult}
        isTesting={testConnectionMutation.isPending}
        testError={testError}
        onRetry={handleRetryTest}
      />
    </div>
  );
}
