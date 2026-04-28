/**
 * 打印模板列表组件
 */

'use client';

import { Copy, Edit, Plus, Star, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import {
  copyPrintTemplate,
  fetchPrintTemplates,
  markDefaultPrintTemplate,
  removePrintTemplate,
  type PrintTemplateListItem,
} from '@/lib/print-designer/template-client';

type TemplateItem = PrintTemplateListItem;

export function TemplateList() {
  const router = useRouter();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [isPending, startTransition] = useTransition();

  // 加载模板列表
  const loadTemplates = () => {
    startTransition(async () => {
      const result = await fetchPrintTemplates(
        filterType === 'all' ? undefined : filterType
      );
      if (result.success && result.data) {
        setTemplates(result.data);
      } else {
        toast({
          title: '加载失败',
          description: result.error ?? '加载模板列表失败',
          variant: 'destructive',
        });
      }
    });
  };

  useEffect(() => {
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType]);

  const handleCreate = () => {
    router.push('/settings/print-designer');
  };

  const handleEdit = (id: string) => {
    router.push(`/settings/print-designer?id=${id}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个模板吗？此操作不可撤销。')) return;

    const result = await removePrintTemplate(id);
    if (result.success) {
      toast({
        title: '删除成功',
        description: '模板已删除',
        variant: 'success',
      });
      loadTemplates();
    } else {
      toast({
        title: '删除失败',
        description: result.error ?? '删除模板失败',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicate = async (id: string) => {
    const result = await copyPrintTemplate(id);
    if (result.success) {
      toast({
        title: '复制成功',
        description: '模板已复制',
        variant: 'success',
      });
      loadTemplates();
    } else {
      toast({
        title: '复制失败',
        description: result.error ?? '复制模板失败',
        variant: 'destructive',
      });
    }
  };

  const handleSetDefault = async (id: string, type: string) => {
    const result = await markDefaultPrintTemplate(id, type);
    if (result.success) {
      toast({
        title: '设置成功',
        description: '已设为默认模板',
        variant: 'success',
      });
      loadTemplates();
    } else {
      toast({
        title: '设置失败',
        description: result.error ?? '设置默认模板失败',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="border-input bg-background ring-offset-background focus:ring-ring flex h-10 w-40 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="筛选类型"
        >
          <option value="all">全部类型</option>
          <option value="sales-order">销售订单</option>
          <option value="purchase-order">采购订单</option>
          <option value="factory-shipment">厂家发货</option>
          <option value="inbound-record">仓库进货（入库记录）</option>
          <option value="return-order">退货订单</option>
          <option value="delivery-note">发货单</option>
          <option value="finance-monthly-report">月度报表</option>
          <option value="finance-annual-report">年度报表</option>
          <option value="finance-profit-loss-report">盈亏分析</option>
          <option value="custom">自定义</option>
        </select>

        <Button onClick={handleCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          新建模板
        </Button>
      </div>

      {/* 模板列表 */}
      {isPending ? (
        <div className="flex h-64 items-center justify-center">
          <p className="text-muted-foreground">加载中...</p>
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="flex h-64 flex-col items-center justify-center text-center">
            <p className="text-muted-foreground mb-4">还没有打印模板</p>
            <Button onClick={handleCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              创建第一个模板
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map(template => (
            <Card
              key={template.id}
              className="group cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => handleEdit(template.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    {template.isDefault && (
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    )}
                    {template.isSystem && (
                      <Badge variant="outline" className="text-[10px]">
                        系统内置
                      </Badge>
                    )}
                  </div>
                  <div
                    className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={e => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(template.id)}
                      aria-label="编辑模板"
                      title="编辑"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDuplicate(template.id)}
                      aria-label="复制模板"
                      title="复制"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    {!template.isDefault ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          handleSetDefault(template.id, template.type)
                        }
                        aria-label="设为默认模板"
                        title="设为默认"
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    ) : null}
                    {!template.isSystem ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive h-8 w-8"
                        onClick={() => handleDelete(template.id)}
                        aria-label="删除模板"
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-xs">
                  更新于{' '}
                  {new Date(template.updatedAt).toLocaleDateString('zh-CN')}
                </p>
                {template.isSystem ? (
                  <p className="text-muted-foreground mt-1 text-[11px]">
                    系统内置，不能删除。
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
