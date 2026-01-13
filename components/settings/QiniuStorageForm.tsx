/**
 * 七牛云存储配置表单组件
 * 严格遵循全栈项目统一约定规范
 */

'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { Eye, EyeOff, Loader2, Save, TestTube } from 'lucide-react';
import React from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { QiniuStorageConfig } from '@/lib/types/settings';
import {
    QiniuStorageConfigFormSchema,
    QiniuStorageConfigSchema,
} from '@/lib/validations/settings';

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

type QiniuStorageFormValues = z.infer<typeof QiniuStorageConfigFormSchema>;

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

  const form = useForm<QiniuStorageFormValues>({
    resolver: standardSchemaResolver(QiniuStorageConfigFormSchema),
    defaultValues: {
      accessKey: initialData?.accessKey?.trim() || '',
      secretKey: initialData?.secretKey?.trim() || '',
      bucket: initialData?.bucket?.trim() || '',
      domain: initialData?.domain?.trim() || '',
      region: initialData?.region?.trim() || 'z0',
      pathFormat: initialData?.pathFormat?.trim() || '',
    },
  });

  // 当initialData变化时重置表单
  React.useEffect(() => {
    if (initialData) {
      form.reset({
        accessKey: initialData.accessKey?.trim() || '',
        secretKey: initialData.secretKey?.trim() || '',
        bucket: initialData.bucket?.trim() || '',
        domain: initialData.domain?.trim() || '',
        region: initialData.region?.trim() || 'z0',
        pathFormat: initialData.pathFormat?.trim() || '',
      });
    }
  }, [initialData, form]);

  const normalizeAndValidate = (
    values: QiniuStorageFormValues
  ): QiniuStorageConfig | null => {
    const trimmed: QiniuStorageFormValues = {
      accessKey: values.accessKey?.trim() ?? '',
      secretKey: values.secretKey?.trim() ?? '',
      bucket: values.bucket?.trim() ?? '',
      domain: values.domain?.trim() ?? '',
      region: values.region?.trim() ?? 'z0',
      pathFormat: values.pathFormat?.trim() ?? '',
    };

    form.clearErrors();

    const requiredFields: Array<keyof QiniuStorageFormValues> = [
      'accessKey',
      'secretKey',
      'bucket',
      'domain',
    ];

    let hasEmpty = false;
    requiredFields.forEach(field => {
      if (!trimmed[field]) {
        hasEmpty = true;
        form.setError(field, {
          type: 'manual',
          message:
            field === 'accessKey'
              ? '访问密钥（AK）不能为空'
              : field === 'secretKey'
                ? '私有密钥（SK）不能为空'
                : field === 'bucket'
                  ? '存储空间名称不能为空'
                  : '访问域名不能为空',
        });
      } else if (values[field] !== trimmed[field]) {
        form.setValue(field, trimmed[field] as string, { shouldDirty: true });
      }
    });

    if (values.region !== trimmed.region) {
      form.setValue('region', trimmed.region ?? 'z0', { shouldDirty: true });
    }

    if (values.pathFormat !== trimmed.pathFormat) {
      form.setValue('pathFormat', trimmed.pathFormat ?? '', {
        shouldDirty: true,
      });
    }

    if (hasEmpty) {
      return null;
    }

    const validation = QiniuStorageConfigSchema.safeParse({
      ...trimmed,
    });

    if (!validation.success) {
      validation.error.issues.forEach(issue => {
        const field = issue.path[0];
        if (typeof field === 'string') {
          form.setError(field as keyof QiniuStorageFormValues, {
            type: 'manual',
            message: issue.message,
          });
        }
      });
      return null;
    }

    const normalized = validation.data;

    return {
      accessKey: normalized.accessKey.trim(),
      secretKey: normalized.secretKey.trim(),
      bucket: normalized.bucket.trim(),
      domain: normalized.domain.trim(),
      region: normalized.region?.trim() || 'z0',
      pathFormat: normalized.pathFormat?.trim() || '',
    };
  };

  const handleSubmit = (data: QiniuStorageFormValues) => {
    const normalized = normalizeAndValidate(data);
    if (!normalized) {
      return;
    }
    onSubmit(normalized);
  };

  const handleTestConnection = () => {
    const normalized = normalizeAndValidate(form.getValues());
    if (!normalized) {
      return;
    }
    onTestConnection(normalized);
  };

  const isFormDisabled = isSaving || isTesting;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data: any) =>
          handleSubmit(data as QiniuStorageFormValues)
        )}
        className="space-y-10"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 访问密钥 */}
          <div className="group relative flex h-[130px] flex-col justify-center rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:border-blue-100 hover:shadow-md">
            <FormField
              control={form.control}
              name="accessKey"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <div className="flex flex-col">
                    <FormLabel className="text-sm font-black text-slate-900">访问密钥（AK）</FormLabel>
                    <span className="text-[11px] font-medium text-slate-400">七牛云账户的公钥，用于接口调用鉴权</span>
                  </div>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showAccessKey ? 'text' : 'password'}
                        placeholder="请输入访问密钥（AK）"
                        className="h-9 border-none bg-slate-50/50 px-3 font-bold transition-all focus:bg-white focus:ring-2 focus:ring-blue-500/10"
                        disabled={isFormDisabled}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent text-slate-400 hover:text-slate-600"
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
                  <FormMessage className="text-[10px] absolute bottom-2 left-6" />
                </FormItem>
              )}
            />
          </div>

          {/* 私有密钥 */}
          <div className="group relative flex h-[130px] flex-col justify-center rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:border-blue-100 hover:shadow-md">
            <FormField
              control={form.control}
              name="secretKey"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <div className="flex flex-col">
                    <FormLabel className="text-sm font-black text-slate-900">私有密钥（SK）</FormLabel>
                    <span className="text-[11px] font-medium text-slate-400">七牛云账户的私钥，请妥善保管</span>
                  </div>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showSecretKey ? 'text' : 'password'}
                        placeholder="请输入私有密钥（SK）"
                        className="h-9 border-none bg-slate-50/50 px-3 font-bold transition-all focus:bg-white focus:ring-2 focus:ring-blue-500/10"
                        disabled={isFormDisabled}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent text-slate-400 hover:text-slate-600"
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
                  <FormMessage className="text-[10px] absolute bottom-2 left-6" />
                </FormItem>
              )}
            />
          </div>

          {/* 存储空间 */}
          <div className="group relative flex h-[130px] flex-col justify-center rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:border-blue-100 hover:shadow-md">
            <FormField
              control={form.control}
              name="bucket"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <div className="flex flex-col">
                    <FormLabel className="text-sm font-black text-slate-900">存储空间名称</FormLabel>
                    <span className="text-[11px] font-medium text-slate-400">在对象存储中创建的存储空间唯一名称</span>
                  </div>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="例如：kucun-assets"
                      className="h-9 border-none bg-slate-50/50 px-3 font-bold transition-all focus:bg-white focus:ring-2 focus:ring-blue-500/10"
                      disabled={isFormDisabled}
                    />
                  </FormControl>
                  <FormMessage className="text-[10px] absolute bottom-2 left-6" />
                </FormItem>
              )}
            />
          </div>

          {/* 访问域名 */}
          <div className="group relative flex h-[130px] flex-col justify-center rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:border-blue-100 hover:shadow-md">
            <FormField
              control={form.control}
              name="domain"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <div className="flex flex-col">
                    <FormLabel className="text-sm font-black text-slate-900">外部访问域名</FormLabel>
                    <span className="text-[11px] font-medium text-slate-400">已绑定至存储空间的加速域名或临时域名</span>
                  </div>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="例如：https://你的域名"
                      className="h-9 border-none bg-slate-50/50 px-3 font-bold transition-all focus:bg-white focus:ring-2 focus:ring-blue-500/10"
                      disabled={isFormDisabled}
                    />
                  </FormControl>
                  <FormMessage className="text-[10px] absolute bottom-2 left-6" />
                </FormItem>
              )}
            />
          </div>

          {/* 存储区域 */}
          <div className="group relative flex h-[130px] flex-col justify-center rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:border-blue-100 hover:shadow-md">
            <FormField
              control={form.control}
              name="region"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <div className="flex flex-col">
                    <FormLabel className="text-sm font-black text-slate-900">物理存储区域</FormLabel>
                    <span className="text-[11px] font-medium text-slate-400">存储空间所在的地理机房位置</span>
                  </div>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value || 'z0'}
                    disabled={isFormDisabled}
                  >
                    <FormControl>
                      <SelectTrigger className="h-9 border-none bg-slate-50/50 px-3 font-bold transition-all focus:bg-white focus:ring-2 focus:ring-blue-500/10">
                        <SelectValue placeholder="选择存储区域" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {QINIU_REGIONS.map(region => (
                        <SelectItem key={region.value} value={region.value} className="text-xs font-bold">
                          {region.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[10px] absolute bottom-2 left-6" />
                </FormItem>
              )}
            />
          </div>

          {/* 存储目录格式 */}
          <div className="group relative flex h-[130px] flex-col justify-center rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:border-blue-100 hover:shadow-md">
            <FormField
              control={form.control}
              name="pathFormat"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <div className="flex flex-col">
                    <FormLabel className="text-sm font-black text-slate-900">预设存储路径格式</FormLabel>
                    <span className="text-[11px] font-medium text-slate-400">支持日期变量，如 {'{y}/{m}/{d}'}</span>
                  </div>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="留空则直接存储在根目录"
                      className="h-9 border-none bg-slate-50/50 px-3 font-bold transition-all focus:bg-white focus:ring-2 focus:ring-blue-500/10"
                      disabled={isFormDisabled}
                    />
                  </FormControl>
                  <FormMessage className="text-[10px] absolute bottom-2 left-6" />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* 操作按钮区 */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/10 pt-8">
           <p className="text-[11px] font-medium text-slate-400">
             修改配置后建议先进行连接诊断，确保服务可用性。
           </p>
           <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={isFormDisabled}
                className="h-11 rounded-2xl border-slate-200 bg-white px-8 text-xs font-black text-slate-900 transition-all hover:bg-slate-50 active:scale-95"
              >
                {isTesting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="mr-2 h-4 w-4" />
                )}
                连接性诊断
              </Button>
              <Button 
                type="submit" 
                disabled={isFormDisabled}
                className="h-11 rounded-2xl bg-slate-900 px-10 text-xs font-black shadow-lg shadow-slate-900/10 hover:bg-slate-800 transition-all active:scale-95"
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                更新存储密钥
              </Button>
           </div>
        </div>
      </form>
    </Form>
  );
};
