/**
 * 存储连接测试组件
 * 严格遵循全栈项目统一约定规范
 */

'use client';

import { CheckCircle, Info, Loader2, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
      <div className="animate-pulse rounded-3xl border border-slate-100 bg-white/60 p-8 shadow-sm">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
          <div className="text-center">
            <h4 className="text-sm font-black text-slate-900">
              正在执行连接诊断
            </h4>
            <p className="mt-1 text-xs font-medium text-slate-500">
              正在验证访问密钥与存储空间可访问性，请稍候...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 测试失败
  if (testError || (testResult && !testResult.success)) {
    const errorMessage = testError || testResult?.message || '连接测试失败';

    return (
      <div className="rounded-3xl border border-rose-100 bg-rose-50/20 p-8 shadow-sm">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500 shadow-lg shadow-rose-500/20">
              <XCircle className="h-6 w-6 text-white" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-base font-black text-rose-900">
                配置验证未通过
              </h4>
              <p className="text-xs font-bold tracking-widest text-rose-500 uppercase">
                Diagnostic Failed
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-rose-100/50 bg-white/80 p-5">
            <span className="mb-2 block text-xs font-black text-rose-500 uppercase">
              错误详情报告
            </span>
            <p className="text-sm leading-relaxed font-bold text-slate-700">
              {errorMessage}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <h5 className="text-xs font-black tracking-wider text-slate-900 uppercase">
                排难建议（检查点）
              </h5>
              <ul className="space-y-1.5">
                {[
                  '检查访问密钥是否包含多余空格',
                  '确认存储空间名称与区域是否匹配',
                  '检查域名是否带有网址协议（http/https）',
                ].map((item, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-xs font-medium text-slate-600"
                  >
                    <div className="h-1 w-1 rounded-full bg-rose-300" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            {onRetry && (
              <div className="flex items-end justify-end">
                <Button
                  variant="outline"
                  onClick={onRetry}
                  className="h-10 rounded-xl border-rose-100 bg-white px-6 text-xs font-black text-rose-600 transition-all hover:bg-rose-50 active:scale-95"
                >
                  重新发起诊断
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 测试成功
  if (testResult && testResult.success) {
    return (
      <div className="rounded-3xl border border-emerald-100 bg-emerald-50/20 p-8 shadow-sm">
        <div className="flex flex-col gap-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 shadow-lg shadow-emerald-500/20">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-base font-black text-emerald-900">
                  存储连接已就绪
                </h4>
                <p className="text-[11px] font-bold tracking-widest text-emerald-400 uppercase">
                  Diagnostic Passed
                </p>
              </div>
            </div>
            {onRetry && (
              <Button
                variant="ghost"
                onClick={onRetry}
                className="h-9 rounded-lg text-[10px] font-black tracking-widest text-slate-400 uppercase hover:bg-emerald-100/50"
              >
                重新诊断
              </Button>
            )}
          </div>

          {testResult.bucketInfo && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                { label: '空间名称', value: testResult.bucketInfo.name },
                { label: '所属区域', value: testResult.bucketInfo.region },
                {
                  label: '访问权限',
                  value: testResult.bucketInfo.private ? '私有' : '公开',
                },
              ].map((info, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-emerald-100/50 bg-white/60 p-4 transition-all hover:shadow-md"
                >
                  <span className="mb-1 block text-[10px] font-black text-emerald-400 uppercase">
                    {info.label}
                  </span>
                  <span className="text-xs font-black text-slate-900">
                    {info.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-start gap-3 rounded-2xl border border-emerald-100/30 bg-emerald-50/50 p-4">
            <Info className="mt-0.5 h-4 w-4 text-emerald-500" />
            <div className="space-y-1">
              <p className="text-[11px] font-black text-emerald-900 uppercase">
                配置启用说明
              </p>
              <p className="text-[11px] leading-relaxed font-medium text-emerald-600/80">
                当前链路验证通过。点击上方的“更新存储密钥”即可完成全站文件存储服务的切换。
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
