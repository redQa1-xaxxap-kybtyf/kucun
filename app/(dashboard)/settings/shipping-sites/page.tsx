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
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  const { data: session } = useSession();
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

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

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
      const response = await fetch(`/api/shipping/sites/${id}`, {
        method: 'DELETE',
      });
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

  // 权限检查
  if (session?.user?.role !== 'admin') {
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
        <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
          <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
                  <Globe className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    运输查询站点管理
                  </h1>
                  <p className="text-sm text-gray-600">
                    配置和管理运输查询网站 - 优化CSS选择器配置体验
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="default"
                  size="lg"
                  onClick={() =>
                    router.push('/settings/shipping-sites/selector-helper')
                  }
                  className="h-11 gap-2 bg-gradient-to-r from-purple-600 to-blue-600 shadow-md transition-all hover:scale-105 hover:shadow-lg"
                >
                  <span className="text-lg">✨</span>
                  智能选择器助手
                </Button>
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
            </div>
          </CardContent>
        </Card>

        {/* 站点列表 */}
        <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
          <CardContent className="space-y-6 p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-600">
                管理运输查询网站的配置信息和CSS选择器,使用固定的4个提取字段
              </p>
              <Button onClick={handleCreate} disabled={isLoading}>
                <Plus className="mr-2 h-4 w-4" />
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
                  <TableRow>
                    <TableHead>站点名称</TableHead>
                    {/* 🔒 只有管理员可以看到 URL 列 */}
                    {isAdmin && <TableHead>URL</TableHead>}
                    <TableHead>描述</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sitesData?.data.map(site => (
                    <TableRow key={site.id}>
                      <TableCell className="font-medium">{site.name}</TableCell>
                      {/* 🔒 只有管理员可以看到 URL */}
                      {isAdmin && (
                        <TableCell className="max-w-xs truncate">
                          {'url' in site ? site.url : '***'}
                        </TableCell>
                      )}
                      <TableCell className="max-w-xs truncate">
                        {site.description || '-'}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${
                            site.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {site.status === 'active' ? '启用' : '禁用'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(site)}
                          className="mr-2"
                        >
                          编辑
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(site)}
                        >
                          删除
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 站点表单对话框 */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {formMode === 'create' ? '新增站点' : '编辑站点'}
              </DialogTitle>
              <DialogDescription>
                配置运输查询站点的基本信息和CSS选择器
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* 基本信息 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2">
                  <h4 className="font-semibold text-gray-900">基本信息</h4>
                  <span className="text-xs text-gray-500">
                    配置站点的基本属性
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label
                      htmlFor="name"
                      className="text-sm font-medium text-gray-700"
                    >
                      站点名称 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={e =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="例如: 顺丰速运、中国邮政"
                      className="mt-1.5"
                    />
                  </div>

                  {/* 🔒 只有管理员可以看到和编辑 URL */}
                  {isAdmin && (
                    <div>
                      <Label
                        htmlFor="url"
                        className="text-sm font-medium text-gray-700"
                      >
                        站点URL <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="url"
                        value={formData.url}
                        onChange={e =>
                          setFormData({ ...formData, url: e.target.value })
                        }
                        placeholder="https://www.example.com/tracking"
                        className="mt-1.5"
                      />
                      <p className="mt-1.5 text-xs text-gray-500">
                        输入完整的查询页面URL地址
                      </p>
                    </div>
                  )}

                  <div>
                    <Label
                      htmlFor="description"
                      className="text-sm font-medium text-gray-700"
                    >
                      站点描述
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
                      placeholder="简要说明站点用途和特点"
                      rows={2}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </div>

              {/* 页面选择器配置 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2">
                  <h4 className="font-semibold text-gray-900">选择器配置</h4>
                  <span className="text-xs text-gray-500">
                    配置页面元素的CSS选择器
                  </span>
                </div>

                {/* 搜索框选择器 */}
                <div className="rounded-lg border border-blue-100 bg-blue-50/30 p-4">
                  <div className="mb-3">
                    <Label
                      htmlFor="searchInput"
                      className="text-sm font-medium text-gray-900"
                    >
                      搜索框选择器 <span className="text-red-500">*</span>
                    </Label>
                    <p className="mt-1 text-xs text-gray-600">
                      定位网页上输入追踪单号的输入框
                    </p>
                  </div>
                  <Input
                    id="searchInput"
                    value={formData.searchInputSelector}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        searchInputSelector: e.target.value,
                      })
                    }
                    placeholder="例如: input[name='tracking'], #bill, .search-input"
                    className="font-mono text-sm"
                  />
                </div>

                {/* 搜索按钮选择器 */}
                <div className="rounded-lg border border-green-100 bg-green-50/30 p-4">
                  <div className="mb-3">
                    <Label
                      htmlFor="searchButton"
                      className="text-sm font-medium text-gray-900"
                    >
                      搜索按钮选择器 <span className="text-red-500">*</span>
                    </Label>
                    <p className="mt-1 text-xs text-gray-600">
                      定位网页上触发查询的按钮元素
                    </p>
                  </div>
                  <Input
                    id="searchButton"
                    value={formData.searchButtonSelector}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        searchButtonSelector: e.target.value,
                      })
                    }
                    placeholder="例如: button[type='submit'], .search-btn, #searchBtn"
                    className="font-mono text-sm"
                  />
                </div>

                {/* 结果容器选择器 */}
                <div className="rounded-lg border border-purple-100 bg-purple-50/30 p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex-1">
                      <Label
                        htmlFor="resultContainer"
                        className="text-sm font-medium text-gray-900"
                      >
                        结果容器选择器 <span className="text-red-500">*</span>
                      </Label>
                      <p className="mt-1 text-xs text-gray-600">
                        定位显示查询结果的容器区域
                      </p>
                    </div>
                  </div>
                  <Input
                    id="resultContainer"
                    value={formData.resultContainerSelector}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        resultContainerSelector: e.target.value,
                      })
                    }
                    placeholder="例如: .result-container, .tracking-result, #results"
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              {/* 固定字段配置 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2">
                  <h4 className="font-semibold text-gray-900">数据提取字段</h4>
                  <span className="text-xs text-gray-500">
                    配置固定的4个提取字段的CSS选择器
                  </span>
                </div>

                <p className="text-sm text-gray-600">
                  为以下4个固定字段配置CSS选择器，用于从查询结果中提取数据
                </p>

                <div className="space-y-3">
                  {FIXED_EXTRACT_FIELDS.map(fieldConfig => (
                    <div
                      key={fieldConfig.key}
                      className="rounded-lg border border-blue-100 bg-blue-50/30 p-4"
                    >
                      <div className="space-y-3">
                        {/* 字段标题 */}
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium text-gray-900">
                              {fieldConfig.label}
                              <span className="ml-2 text-xs font-normal text-gray-500">
                                ({fieldConfig.key})
                              </span>
                            </h5>
                            <p className="mt-0.5 text-xs text-gray-600">
                              {fieldConfig.description}
                            </p>
                          </div>
                          <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            必填
                          </span>
                        </div>

                        {/* CSS选择器输入 */}
                        <div>
                          <div className="mb-1.5">
                            <Label className="text-xs font-medium text-gray-700">
                              CSS选择器 <span className="text-red-500">*</span>
                            </Label>
                          </div>
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
                            className="h-9 font-mono text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  resetForm();
                }}
                disabled={saveSiteMutation.isPending}
              >
                取消
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saveSiteMutation.isPending}
              >
                {saveSiteMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                保存
              </Button>
            </DialogFooter>
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
