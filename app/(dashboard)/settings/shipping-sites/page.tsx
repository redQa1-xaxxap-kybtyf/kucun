/**
 * 运输查询站点管理页面 - 简化优化版
 * ✅ 删除智能分析功能,专注核心配置
 * ✅ 优化表单布局和用户体验
 * ✅ 使用固定的3个提取字段(status, destination, estimatedArrival)
 * ✅ 符合产品模块UI风格规范
 * SOLID-S: 页面组件只负责状态管理和事件编排
 * YAGNI: 移除动态字段功能,简化用户体验
 */

'use client';

// cSpell:ignore shipxy

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Globe, Loader2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import React from 'react';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { queryKeys } from '@/lib/queryKeys';
import type {
    ExtractField,
    ShippingSite,
    ShippingSitesResponse,
} from '@/lib/types/shipping';
import { cn } from '@/lib/utils';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';
import {
    normalizeSelector,
    normalizeSelectorGroup,
} from '@/lib/utils/selector-normalizer';

// 固定的3个提取字段配置
const FIXED_EXTRACT_FIELDS: ExtractField[] = [
  {
    key: 'status',
    label: '状态',
    selector: '',
    required: true,
    description: '物流状态信息',
  },
  {
    key: 'destination',
    label: '目的地',
    selector: '',
    required: true,
    description: '物流目的地',
  },
  {
    key: 'estimatedArrival',
    label: '预计到达',
    selector: '',
    required: true,
    description: '预计到达时间',
  },
];

interface FormDataState {
  name: string;
  url: string;
  description: string;
  searchInputSelector: string;
  searchButtonSelector: string;
  resultContainerSelector: string;
  // 固定的3个字段，每个字段只需要配置 selector
  extractFields: {
    status: string;
    destination: string;
    estimatedArrival: string;
  };
}

