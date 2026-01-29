'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';

import { Button } from '@/components/ui/button';
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
import { Switch } from '@/components/ui/switch';
import { categoryQueryKeys, createCategory } from '@/lib/api/categories';
import { queryKeys } from '@/lib/queryKeys';
import { showError, showSuccess } from '@/lib/utils/toast-helper';

export interface CategoryQuickCreateParent {
  id: string;
  name: string;
  /** 0-based: 0=L1, 1=L2, 2=L3 */
  level: number;
}

interface CategoryQuickCreateDialogProps {
  open: boolean;
  parent: CategoryQuickCreateParent | null;
  onOpenChange: (open: boolean) => void;
}

type CategoryStatus = 'active' | 'inactive';

export function CategoryQuickCreateDialog({
  open,
  parent,
  onOpenChange,
}: CategoryQuickCreateDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState('');
  const [sortOrder, setSortOrder] = React.useState<number>(0);
  const [status, setStatus] = React.useState<CategoryStatus>('active');

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: result => {
      showSuccess('创建成功', {
        description: `分类 "${result.data?.name ?? name}" 创建成功！`,
      });
      Promise.all([
        queryClient.refetchQueries({
          queryKey: categoryQueryKeys.all,
          type: 'active',
        }),
        queryClient.refetchQueries({
          queryKey: queryKeys.categories.all,
          type: 'active',
        }),
        queryClient.refetchQueries({
          queryKey: categoryQueryKeys.options(),
          type: 'active',
        }),
      ]).catch(() => {
        // ignore cache refresh errors
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      showError('创建失败', {
        description: error.message || '创建分类时发生错误，请重试。',
      });
    },
  });

  React.useEffect(() => {
    if (!open) return;
    setName('');
    setSortOrder(0);
    setStatus('active');
  }, [open, parent?.id]);

  const levelLabel = React.useMemo(() => {
    if (!parent) return '一级分类';
    if (parent.level === 0) return '二级分类';
    if (parent.level === 1) return '三级分类';
    return '子分类';
  }, [parent]);

  const handleSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (createMutation.isPending) return;

      const trimmedName = name.trim();
      if (!trimmedName) {
        showError('创建失败', { description: '请输入分类名称' });
        return;
      }

      createMutation.mutate({
        name: trimmedName,
        parentId: parent?.id,
        sortOrder,
        status,
      });
    },
    [createMutation, name, parent?.id, sortOrder, status]
  );

  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => {
        if (createMutation.isPending) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新增{levelLabel}</DialogTitle>
          <DialogDescription>
            {parent ? `父级分类：${parent.name}` : '创建顶级分类（一级分类）'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category-quick-create-name">分类名称 *</Label>
            <Input
              id="category-quick-create-name"
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="请输入分类名称"
              autoFocus
              autoComplete="off"
              disabled={createMutation.isPending}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category-quick-create-sort">排序顺序</Label>
              <Input
                id="category-quick-create-sort"
                type="number"
                inputMode="numeric"
                value={sortOrder}
                onChange={event =>
                  setSortOrder(
                    Number.parseInt(event.target.value || '0', 10) || 0
                  )
                }
                disabled={createMutation.isPending}
              />
              <p className="text-muted-foreground text-xs">
                0 表示自动排在同级最后
              </p>
            </div>

            <div className="space-y-2">
              <Label>状态</Label>
              <div className="flex items-center gap-2">
                <Switch
                  checked={status === 'active'}
                  onCheckedChange={checked =>
                    setStatus(checked ? 'active' : 'inactive')
                  }
                  disabled={createMutation.isPending}
                  className="data-[state=checked]:bg-green-500"
                />
                <span className="text-sm">
                  {status === 'active' ? '启用' : '禁用'}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
            >
              取消
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
