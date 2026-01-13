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
import { Badge } from '@/components/ui/badge';
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
import { getCsrfTokenHeader } from '@/lib/utils/csrf';

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
        title: '成功',
        description: '七牛云存储配置保存成功',
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
          description: '七牛云存储连接正常',
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
  if (session?.user?.role !== 'admin') {
    return (
      <div className="flex h-full flex-col overflow-hidden p-6">
        <div className="flex-1 space-y-6 overflow-y-auto">
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
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50/50 p-4 lg:p-10 xl:p-14">
      <div className="mx-auto w-full max-w-[1680px] space-y-12">
        {/* 1. Identity Header: 业务标识中枢 */}
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between px-2">
          <div className="flex items-center gap-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 shadow-xl shadow-slate-900/10 ring-4 ring-white">
              <Cloud className="h-8 w-8 text-white" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black tracking-tighter text-slate-900">
                   七牛云存储
                </h1>
                <Badge variant="outline" className="border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-widest px-2.5 py-1">
                   External Cloud
                </Badge>
              </div>
              <p className="text-sm font-bold text-slate-400">
                 配置您的第三方对象存储服务，确保存储空间的读写访问权限正确
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push('/settings')}
            className="h-11 rounded-xl border-slate-200 bg-white px-6 text-xs font-black text-slate-900 shadow-sm hover:bg-slate-50 transition-all active:scale-95"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回全局设置
          </Button>
        </div>

        <div className="grid gap-12 lg:grid-cols-[2.5fr_1fr]">
          {/* 左侧：核心配置区域 */}
          <div className="space-y-10">
            <section className="space-y-6">
              <div className="flex flex-col gap-1 px-1">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">服务接入配置</h3>
                <p className="text-[11px] font-medium text-slate-400">设置云存储密钥与基础访问参数</p>
              </div>

              {configError ? (
                <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-8 group transition-all hover:border-slate-300">
                  <p className="text-sm font-bold text-slate-400">加载配置失败，请检查网络连接</p>
                  <Button
                    variant="outline"
                    onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.settings.storage() })}
                    className="mt-6 h-10 rounded-xl px-8 text-xs font-black"
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
            <StorageTestConnection
              testResult={testResult}
              isTesting={testConnectionMutation.isPending}
              testError={testError}
              onRetry={handleRetryTest}
            />
          </div>

          <div className="space-y-8">
             <section className="space-y-4">
               <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 px-1">配置指</h3>
               <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                  <div className="space-y-6">
                    <div className="space-y-2">
                       <span className="text-[11px] font-black text-slate-900">获取密钥</span>
                       <p className="text-[11px] leading-relaxed text-slate-400 font-medium">
                          进入七牛云控制台，点击“个人中心” → “密钥管理”，获取您的访问密钥与私有密钥。
                       </p>
                    </div>
                    <div className="space-y-2">
                       <span className="text-[11px] font-black text-slate-900">存储空间</span>
                       <p className="text-[11px] leading-relaxed text-slate-400 font-medium">
                          请确保该空间具有公共读或私有读权限，并已正确配置跨域设置。
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
