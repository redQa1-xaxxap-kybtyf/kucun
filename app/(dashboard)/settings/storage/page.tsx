/**
 * 七牛云存储设置页面
 * 严格遵循全栈项目统一约定规范
 * ✅ 符合产品模块UI风格规范
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Cloud } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import React from 'react';

import { QiniuStorageForm } from '@/components/settings/QiniuStorageForm';
import { StorageTestConnection } from '@/components/settings/StorageTestConnection';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { queryKeys } from '@/lib/queryKeys';
import type {
  QiniuStorageConfig,
  QiniuStorageTestResponse,
  SettingsApiResponse,
} from '@/lib/types/settings';

export default function StorageSettingsPage() {
  const router = useRouter();
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
    isLoading: _isLoadingConfig,
    error: configError,
  } = useQuery({
    queryKey: queryKeys.settings.storage(),
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
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.storage() });
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
      <div className="flex h-full flex-col overflow-hidden p-6">
        <div className="space-y-6">
          {/* 页面头部 */}
          <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
            <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-600 shadow-lg shadow-gray-600/30">
                    <Cloud className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                      七牛云存储
                    </h1>
                    <p className="text-sm text-gray-600">文件上传和存储配置</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => router.push('/settings')}
                  className="h-11 gap-2 shadow-md transition-all hover:scale-105 hover:shadow-lg"
                >
                  <ArrowLeft className="h-4 w-4" />
                  返回设置
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50 shadow-lg shadow-amber-200/50">
            <CardHeader>
              <CardTitle className="flex items-center text-amber-800">
                <Cloud className="mr-2 h-5 w-5" />
                权限不足
              </CardTitle>
              <CardDescription className="text-amber-700">
                只有管理员可以访问七牛云存储配置。
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
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
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="space-y-6">
        {/* 页面头部 */}
        <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
          <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-600 shadow-lg shadow-gray-600/30">
                  <Cloud className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    七牛云存储
                  </h1>
                  <p className="text-sm text-gray-600">
                    配置文件上传和存储服务
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="lg"
                onClick={() => router.push('/settings')}
                className="h-11 gap-2 shadow-md transition-all hover:scale-105 hover:shadow-lg"
              >
                <ArrowLeft className="h-4 w-4" />
                返回设置
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 配置表单 */}
        <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50">
            <CardTitle className="flex items-center text-gray-900">
              <Cloud className="mr-2 h-5 w-5 text-gray-600" />
              七牛云存储配置
            </CardTitle>
            <CardDescription>
              配置七牛云对象存储服务，用于文件上传和管理
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {configError ? (
              <div className="text-muted-foreground flex h-32 flex-col items-center justify-center">
                <p>加载配置失败</p>
                <Button
                  variant="outline"
                  onClick={() =>
                    queryClient.invalidateQueries({
                      queryKey: queryKeys.settings.storage(),
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
    </div>
  );
}
