'use client';

import {
  Edit,
  Key,
  MoreHorizontal,
  Shield,
  ShieldOff,
  Trash2,
} from 'lucide-react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { UserManagementUser } from '@/lib/types/settings';

interface UserActionsProps {
  user: UserManagementUser;
  currentUserId: string;
  onEdit: (user: UserManagementUser) => void;
  onDelete: (userId: string) => void;
  onToggleStatus: (userId: string, status: 'active' | 'inactive') => void;
  onResetPassword: (userId: string, newPassword: string) => void;
  isLoading?: boolean;
}

export const UserActions: React.FC<UserActionsProps> = ({
  user,
  currentUserId,
  onEdit,
  onDelete,
  onToggleStatus,
  onResetPassword,
  isLoading = false,
}) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] =
    React.useState(false);
  const [newPassword, setNewPassword] = React.useState('');

  // 是否是当前用户
  const isCurrentUser = user.id === currentUserId;

  // 处理删除用户
  const handleDelete = () => {
    onDelete(user.id);
    setDeleteDialogOpen(false);
  };

  // 处理重置密码
  const handleResetPassword = () => {
    if (newPassword.trim()) {
      onResetPassword(user.id, newPassword);
      setNewPassword('');
      setResetPasswordDialogOpen(false);
    }
  };

  // 处理状态切换
  const handleToggleStatus = () => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    onToggleStatus(user.id, newStatus);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 w-8 p-0"
            disabled={isLoading}
          >
            <span className="sr-only">打开菜单</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* 编辑用户 */}
          <DropdownMenuItem onClick={() => onEdit(user)}>
            <Edit className="mr-2 h-4 w-4" />
            编辑用户
          </DropdownMenuItem>

          {/* 重置密码 */}
          <DropdownMenuItem
            onClick={() => setResetPasswordDialogOpen(true)}
          >
            <Key className="mr-2 h-4 w-4" />
            重置密码
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* 启用/禁用用户 */}
          {!isCurrentUser && (
            <DropdownMenuItem onClick={handleToggleStatus}>
              {user.status === 'active' ? (
                <>
                  <ShieldOff className="mr-2 h-4 w-4" />
                  禁用用户
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  启用用户
                </>
              )}
            </DropdownMenuItem>
          )}

          {/* 删除用户 */}
          {!isCurrentUser && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteDialogOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除用户
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除用户</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除用户 "{user.name}" 吗？此操作将禁用该用户账户，用户将无法登录系统。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 重置密码对话框 */}
      <Dialog
        open={resetPasswordDialogOpen}
        onOpenChange={setResetPasswordDialogOpen}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>重置用户密码</DialogTitle>
            <DialogDescription>
              为用户 "{user.name}" 设置新密码。新密码至少需要6个字符。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-password">新密码</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="请输入新密码（至少6位）"
                minLength={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setNewPassword('');
                setResetPasswordDialogOpen(false);
              }}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={handleResetPassword}
              disabled={!newPassword.trim() || newPassword.length < 6}
            >
              重置密码
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