export default function ShippingSitesPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 🔒 检查是否为管理员
  const isAdmin = session?.user?.role === 'admin';

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [formMode, setFormMode] = React.useState<'create' | 'edit'>('create');
  const [selectedSite, setSelectedSite] = React.useState<
    ShippingSite | undefined
  >();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [siteToDelete, setSiteToDelete] = React.useState<
    ShippingSite | undefined
  >();

  // 表单状态 - 使用固定的3个字段
  const [formData, setFormData] = React.useState<FormDataState>({
    name: '',
    url: '',
    description: '',
    searchInputSelector: '',
    searchButtonSelector: '',
    resultContainerSelector: '',
    extractFields: {
      status: '',
      destination: '',
      estimatedArrival: '',
    },
  });

  // 获取站点列表
  const { data: sitesData, isLoading } = useQuery<ShippingSitesResponse>({
    queryKey: queryKeys.settings.shippingSites(),
    queryFn: async () => {
      const response = await fetch('/api/shipping/sites');
      if (!response.ok) {
        throw new Error('获取站点列表失败');
      }
      const result: { success: boolean; data: ShippingSitesResponse } =
        await response.json();
      if (!result.success) {
        throw new Error('获取站点列表失败');
      }
      return result.data;
    },
    enabled: sessionStatus === 'authenticated' && isAdmin,
  });

  // 创建/更新站点
  const saveSiteMutation = useMutation({
    mutationFn: async (data: FormDataState & { id?: string }) => {
      const url =
        formMode === 'create'
          ? '/api/shipping/sites'
          : `/api/shipping/sites/${data.id}`;
      const method = formMode === 'create' ? 'POST' : 'PUT';

      // 使用固定的3个字段构建选择器对象
      const extractSelectors = {
        status: data.extractFields.status,
        destination: data.extractFields.destination,
        estimatedArrival: data.extractFields.estimatedArrival,
      };

      const payload = {
        name: data.name,
        url: data.url,
        description: data.description,
        searchInputSelector: normalizeSelector(data.searchInputSelector),
        searchButtonSelector: normalizeSelector(data.searchButtonSelector),
        resultContainerSelector: normalizeSelector(
          data.resultContainerSelector
        ),
        extractSelectors: normalizeSelectorGroup(extractSelectors),
      };

      const requestBody =
        method === 'POST' ? payload : { ...payload, id: data.id };

      const response = await fetch(
        url,
        getCsrfTokenHeader({
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '保存失败');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '成功',
        description: `站点${formMode === 'create' ? '创建' : '更新'}成功`,
        variant: 'success',
      });
      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({
        queryKey: queryKeys.settings.shippingSites(),
      });
    },
    onError: (error: Error) => {
      toast({
        title: '保存失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // 删除站点
  const deleteSiteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(
        `/api/shipping/sites/${id}`,
        getCsrfTokenHeader({ method: 'DELETE' })
      );
      if (!response.ok) {
        throw new Error('删除失败');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '成功',
        description: '站点删除成功',
        variant: 'success',
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.settings.shippingSites(),
      });
    },
    onError: (error: Error) => {
      toast({
        title: '删除失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // 更新固定字段的选择器
  const handleUpdateFieldSelector = (
    fieldKey: keyof FormDataState['extractFields'],
    selector: string
  ) => {
    setFormData({
      ...formData,
      extractFields: {
        ...formData.extractFields,
        [fieldKey]: selector,
      },
    });
  };

  // 事件处理
  const handleCreate = () => {
    setFormMode('create');
    resetForm();
    setDialogOpen(true);
  };

  const handleEdit = (site: ShippingSite) => {
    setFormMode('edit');
    setSelectedSite(site);

    // 解析 extractSelectors JSON
    const extractSelectors = JSON.parse(site.extractSelectors);

    // 🔒 处理 URL 字段（可能不存在）
    const siteUrl = 'url' in site ? site.url : '';

    // 提取固定的3个字段
    setFormData({
      name: site.name,
      url: siteUrl,
      description: site.description || '',
      searchInputSelector: site.searchInputSelector,
      searchButtonSelector: site.searchButtonSelector,
      resultContainerSelector: site.resultContainerSelector,
      extractFields: {
        status: extractSelectors.status || '',
        destination: extractSelectors.destination || '',
        estimatedArrival: extractSelectors.estimatedArrival || '',
      },
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    // 🔒 验证基本字段（管理员需要验证 URL）
    if (
      !formData.name ||
      (isAdmin && !formData.url) ||
      !formData.searchInputSelector ||
      !formData.searchButtonSelector ||
      !formData.resultContainerSelector
    ) {
      toast({
        title: '验证失败',
        description: '请填写所有必填字段',
        variant: 'destructive',
      });
      return;
    }

    // 验证固定的3个提取字段
    const { status, destination, estimatedArrival } = formData.extractFields;
    if (!status || !destination || !estimatedArrival) {
      toast({
        title: '验证失败',
        description: '请填写所有提取字段的CSS选择器',
        variant: 'destructive',
      });
      return;
    }

    saveSiteMutation.mutate(
      formMode === 'edit' && selectedSite
        ? { ...formData, id: selectedSite.id }
        : formData
    );
  };

  const handleDelete = (site: ShippingSite) => {
    setSiteToDelete(site);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (siteToDelete) {
      deleteSiteMutation.mutate(siteToDelete.id);
      setDeleteDialogOpen(false);
      setSiteToDelete(undefined);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      description: '',
      searchInputSelector: '',
      searchButtonSelector: '',
      resultContainerSelector: '',
      extractFields: {
        status: '',
        destination: '',
        estimatedArrival: '',
      },
    });
    setSelectedSite(undefined);
  };

  // 权限与加载状态检查
  if (sessionStatus === 'loading') {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <p className="text-sm font-bold text-slate-400 animate-pulse">正在验证权限...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col overflow-hidden p-6">
        <Card className="border-amber-200 bg-amber-50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-amber-800">
              <Globe className="mr-2 h-5 w-5" />
              权限不足
            </CardTitle>
            <CardDescription className="text-amber-700">
              只有管理员可以访问运输站点管理功能。
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="flex-1 space-y-6 overflow-y-auto">
        {/* 页面头部 */}
        <div className="group relative overflow-hidden rounded-[32px] border border-white bg-white/60 p-1 shadow-xl shadow-slate-200/50 backdrop-blur-xl transition-all duration-500 hover:shadow-2xl hover:shadow-slate-300/40">
          <div className="flex items-center justify-between rounded-[28px] bg-white/80 p-8 shadow-inner backdrop-blur-md">
            <div className="flex items-center gap-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-600/30 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                <Globe className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">
                  运输查询站点管理
                </h1>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  配置和管理运输查询网站 • 优化 CSS 选择器配置体验
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <Button
                variant="default"
                size="lg"
                onClick={() =>
                  router.push('/settings/shipping-sites/selector-helper')
                }
                className="h-12 gap-2 rounded-2xl bg-slate-900 px-6 font-black shadow-lg shadow-slate-900/20 transition-all hover:scale-105 active:scale-95"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/20">
                  <span className="text-sm">✨</span>
                </div>
                智能选择器助手
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => router.push('/settings')}
                className="h-12 gap-2 rounded-2xl border-slate-100 bg-white px-6 font-black text-slate-600 shadow-sm transition-all hover:scale-105 hover:bg-slate-50 active:scale-95"
              >
                <ArrowLeft className="h-4 w-4" />
                返回设置
              </Button>
            </div>
          </div>
          {/* 装饰性背景层 */}
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-blue-500 opacity-5 blur-3xl" />
        </div>

        {/* 站点列表 */}
        <div className="rounded-[32px] border border-white bg-white/60 p-8 shadow-xl shadow-slate-200/50 backdrop-blur-xl">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                Data Management / 站点配置
              </p>
              <h3 className="text-lg font-black tracking-tight text-slate-900">
                合作站点列表
              </h3>
              <p className="text-sm font-bold text-slate-400">
                管理查询网点的 CSS 选择器，使用固定的 3 个提取字段。
              </p>
            </div>
            <Button 
              onClick={handleCreate} 
              disabled={isLoading}
              className="h-12 rounded-2xl bg-blue-600 px-6 font-black shadow-lg shadow-blue-600/20 transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="mr-2 h-5 w-5" />
              新增站点
            </Button>
          </div>
            {isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">加载中...</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-50 hover:bg-transparent">
                    <TableHead className="text-xs font-black uppercase tracking-widest text-slate-500">站点名称</TableHead>
                    {isAdmin && <TableHead className="text-xs font-black uppercase tracking-widest text-slate-500">查询 URL</TableHead>}
                    <TableHead className="text-xs font-black uppercase tracking-widest text-slate-500">功能描述</TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-widest text-slate-500">当前状态</TableHead>
                    <TableHead className="text-right text-xs font-black uppercase tracking-widest text-slate-500">管理操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sitesData?.data.map(site => (
                    <TableRow 
                      key={site.id} 
                      className="group border-slate-50 transition-all hover:bg-slate-50/50"
                    >
                      <TableCell className="py-5">
                        <span className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                          {site.name}
                        </span>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="max-w-xs truncate font-mono text-xs text-slate-500">
                          {'url' in site ? site.url : '***'}
                        </TableCell>
                      )}
                      <TableCell className="max-w-xs truncate text-xs font-bold text-slate-500">
                        {site.description || '-'}
                      </TableCell>
                      <TableCell>
                        <div className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest outline outline-1",
                          site.status === 'active' 
                            ? "bg-emerald-50 text-emerald-600 outline-emerald-100" 
                            : "bg-slate-50 text-slate-500 outline-slate-100"
                        )}>
                          <div className={cn("h-1.5 w-1.5 rounded-full", site.status === 'active' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-400")} />
                          {site.status === 'active' ? 'ACTIVE' : 'DISABLED'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0 translate-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(site)}
                            className="h-9 rounded-xl border-slate-100 bg-white font-black text-slate-600 shadow-sm hover:bg-slate-50"
                          >
                            编辑配置
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(site)}
                            className="h-9 rounded-xl font-black shadow-sm"
                          >
                            删除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </div>

        {/* 站点表单对话框 */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="flex h-[90vh] max-w-5xl flex-col overflow-hidden rounded-[32px] border-none bg-slate-50/50 p-0 shadow-2xl backdrop-blur-2xl">
            <div className="flex h-full flex-col">
              <DialogHeader className="bg-white/80 p-8 shadow-sm backdrop-blur-md">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/20">
                    <Plus className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-black tracking-tight text-slate-900">
                      {formMode === 'create' ? '新增站点配置' : '编辑站点配置'}
                    </DialogTitle>
                    <DialogDescription className="text-xs font-bold text-slate-500">
                      配置运输查询站点的核心元数据与 CSS 爬虫选择器
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="space-y-8">
                  {/* 基本信息 */}
                  <div className="rounded-[24px] border border-white bg-white/40 p-6 shadow-sm">
                    <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">基本信息</h4>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-xs font-black uppercase tracking-widest text-slate-500">
                          站点名称 <span className="text-rose-500">*</span>
                        </Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={e =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                          placeholder="例如: 顺丰速运、中国邮政"
                          className="h-11 rounded-xl border-slate-100 bg-white/80 font-bold focus:bg-white"
                        />
                      </div>

                      {isAdmin && (
                        <div className="space-y-2">
                          <Label htmlFor="url" className="text-xs font-black uppercase tracking-widest text-slate-500">
                            站点主页 URL <span className="text-rose-500">*</span>
                          </Label>
                          <Input
                            id="url"
                            value={formData.url}
                            onChange={e =>
                              setFormData({ ...formData, url: e.target.value })
                            }
                            placeholder="https://www.example.com/tracking"
                            className="h-11 rounded-xl border-slate-100 bg-white/80 font-mono text-xs focus:bg-white"
                          />
                        </div>
                      )}

                      <div className="md:col-span-2 space-y-2">
                        <Label htmlFor="description" className="text-xs font-black uppercase tracking-widest text-slate-500">
                          业务描述 / 备注
                        </Label>
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              description: e.target.value,
                            })
                          }
                          placeholder="简要说明站点用途和特点..."
                          rows={2}
                          className="rounded-xl border-slate-100 bg-white/80 font-bold focus:bg-white resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 页面选择器配置 */}
                  <div className="rounded-[24px] border border-white bg-white/40 p-6 shadow-sm">
                    <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
                      <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                      <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">核心交互选择器</h4>
                    </div>

                    <div className="grid gap-6 md:grid-cols-3">
                      <div className="space-y-3 rounded-2xl bg-blue-50/50 p-4 ring-1 ring-blue-100">
                        <Label htmlFor="searchInput" className="text-[11px] font-black uppercase tracking-widest text-blue-600">
                          搜索框定位 <span className="text-rose-500">*</span>
                        </Label>
                        <Input
                          id="searchInput"
                          value={formData.searchInputSelector}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              searchInputSelector: e.target.value,
                            })
                          }
                          placeholder="#bill, .search-input"
                          className="h-10 border-blue-100 bg-white font-mono text-xs font-bold"
                        />
                      </div>

                      <div className="space-y-3 rounded-2xl bg-emerald-50/50 p-4 ring-1 ring-emerald-100">
                        <Label htmlFor="searchButton" className="text-[11px] font-black uppercase tracking-widest text-emerald-600">
                          触发按钮定位 <span className="text-rose-500">*</span>
                        </Label>
                        <Input
                          id="searchButton"
                          value={formData.searchButtonSelector}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              searchButtonSelector: e.target.value,
                            })
                          }
                          placeholder=".search-btn, #searchBtn"
                          className="h-10 border-emerald-100 bg-white font-mono text-xs font-bold"
                        />
                      </div>

                      <div className="space-y-3 rounded-2xl bg-purple-50/50 p-4 ring-1 ring-purple-100">
                        <Label htmlFor="resultContainer" className="text-[11px] font-black uppercase tracking-widest text-purple-600">
                          结果容器定位 <span className="text-rose-500">*</span>
                        </Label>
                        <Input
                          id="resultContainer"
                          value={formData.resultContainerSelector}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              resultContainerSelector: e.target.value,
                            })
                          }
                          placeholder=".result-container, #results"
                          className="h-10 border-purple-100 bg-white font-mono text-xs font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 数据提取配置 */}
                  <div className="rounded-[24px] border border-white bg-white/40 p-6 shadow-sm">
                    <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
                      <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">数据提取映射表</h4>
                    </div>

                    <div className="grid gap-4">
                      {FIXED_EXTRACT_FIELDS.map(fieldConfig => (
                        <div
                          key={fieldConfig.key}
                          className="flex items-center gap-6 rounded-2xl bg-white/60 p-5 ring-1 ring-slate-100 transition-all hover:ring-blue-200 hover:bg-white"
                        >
                          <div className="flex-1 space-y-1">
                            <h5 className="text-sm font-black text-slate-900">
                              {fieldConfig.label}
                            </h5>
                            <p className="text-xs font-bold text-slate-400">
                              {fieldConfig.description}
                            </p>
                          </div>
                          
                          <div className="w-1/2 space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              CSS 选择器 <span className="text-rose-500">*</span>
                            </Label>
                            <Input
                              value={
                                formData.extractFields[
                                  fieldConfig.key as keyof typeof formData.extractFields
                                ]
                              }
                              onChange={e =>
                                handleUpdateFieldSelector(
                                  fieldConfig.key as keyof typeof formData.extractFields,
                                  e.target.value
                                )
                              }
                              placeholder={`.${fieldConfig.key}, [data-field='${fieldConfig.key}']`}
                              className="h-10 rounded-xl border-slate-100 bg-white font-mono text-xs font-bold"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="bg-slate-50 p-8 shadow-inner backdrop-blur-md">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                  disabled={saveSiteMutation.isPending}
                  className="h-12 rounded-2xl px-8 font-black text-slate-500 transition-all hover:bg-slate-200"
                >
                  取消配置
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={saveSiteMutation.isPending}
                  className="h-12 rounded-2xl bg-slate-900 px-10 font-black shadow-lg shadow-slate-900/10 transition-all hover:scale-105 active:scale-95"
                >
                  {saveSiteMutation.isPending ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <span className="mr-2">💾</span>
                  )}
                  保存站点配置
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* 删除确认对话框 */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>删除站点</AlertDialogTitle>
              <AlertDialogDescription>
                确定要删除站点 &quot;{siteToDelete?.name}&quot;
                吗？此操作无法撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
