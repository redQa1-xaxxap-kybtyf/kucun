'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  useDataManagementSettings,
  useUpdateDataManagementSettings,
} from '@/lib/api/settings';
import {
  BACKUP_FREQUENCY_OPTIONS,
  EXPORT_FORMAT_OPTIONS,
} from '@/lib/types/settings';
import { hasPermission } from '@/lib/utils/permissions';
import {
  DataManagementSettingsSchema,
  dataManagementSettingsDefaults,
  type DataManagementSettingsFormData,
} from '@/lib/validations/settings';

/**
 * 数据管理设置页面
 * 提供数据备份、导出、系统维护等数据管理功能设置
 */
const DataManagementSettingsPage = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();

  // 数据获取 - 必须在权限检查之前调用
  const { data: settings, isLoading, error } = useDataManagementSettings();

  // 数据更新
  const updateMutation = useUpdateDataManagementSettings();

  // 表单配置
  const form = useForm<DataManagementSettingsFormData>({
    resolver: zodResolver(DataManagementSettingsSchema),
    defaultValues: dataManagementSettingsDefaults,
    values: settings || dataManagementSettingsDefaults,
  });

  // 权限检查
  if (!hasPermission(session?.user?.role, 'settings', 'write')) {
    router.push('/dashboard');
    return null;
  }

  // 提交处理
  const onSubmit = async (data: DataManagementSettingsFormData) => {
    try {
      await updateMutation.mutateAsync(data);
      toast({
        title: '保存成功',
        description: '数据管理设置已更新',
      });
    } catch (error) {
      toast({
        title: '保存失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">数据管理</h1>
            <p className="text-muted-foreground">
              配置数据备份、导出和系统维护设置
            </p>
          </div>
          <div className="py-8 text-center">加载中...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">数据管理</h1>
            <p className="text-muted-foreground">
              配置数据备份、导出和系统维护设置
            </p>
          </div>
          <div className="py-8 text-center text-red-500">
            加载失败，请刷新页面重试
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-3xl font-bold">数据管理</h1>
          <p className="text-muted-foreground">
            配置数据备份、导出和系统维护设置
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* 数据备份设置 */}
            <Card>
              <CardHeader>
                <CardTitle>数据备份设置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="autoBackupEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">自动备份</FormLabel>
                        <FormDescription>
                          启用自动备份功能，定期备份系统数据
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="backupFrequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>备份频率</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择备份频率" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {BACKUP_FREQUENCY_OPTIONS.map(option => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="backupTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>备份时间</FormLabel>
                        <FormControl>
                          <Input type="time" placeholder="02:00" {...field} />
                        </FormControl>
                        <FormDescription>
                          设置自动备份的执行时间
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="backupRetentionDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>备份保留天数</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="7"
                            max="365"
                            placeholder="30"
                            {...field}
                            onChange={e =>
                              field.onChange(Number(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          备份文件保留的天数（7-365天）
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="backupStoragePath"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>备份存储路径</FormLabel>
                        <FormControl>
                          <Input placeholder="/backups" {...field} />
                        </FormControl>
                        <FormDescription>备份文件的存储路径</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="backupCompression"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">备份压缩</FormLabel>
                        <FormDescription>
                          启用备份文件压缩以节省存储空间
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* 数据导出设置 */}
            <Card>
              <CardHeader>
                <CardTitle>数据导出设置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="exportFormats"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>支持的导出格式</FormLabel>
                      <div className="grid grid-cols-3 gap-4">
                        {EXPORT_FORMAT_OPTIONS.map(option => (
                          <FormItem
                            key={option.value}
                            className="flex flex-row items-start space-x-3 space-y-0"
                          >
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value?.includes(option.value)}
                                onChange={e => {
                                  const currentValue = field.value || [];
                                  if (e.target.checked) {
                                    field.onChange([
                                      ...currentValue,
                                      option.value,
                                    ]);
                                  } else {
                                    field.onChange(
                                      currentValue.filter(
                                        v => v !== option.value
                                      )
                                    );
                                  }
                                }}
                                className="mt-1"
                              />
                            </FormControl>
                            <FormLabel className="text-sm font-normal">
                              {option.label}
                            </FormLabel>
                          </FormItem>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="exportMaxRecords"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>最大导出记录数</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="100"
                            max="1000000"
                            placeholder="10000"
                            {...field}
                            onChange={e =>
                              field.onChange(Number(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          单次导出的最大记录数（100-1,000,000）
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="exportScheduleFrequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>计划导出频率</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择导出频率" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {BACKUP_FREQUENCY_OPTIONS.map(option => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="exportIncludeDeleted"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            包含已删除数据
                          </FormLabel>
                          <FormDescription>
                            导出时是否包含已删除的记录
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="exportScheduleEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            启用计划导出
                          </FormLabel>
                          <FormDescription>
                            启用定期自动导出功能
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* 系统维护设置 */}
            <Card>
              <CardHeader>
                <CardTitle>系统维护设置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="autoCleanupEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">自动清理</FormLabel>
                        <FormDescription>
                          启用自动清理功能，定期清理系统垃圾文件
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="logRetentionDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>日志保留天数</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="7"
                            max="365"
                            placeholder="90"
                            {...field}
                            onChange={e =>
                              field.onChange(Number(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          系统日志保留天数（7-365天）
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tempFileCleanupDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>临时文件清理天数</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="30"
                            placeholder="7"
                            {...field}
                            onChange={e =>
                              field.onChange(Number(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          临时文件清理天数（1-30天）
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cacheCleanupFrequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>缓存清理频率</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择清理频率" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CLEANUP_FREQUENCY_OPTIONS.map(option => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="maxFileUploadSizeMB"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>最大文件上传大小 (MB)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="100"
                            placeholder="10"
                            {...field}
                            onChange={e =>
                              field.onChange(Number(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          单个文件上传大小限制（1-100MB）
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="performanceMonitoringEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">性能监控</FormLabel>
                          <FormDescription>
                            启用系统性能监控功能
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* 数据库维护设置 */}
            <Card>
              <CardHeader>
                <CardTitle>数据库维护设置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="dbOptimizationEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">数据库优化</FormLabel>
                        <FormDescription>
                          启用定期数据库优化功能
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="dbOptimizationFrequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>优化频率</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择优化频率" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DB_OPTIMIZATION_FREQUENCY_OPTIONS.map(option => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dbBackupBeforeOptimization"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            优化前备份
                          </FormLabel>
                          <FormDescription>
                            优化前自动创建数据库备份
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* 保存按钮 */}
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="min-w-[100px]"
              >
                {updateMutation.isPending ? '保存中...' : '保存设置'}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default DataManagementSettingsPage;
