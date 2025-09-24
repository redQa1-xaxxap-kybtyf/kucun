'use client';

import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { UserManagementUser } from '@/lib/types/settings';

import { UserActions } from './UserActions';

interface UserManagementTableProps {
  users: UserManagementUser[];
  currentUserId: string;
  onEdit: (user: UserManagementUser) => void;
  onDelete: (userId: string) => void;
  onToggleStatus: (userId: string, status: 'active' | 'inactive') => void;
  onResetPassword: (userId: string, newPassword: string) => void;
  isLoading?: boolean;
}

export const UserManagementTable: React.FC<UserManagementTableProps> = ({
  users,
  currentUserId,
  onEdit,
  onDelete,
  onToggleStatus,
  onResetPassword,
  isLoading = false,
}) => {
  // 格式化日期
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'yyyy-MM-dd HH:mm', {
        locale: zhCN,
      });
    } catch {
      return dateString;
    }
  };

  // 获取角色显示文本
  const getRoleText = (role: string) => role === 'admin' ? '管理员' : '销售员';

  // 获取角色徽章样式
  const getRoleBadgeVariant = (role: string) => role === 'admin' ? 'destructive' : 'secondary';

  // 获取状态显示文本
  const getStatusText = (status: string) => status === 'active' ? '启用' : '禁用';

  // 获取状态徽章样式
  const getStatusBadgeVariant = (status: string) => status === 'active' ? 'default' : 'outline';

  if (users.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        暂无用户数据
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>用户名</TableHead>
            <TableHead>邮箱</TableHead>
            <TableHead>姓名</TableHead>
            <TableHead>角色</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>创建时间</TableHead>
            <TableHead>更新时间</TableHead>
            <TableHead className="w-[70px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">
                {user.username}
                {user.id === currentUserId && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    当前用户
                  </Badge>
                )}
              </TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.name}</TableCell>
              <TableCell>
                <Badge variant={getRoleBadgeVariant(user.role)}>
                  {getRoleText(user.role)}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={getStatusBadgeVariant(user.status)}>
                  {getStatusText(user.status)}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(user.createdAt)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(user.updatedAt)}
              </TableCell>
              <TableCell>
                <UserActions
                  user={user}
                  currentUserId={currentUserId}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleStatus={onToggleStatus}
                  onResetPassword={onResetPassword}
                  isLoading={isLoading}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
