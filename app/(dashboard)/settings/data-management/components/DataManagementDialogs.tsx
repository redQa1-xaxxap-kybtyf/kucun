'use client';

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
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

import type { Preview, SystemMode } from '../types';
import { formatMoney } from '../utils';

interface DataManagementPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview?: Preview;
  isPending: boolean;
}

export function DataManagementPreviewDialog({
  open,
  onOpenChange,
  preview,
  isPending,
}: DataManagementPreviewDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle>预览清理范围</AlertDialogTitle>
          <AlertDialogDescription>
            用于防误操作：先查看将被处理的数据范围（数量/金额）。不做任何修改。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          {isPending && (
            <div className="text-muted-foreground text-sm">正在生成预览...</div>
          )}
          {preview && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  生成时间：
                  {new Date(preview.generatedAt).toLocaleString('zh-CN')}
                </span>
                <span className="font-medium">
                  合计：{preview.totals.count} 项 / ¥
                  {formatMoney(preview.totals.amountSum)}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {preview.items.map(item => (
                  <div
                    key={item.id}
                    className="bg-background flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <span>{item.label}</span>
                    <span className="font-mono text-xs text-slate-600">
                      {item.count}
                      {typeof item.amountSum === 'number'
                        ? ` / ¥${formatMoney(item.amountSum)}`
                        : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>关闭</AlertDialogCancel>
          <AlertDialogAction onClick={() => onOpenChange(false)}>
            我已知晓
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface DataManagementExecuteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  systemMode: SystemMode;
  confirmWord: string;
  confirmText: string;
  onConfirmTextChange: (value: string) => void;
  isExecuting: boolean;
  onExecute: () => void;
}

export function DataManagementExecuteDialog({
  open,
  onOpenChange,
  systemMode,
  confirmWord,
  confirmText,
  onConfirmTextChange,
  isExecuting,
  onExecute,
}: DataManagementExecuteDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={nextOpen => {
        onOpenChange(nextOpen);
        if (!nextOpen) onConfirmTextChange('');
      }}
    >
      <AlertDialogContent className="max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>强确认</AlertDialogTitle>
          <AlertDialogDescription>
            本操作不可撤销。请输入“{confirmWord}”以继续。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <Input
            value={confirmText}
            onChange={e => onConfirmTextChange(e.target.value)}
            placeholder={`请输入：${confirmWord}`}
          />
          {systemMode === 'production' && (
            <div className="text-muted-foreground text-xs">
              提示：退货结算相关退款不会直接影响权责利润；清理测试数据会通过作废/冲销保证往来台账可追溯。
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onConfirmTextChange('')}>
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isExecuting || confirmText.trim() !== confirmWord}
            onClick={onExecute}
          >
            {isExecuting ? '执行中...' : '确认执行'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface DataManagementSwitchModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  switchTargetMode: SystemMode;
  switchConfirmWord: string;
  switchConfirmText: string;
  onSwitchConfirmTextChange: (value: string) => void;
  isSwitching: boolean;
  onSwitch: () => void;
}

export function DataManagementSwitchModeDialog({
  open,
  onOpenChange,
  switchTargetMode,
  switchConfirmWord,
  switchConfirmText,
  onSwitchConfirmTextChange,
  isSwitching,
  onSwitch,
}: DataManagementSwitchModeDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={nextOpen => {
        onOpenChange(nextOpen);
        if (!nextOpen) onSwitchConfirmTextChange('');
      }}
    >
      <AlertDialogContent className="max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>切换账套模式</AlertDialogTitle>
          <AlertDialogDescription>
            该操作仅管理员可执行。本操作不可撤销。请输入“{switchConfirmWord}
            ”以继续。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <div className="text-muted-foreground text-sm">
            目标模式：
            <Badge
              variant={switchTargetMode === 'trial' ? 'secondary' : 'default'}
              className="ml-2"
            >
              {switchTargetMode === 'trial' ? '试用' : '正式'}
            </Badge>
          </div>
          <Input
            value={switchConfirmText}
            onChange={e => onSwitchConfirmTextChange(e.target.value)}
            placeholder={`请输入：${switchConfirmWord}`}
          />
          <div className="text-muted-foreground text-xs">
            提示：切换后页面会自动更新，账套状态通常会在约 5 秒内生效。
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            disabled={
              isSwitching || switchConfirmText.trim() !== switchConfirmWord
            }
            onClick={onSwitch}
          >
            {isSwitching ? '切换中...' : '确认切换'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
