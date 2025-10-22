/**
 * 运输查询站点管理页面
 * ✅ 符合产品模块UI风格规范
 * SOLID-S: 页面组件只负责状态管理和事件编排
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Globe, Loader2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import React from 'react';

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
import type {
  ShippingSite,
  ShippingSiteCreateInput,
  ShippingSitesResponse,
} from '@/lib/types/shipping';
import {
  normalizeSelector,
  normalizeSelectorGroup,
} from '@/lib/utils/selector-normalizer';

export default function ShippingSitesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [formMode, setFormMode] = React.useState<'create' | 'edit'>('create');
  const [selectedSite, setSelectedSite] = React.useState<
    ShippingSite | undefined
  >();

  // 表单状态
  const [formData, setFormData] = React.useState<ShippingSiteCreateInput>({
    name: '',
    url: '',
    description: '',
    searchInputSelector: '',
    searchButtonSelector: '',
    resultContainerSelector: '',
    extractSelectors: {
      status: '',
      destination: '',
      estimatedArrival: '',
      updateTime: '',
    },
  });

  // 获取站点列表
  const { data: sitesData, isLoading } = useQuery<ShippingSitesResponse>({
    queryKey: ['settings', 'shipping-sites'],
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
    mutationFn: async (data: ShippingSiteCreateInput & { id?: string }) => {
      const url =
        formMode === 'create'
          ? '/api/shipping/sites'
          : `/api/shipping/sites/${data.id}`;
      const method = formMode === 'create' ? 'POST' : 'PUT';

      const { extractSelectors, ...rest } = data;
      const payload = {
        ...rest,
        searchInputSelector: normalizeSelector(rest.searchInputSelector),
        searchButtonSelector: normalizeSelector(rest.searchButtonSelector),
        resultContainerSelector: normalizeSelector(
          rest.resultContainerSelector
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
      });
      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({
        queryKey: ['settings', 'shipping-sites'],
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
      toast({ title: '成功', description: '站点删除成功' });
      queryClient.invalidateQueries({
        queryKey: ['settings', 'shipping-sites'],
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

  // 事件处理
  const handleCreate = () => {
    setFormMode('create');
    resetForm();
    setDialogOpen(true);
  };

  const handleEdit = (site: ShippingSite) => {
    setFormMode('edit');
    setSelectedSite(site);
    const extractSelectors = JSON.parse(site.extractSelectors);
    setFormData({
      name: site.name,
      url: site.url,
      description: site.description || '',
      searchInputSelector: site.searchInputSelector,
      searchButtonSelector: site.searchButtonSelector,
      resultContainerSelector: site.resultContainerSelector,
      extractSelectors,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (
      !formData.name ||
      !formData.url ||
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

    saveSiteMutation.mutate(
      formMode === 'edit' && selectedSite
        ? { ...formData, id: selectedSite.id }
        : formData
    );
  };

  const handleDelete = (site: ShippingSite) => {
    if (confirm(`确定要删除站点"${site.name}"吗？`)) {
      deleteSiteMutation.mutate(site.id);
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
      extractSelectors: {
        status: '',
        destination: '',
        estimatedArrival: '',
        updateTime: '',
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
                    配置和管理运输查询网站
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

        {/* 站点列表 */}
        <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
          <CardContent className="space-y-6 p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-600">
                管理运输查询网站的配置信息和CSS选择器
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
                    <TableHead>URL</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sitesData?.data.map(site => (
                    <TableRow key={site.id}>
                      <TableCell className="font-medium">{site.name}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {site.url}
                      </TableCell>
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {formMode === 'create' ? '新增站点' : '编辑站点'}
              </DialogTitle>
              <DialogDescription>
                配置运输查询站点的基本信息和CSS选择器
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">站点名称 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={e =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="顺丰速运"
                  />
                </div>
                <div>
                  <Label htmlFor="url">站点URL *</Label>
                  <Input
                    id="url"
                    value={formData.url}
                    onChange={e =>
                      setFormData({ ...formData, url: e.target.value })
                    }
                    placeholder="https://www.sf-express.com/cn"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">描述</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={e =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="站点描述信息"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">页面选择器配置</h4>
                <div className="grid gap-3">
                  <div>
                    <Label htmlFor="searchInput">搜索框选择器 *</Label>
                    <Input
                      id="searchInput"
                      value={formData.searchInputSelector}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          searchInputSelector: e.target.value,
                        })
                      }
                      placeholder="input[name='tracking']"
                    />
                  </div>
                  <div>
                    <Label htmlFor="searchButton">搜索按钮选择器 *</Label>
                    <Input
                      id="searchButton"
                      value={formData.searchButtonSelector}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          searchButtonSelector: e.target.value,
                        })
                      }
                      placeholder="button[type='submit']"
                    />
                  </div>
                  <div>
                    <Label htmlFor="resultContainer">结果容器选择器 *</Label>
                    <Input
                      id="resultContainer"
                      value={formData.resultContainerSelector}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          resultContainerSelector: e.target.value,
                        })
                      }
                      placeholder=".result-container"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">数据提取选择器</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="statusSelector">状态选择器</Label>
                    <Input
                      id="statusSelector"
                      value={formData.extractSelectors.status}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          extractSelectors: {
                            ...formData.extractSelectors,
                            status: e.target.value,
                          },
                        })
                      }
                      placeholder=".status"
                    />
                  </div>
                  <div>
                    <Label htmlFor="destinationSelector">目的地选择器</Label>
                    <Input
                      id="destinationSelector"
                      value={formData.extractSelectors.destination}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          extractSelectors: {
                            ...formData.extractSelectors,
                            destination: e.target.value,
                          },
                        })
                      }
                      placeholder=".destination"
                    />
                  </div>
                  <div>
                    <Label htmlFor="arrivalSelector">预计到达选择器</Label>
                    <Input
                      id="arrivalSelector"
                      value={formData.extractSelectors.estimatedArrival}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          extractSelectors: {
                            ...formData.extractSelectors,
                            estimatedArrival: e.target.value,
                          },
                        })
                      }
                      placeholder=".arrival-time"
                    />
                  </div>
                  <div>
                    <Label htmlFor="updateTimeSelector">更新时间选择器</Label>
                    <Input
                      id="updateTimeSelector"
                      value={formData.extractSelectors.updateTime}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          extractSelectors: {
                            ...formData.extractSelectors,
                            updateTime: e.target.value,
                          },
                        })
                      }
                      placeholder=".update-time"
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
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
      </div>
    </div>
  );
}
