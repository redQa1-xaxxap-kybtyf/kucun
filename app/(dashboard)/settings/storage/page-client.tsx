/**
 * 七牛云存储设置页面
 * 严格遵循全栈项目统一约定规范
 * ✅ 符合产品模块UI风格规范
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Cloud } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { queryKeys } from '@/lib/queryKeys';
import type {
  QiniuStorageConfig,
  QiniuStorageTestResponse,
  SettingsApiResponse,
} from '@/lib/types/settings';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';

const QiniuStorageForm = dynamic(
  () =>
    import('@/components/settings/QiniuStorageForm').then(
      mod => mod.QiniuStorageForm
    ),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
        设置加载中...
      </div>
    ),
  }
);

const StorageTestConnection = dynamic(
  () =>
    import('@/components/settings/StorageTestConnection').then(
      mod => mod.StorageTestConnection
    ),
  { ssr: false, loading: () => null }
);

export default function StorageSettingsPageClient({
  isAdmin,
}: {
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 连接测试结果状态
  const [testResult, setTestResult] =
    React.useState<QiniuStorageTestResponse | null>(null);
  const [testError, setTestError] = React.useState<string | null>(null);

  // 获取七牛云存储配置
  const { data: storageConfig, error: configError } = useQuery({
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
      if (!result.data) {
        throw new Error('获取存储配置失败：返回数据为空');
      }
      return result.data;
    },
    enabled: isAdmin,
  });

  // 保存配置
  const saveConfigMutation = useMutation({
    mutationFn: async (data: QiniuStorageConfig) => {
      const response = await fetch(
        '/api/settings/storage',
        getCsrfTokenHeader({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '保存配置失败');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '保存成功',
        description: '存储设置已保存',
        variant: 'success',
      });
      // 不刷新查询，避免表单被重置
      // queryClient.invalidateQueries({ queryKey: queryKeys.settings.storage() });
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
      const response = await fetch(
        '/api/settings/storage/test',
        getCsrfTokenHeader({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessKey: data.accessKey,
            secretKey: data.secretKey,
            bucket: data.bucket,
            region: data.region,
          }),
        })
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '连接测试失败');
      }
      const result: SettingsApiResponse<QiniuStorageTestResponse> =
        await response.json();
      if (!result.success) {
        throw new Error(result.error || '连接测试失败');
      }
      if (!result.data) {
        throw new Error('连接测试失败：返回数据为空');
      }
      return result.data;
    },
    onSuccess: data => {
      setTestResult(data);
      setTestError(null);
      if (data.success) {
        toast({
          title: '测试成功',
          description: '存储连接正常',
          variant: 'success',
        });
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
  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col overflow-hidden p-6">
        <div className="flex-1 space-y-6 overflow-y-auto">
          {/* 页面头部 */}
          <Card className="overflow-hidden rounded-md border border-[hsl(var(--color-border-primary))] shadow-sm">
            <CardContent className="bg-[hsl(var(--color-bg-secondary))] p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-600 shadow-sm">
                    <Cloud className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                      文件存储
                    </h1>
                    <p className="text-sm text-gray-600">文件上传设置</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => router.push('/settings')}
                  className="h-11 gap-2 shadow-sm"
                >
                  <ArrowLeft className="h-4 w-4" />
                  返回设置
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-md border-amber-200 bg-amber-50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center text-amber-800">
                <Cloud className="mr-2 h-5 w-5" />
                权限不足
              </CardTitle>
              <p className="text-sm text-amber-700">仅管理员可访问。</p>
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

  const shouldRenderTestConnection = Boolean(
    testResult || testError || testConnectionMutation.isPending
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50/50 p-4 lg:p-10 xl:p-14">
      <div className="mx-auto w-full max-w-[1680px] space-y-12">
        {/* 1. Identity Header: 业务标识中枢 */}
        <div className="flex flex-col gap-6 px-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-md bg-slate-900 shadow-sm ring-4 ring-white">
              <Cloud className="h-8 w-8 text-white" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                  文件存储
                </h1>
                <Badge
                  variant="outline"
                  className="border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-400"
                >
                  七牛云
                </Badge>
              </div>
              <p className="text-sm font-bold text-slate-400">图片和附件上传</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push('/settings')}
            className="h-11 rounded-md border-slate-200 bg-white px-6 text-xs font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
        </div>

        <div className="grid gap-12 lg:grid-cols-[2.5fr_1fr]">
          {/* 左侧：存储账号 */}
          <div className="space-y-10">
            <section className="space-y-6">
              <div className="flex flex-col gap-1 px-1">
                <h3 className="text-sm font-semibold text-slate-900">
                  存储账号
                </h3>
              </div>

              {configError ? (
                <div className="group flex h-64 flex-col items-center justify-center rounded-md border border-dashed border-slate-200 bg-white p-8 hover:border-slate-300">
                  <p className="text-sm font-bold text-slate-400">
                    暂时无法加载存储设置
                  </p>
                  <Button
                    variant="outline"
                    onClick={() =>
                      queryClient.invalidateQueries({
                        queryKey: queryKeys.settings.storage(),
                      })
                    }
                    className="mt-6 h-10 rounded-md px-8 text-xs font-semibold"
                  >
                    重试加载
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
            </section>

            {/* 连接测试结果：转化为结构化悬浮条或模块 */}
            {shouldRenderTestConnection && (
              <StorageTestConnection
                testResult={testResult}
                isTesting={testConnectionMutation.isPending}
                testError={testError}
                onRetry={handleRetryTest}
              />
            )}
          </div>

          <div className="space-y-8">
            <section className="space-y-4">
              <h3 className="px-1 text-[11px] font-semibold text-slate-400">
                填写提示
              </h3>
              <div className="rounded-md border border-slate-100 bg-white p-6 shadow-sm">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold text-slate-900">
                      获取密钥
                    </span>
                    <p className="text-[11px] leading-relaxed font-medium text-slate-400">
                      在七牛云控制台的“密钥管理”中获取 AK 和 SK。
                    </p>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold text-slate-900">
                      存储空间
                    </span>
                    <p className="text-[11px] leading-relaxed font-medium text-slate-400">
                      确认空间权限和跨域设置。
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
