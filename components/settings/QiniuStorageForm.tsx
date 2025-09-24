/**
 * 七牛云存储配置表单组件
 * 严格遵循全栈项目统一约定规范
 */

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, Save, TestTube } from 'lucide-react';
import React from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
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
import { QiniuStorageConfigSchema } from '@/lib/schemas/settings';
import type { QiniuStorageConfig } from '@/lib/types/settings';

interface QiniuStorageFormProps {
  /** 初始配置数据 */
  initialData?: Partial<QiniuStorageConfig>;
  /** 表单提交处理函数 */
  onSubmit: (data: QiniuStorageConfig) => void;
  /** 连接测试处理函数 */
  onTestConnection: (data: QiniuStorageConfig) => void;
  /** 是否正在保存 */
  isSaving?: boolean;
  /** 是否正在测试连接 */
  isTesting?: boolean;
}

// 七牛云存储区域选项
const QINIU_REGIONS = [
  { value: 'z0', label: '华东-浙江' },
  { value: 'z1', label: '华北-河北' },
  { value: 'z2', label: '华南-广东' },
  { value: 'na0', label: '北美-洛杉矶' },
  { value: 'as0', label: '亚太-新加坡' },
  { value: 'cn-east-2', label: '华东-浙江2' },
] as const;

/**
 * 七牛云存储配置表单组件
 */
export const QiniuStorageForm = ({
  initialData,
  onSubmit,
  onTestConnection,
  isSaving = false,
  isTesting = false,
}: QiniuStorageFormProps) => {
  const [showAccessKey, setShowAccessKey] = React.useState(false);
  const [showSecretKey, setShowSecretKey] = React.useState(false);

  const form = useForm<QiniuStorageConfig>({
    resolver: zodResolver(QiniuStorageConfigSchema),
    defaultValues: {
      accessKey: initialData?.accessKey || '',
      secretKey: initialData?.secretKey || '',
      bucket: initialData?.bucket || '',
      domain: initialData?.domain || '',
      region: initialData?.region || 'z0',
    },
  });

  // 当initialData变化时重置表单
  React.useEffect(() => {
    if (initialData) {
      form.reset({
        accessKey: initialData.accessKey || '',
        secretKey: initialData.secretKey || '',
        bucket: initialData.bucket || '',
        domain: initialData.domain || '',
        region: initialData.region || 'z0',
      });
    }
  }, [initialData, form]);

  const handleSubmit = (data: QiniuStorageConfig) => {
    onSubmit(data);
  };

  const handleTestConnection = () => {
    const formData = form.getValues();
    form.trigger().then(isValid => {
      if (isValid) {
        onTestConnection(formData);
      }
    });
  };

  const isFormDisabled = isSaving || isTesting;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Access Key */}
        <FormField
          control={form.control}
          name="accessKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Access Key *</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    {...field}
                    type={showAccessKey ? 'text' : 'password'}
                    placeholder="请输入七牛云Access Key"
                    disabled={isFormDisabled}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowAccessKey(!showAccessKey)}
                    disabled={isFormDisabled}
                  >
                    {showAccessKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </FormControl>
              <FormDescription>
                七牛云控制台获取的Access Key，用于身份验证
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Secret Key */}
        <FormField
          control={form.control}
          name="secretKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Secret Key *</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    {...field}
                    type={showSecretKey ? 'text' : 'password'}
                    placeholder="请输入七牛云Secret Key"
                    disabled={isFormDisabled}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowSecretKey(!showSecretKey)}
                    disabled={isFormDisabled}
                  >
                    {showSecretKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </FormControl>
              <FormDescription>
                七牛云控制台获取的Secret Key，用于身份验证
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 存储空间 */}
        <FormField
          control={form.control}
          name="bucket"
          render={({ field }) => (
            <FormItem>
              <FormLabel>存储空间 *</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="请输入存储空间名称"
                  disabled={isFormDisabled}
                />
              </FormControl>
              <FormDescription>
                七牛云对象存储的存储空间名称（Bucket）
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 访问域名 */}
        <FormField
          control={form.control}
          name="domain"
          render={({ field }) => (
            <FormItem>
              <FormLabel>访问域名 *</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="https://example.qiniucdn.com"
                  disabled={isFormDisabled}
                />
              </FormControl>
              <FormDescription>
                存储空间绑定的访问域名，用于文件访问
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 存储区域 */}
        <FormField
          control={form.control}
          name="region"
          render={({ field }) => (
            <FormItem>
              <FormLabel>存储区域</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value || 'z0'}
                disabled={isFormDisabled}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="选择存储区域" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {QINIU_REGIONS.map(region => (
                    <SelectItem key={region.value} value={region.value}>
                      {region.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                存储空间所在的区域，影响访问速度和费用
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 操作按钮 */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleTestConnection}
            disabled={isFormDisabled}
            className="sm:w-auto"
          >
            {isTesting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <TestTube className="mr-2 h-4 w-4" />
            )}
            测试连接
          </Button>
          <Button type="submit" disabled={isFormDisabled} className="sm:w-auto">
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            保存配置
          </Button>
        </div>
      </form>
    </Form>
  );
};
