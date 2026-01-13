/**
 * 打印模板列表组件
 */

'use client';

import { Copy, Edit, MoreHorizontal, Plus, Star, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    deleteTemplate,
    duplicateTemplate,
    getTemplates,
    setDefaultTemplate,
} from '@/lib/print-designer/actions';

interface TemplateItem {
  id: string;
  name: string;
  type: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

const typeLabels: Record<string, string> = {
  'sales-order': '销售订单',
  'purchase-order': '采购订单',
  'factory-shipment': '厂家发货',
  'inbound-record': '仓库进货（入库记录）',
  'return-order': '退货订单',
  'delivery-note': '发货单',
  custom: '自定义',
};

export function TemplateList() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [isPending, startTransition] = useTransition();

  // 加载模板列表
  const loadTemplates = () => {
    startTransition(async () => {
      const result = await getTemplates(
        filterType === 'all' ? undefined : filterType
      );
      if (result.success && result.data) {
        setTemplates(result.data);
      } else {
        toast.error(result.error ?? '加载模板失败');
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

    const result = await deleteTemplate(id);
    if (result.success) {
      toast.success('模板已删除');
      loadTemplates();
    } else {
      toast.error(result.error ?? '删除失败');
    }
  };

  const handleDuplicate = async (id: string) => {
    const result = await duplicateTemplate(id);
    if (result.success) {
      toast.success('模板已复制');
      loadTemplates();
    } else {
      toast.error(result.error ?? '复制失败');
    }
  };

  const handleSetDefault = async (id: string, type: string) => {
    const result = await setDefaultTemplate(id, type);
    if (result.success) {
      toast.success('已设为默认模板');
      loadTemplates();
    } else {
      toast.error(result.error ?? '设置失败');
    }
  };

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="筛选类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="sales-order">销售订单</SelectItem>
            <SelectItem value="purchase-order">采购订单</SelectItem>
            <SelectItem value="factory-shipment">厂家发货</SelectItem>
            <SelectItem value="inbound-record">仓库进货（入库记录）</SelectItem>
            <SelectItem value="return-order">退货订单</SelectItem>
            <SelectItem value="delivery-note">发货单</SelectItem>
            <SelectItem value="custom">自定义</SelectItem>
          </SelectContent>
        </Select>

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
            <p className="mb-4 text-muted-foreground">还没有打印模板</p>
            <Button onClick={handleCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              创建第一个模板
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
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
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      asChild
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(template.id);
                        }}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        编辑
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(template.id);
                        }}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        复制
                      </DropdownMenuItem>
                      {!template.isDefault && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetDefault(template.id, template.type);
                          }}
                        >
                          <Star className="mr-2 h-4 w-4" />
                          设为默认
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(template.id);
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardDescription>
                  {typeLabels[template.type] ?? template.type}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  更新于 {new Date(template.updatedAt).toLocaleDateString('zh-CN')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
