/**
 * 统一的确认对话框组件
 *
 * 提供统一的确认对话框，包括：
 * - 标准的确认/取消按钮
 * - 可自定义的标题和描述
 * - 危险操作的警告样式
 * - 加载状态支持
 *
 * @see docs/DIALOG_GUIDE.md
 */

'use client';

import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import * as React from 'react';

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
import { logger } from '@/lib/utils/console-logger';

/**
 * 对话框变体
 */
export type ConfirmDialogVariant =
  | 'default'
  | 'destructive'
  | 'warning'
  | 'info';

/**
 * 确认对话框属性
 */
export interface ConfirmDialogProps {
  /**
   * 是否打开对话框
   */
  open: boolean;

  /**
   * 对话框关闭回调
   */
  onOpenChange: (open: boolean) => void;

  /**
   * 确认回调
   */
  onConfirm: () => void | Promise<void>;

  /**
   * 取消回调
   */
  onCancel?: () => void;

  /**
   * 对话框标题
   */
  title: string;

  /**
   * 对话框描述
   */
  description?: string;

  /**
   * 确认按钮文本
   * @default '确认'
   */
  confirmText?: string;

  /**
   * 取消按钮文本
   * @default '取消'
   */
  cancelText?: string;

  /**
   * 对话框变体
   * @default 'default'
   */
  variant?: ConfirmDialogVariant;

  /**
   * 是否正在加载
   * @default false
   */
  isLoading?: boolean;
}

/**
 * 获取变体图标
 */
function getVariantIcon(variant: ConfirmDialogVariant) {
  switch (variant) {
    case 'destructive':
      return <AlertCircle className="text-destructive h-5 w-5" />;
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case 'info':
      return <Info className="h-5 w-5 text-blue-500" />;
    default:
      return <CheckCircle className="h-5 w-5 text-green-500" />;
  }
}

/**
 * 确认对话框组件
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 *
 * <ConfirmDialog
 *   open={open}
 *   onOpenChange={setOpen}
 *   onConfirm={async () => {
 *     await deleteProduct(id);
 *   }}
 *   title="删除产品"
 *   description="确定要删除这个产品吗？此操作不可撤销。"
 *   variant="destructive"
 * />
 * ```
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'default',
  isLoading = false,
}: ConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = React.useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      // 错误由调用方处理
      logger.error('ui:confirm-dialog', 'Confirm dialog error', error);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const loading = isLoading || isConfirming;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            {getVariantIcon(variant)}
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={loading}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className={
              variant === 'destructive'
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : ''
            }
          >
            {loading ? '处理中...' : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * 使用确认对话框的 Hook
 *
 * @example
 * ```tsx
 * const { confirmDialog, confirm } = useConfirmDialog();
 *
 * const handleDelete = async () => {
 *   const confirmed = await confirm({
 *     title: '删除产品',
 *     description: '确定要删除这个产品吗？',
 *     variant: 'destructive',
 *   });
 *
 *   if (confirmed) {
 *     await deleteProduct(id);
 *   }
 * };
 *
 * return (
 *   <>
 *     <Button onClick={handleDelete}>删除</Button>
 *     {confirmDialog}
 *   </>
 * );
 * ```
 */
export function useConfirmDialog() {
  const [dialogState, setDialogState] = React.useState<{
    open: boolean;
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: ConfirmDialogVariant;
  }>({
    open: false,
    title: '',
  });
  const resolverRef = React.useRef<((value: boolean) => void) | undefined>();

  const confirm = React.useCallback(
    (
      options: Omit<ConfirmDialogProps, 'open' | 'onOpenChange' | 'onConfirm'>
    ) =>
      new Promise<boolean>(resolve => {
        resolverRef.current = resolve;
        setDialogState({
          open: true,
          title: options.title,
          description: options.description,
          confirmText: options.confirmText,
          cancelText: options.cancelText,
          variant: options.variant,
        });
      }),
    []
  );

  const closeDialog = React.useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = undefined;
    setDialogState(prev => ({ ...prev, open: false }));
  }, []);

  const handleConfirm = React.useCallback(() => {
    closeDialog(true);
  }, [closeDialog]);

  const handleCancel = React.useCallback(() => {
    closeDialog(false);
  }, [closeDialog]);

  const confirmDialog = (
    <ConfirmDialog
      open={dialogState.open}
      onOpenChange={open => {
        if (!open) {
          handleCancel();
        }
      }}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      title={dialogState.title}
      description={dialogState.description}
      confirmText={dialogState.confirmText}
      cancelText={dialogState.cancelText}
      variant={dialogState.variant}
    />
  );

  return {
    confirmDialog,
    confirm,
  };
}
