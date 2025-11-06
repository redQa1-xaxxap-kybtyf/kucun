/**
 * 用户管理设置页面
 * 严格遵循全栈项目统一约定规范
 * ✅ 符合产品模块UI风格规范
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Plus, Search, Users } from 'lucide-react';
import { useSession } from 'next-auth/react';

import { UserForm } from '@/components/settings/UserForm';
import { UserManagementTable } from '@/components/settings/UserManagementTable';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { queryKeys } from '@/lib/queryKeys';
import type {
  CreateUserRequest,
  SettingsApiResponse,
  UpdateUserRequest,
  UserListQuery,
  UserListResponse,
  UserManagementUser,
} from '@/lib/types/settings';

export default function UsersSettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 状态管理
  const [searchTerm, setSearchTerm] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [userFormOpen, setUserFormOpen] = React.useState(false);
  const [formMode, setFormMode] = React.useState<'create' | 'edit'>('create');
  const [selectedUser, setSelectedUser] = React.useState<
    UserManagementUser | undefined
  >();

  // 构建查询参数
  const queryParams: UserListQuery = {
    page: currentPage,
    limit: 10,
    ...(searchTerm && { search: searchTerm }),
    ...(roleFilter &&
      roleFilter !== 'all' && { role: roleFilter as 'admin' | 'sales' }),
    ...(statusFilter &&
      statusFilter !== 'all' && {
        status: statusFilter as 'active' | 'inactive',
      }),
  };

  // 获取用户列表
  const {
    data: userListData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.users.list(queryParams),
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, value.toString());
        }
      });

      const response = await fetch(`/api/settings/users?${params}`);
      if (!response.ok) {
        throw new Error('获取用户列表失败');
      }
      const result: SettingsApiResponse<UserListResponse> =
        await response.json();
      if (!result.success) {
        throw new Error(result.error || '获取用户列表失败');
      }
      if (!result.data) {
        throw new Error('获取用户列表失败：返回数据为空');
      }
      return result.data;
    },
  });

  // 创建用户
  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserRequest) => {
      const response = await fetch('/api/settings/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '创建用户失败');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '成功',
        description: '用户创建成功',
        variant: 'success',
      });
      setUserFormOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
    onError: (error: Error) => {
      toast({
        title: '创建失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // 更新用户
  const updateUserMutation = useMutation({
    mutationFn: async (data: UpdateUserRequest & { userId: string }) => {
      const response = await fetch('/api/settings/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '更新用户失败');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '成功',
        description: '用户更新成功',
        variant: 'success',
      });
      setUserFormOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
    onError: (error: Error) => {
      toast({
        title: '更新失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // 删除用户
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch('/api/settings/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '删除用户失败');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '成功',
        description: '用户删除成功',
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
    onError: (error: Error) => {
      toast({
        title: '删除失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // 切换用户状态
  const toggleStatusMutation = useMutation({
    mutationFn: async ({
      userId,
      status,
    }: {
      userId: string;
      status: 'active' | 'inactive';
    }) => {
      const response = await fetch('/api/settings/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '更新用户状态失败');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '成功',
        description: '用户状态更新成功',
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
    onError: (error: Error) => {
      toast({
        title: '状态更新失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // 重置密码
  const resetPasswordMutation = useMutation({
    mutationFn: async ({
      userId,
      newPassword,
    }: {
      userId: string;
      newPassword: string;
    }) => {
      const response = await fetch('/api/settings/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newPassword }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '重置密码失败');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '成功',
        description: '密码重置成功',
        variant: 'success',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '重置失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // 事件处理函数
  const handleCreateUser = () => {
    setFormMode('create');
    setSelectedUser(undefined);
    setUserFormOpen(true);
  };

  const handleEditUser = (user: UserManagementUser) => {
    setFormMode('edit');
    setSelectedUser(user);
    setUserFormOpen(true);
  };

  const handleDeleteUser = (userId: string) => {
    deleteUserMutation.mutate(userId);
  };

  const handleToggleStatus = (
    userId: string,
    status: 'active' | 'inactive'
  ) => {
    toggleStatusMutation.mutate({ userId, status });
  };

  const handleResetPassword = (userId: string, newPassword: string) => {
    resetPasswordMutation.mutate({ userId, newPassword });
  };

  const handleFormSubmit = (
    data: CreateUserRequest | (UpdateUserRequest & { userId: string })
  ) => {
    if (formMode === 'create') {
      createUserMutation.mutate(data as CreateUserRequest);
    } else {
      updateUserMutation.mutate(data as UpdateUserRequest & { userId: string });
    }
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleRoleFilter = (value: string) => {
    setRoleFilter(value);
    setCurrentPage(1);
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  // 检查权限
  if (session?.user?.role !== 'admin') {
    return (
      <div className="flex h-full flex-col overflow-hidden p-6">
        <div className="flex-1 space-y-6 overflow-y-auto">
          {/* 页面头部 */}
          <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
            <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-600 shadow-lg shadow-gray-600/30">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                      用户管理
                    </h1>
                    <p className="text-sm text-gray-600">
                      管理系统用户账户和权限
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

          <Card className="border-amber-200 bg-amber-50 shadow-lg shadow-amber-200/50">
            <CardHeader>
              <CardTitle className="flex items-center text-amber-800">
                <Users className="mr-2 h-5 w-5" />
                权限不足
              </CardTitle>
              <CardDescription className="text-amber-700">
                只有管理员可以访问用户管理功能。
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  const isAnyMutationLoading =
    createUserMutation.isPending ||
    updateUserMutation.isPending ||
    deleteUserMutation.isPending ||
    toggleStatusMutation.isPending ||
    resetPasswordMutation.isPending;

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="flex-1 space-y-6 overflow-y-auto">
        {/* 页面头部 */}
        <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
          <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-600 shadow-lg shadow-gray-600/30">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    用户管理
                  </h1>
                  <p className="text-sm text-gray-600">
                    管理系统用户账户和权限
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

        {/* 用户管理卡片 */}
        <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
          <CardContent className="space-y-6 p-6">
            {/* 操作栏 */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 items-center space-x-2">
                <div className="relative max-w-sm flex-1">
                  <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
                  <Input
                    placeholder="搜索用户名、邮箱或姓名..."
                    value={searchTerm}
                    onChange={e => handleSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select value={roleFilter} onValueChange={handleRoleFilter}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="角色" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部角色</SelectItem>
                    <SelectItem value="admin">管理员</SelectItem>
                    <SelectItem value="sales">销售员</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={handleStatusFilter}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="active">启用</SelectItem>
                    <SelectItem value="inactive">禁用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleCreateUser}
                disabled={isLoading || isAnyMutationLoading}
              >
                <Plus className="mr-2 h-4 w-4" />
                新增用户
              </Button>
            </div>

            {/* 用户列表 */}
            {isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">加载中...</span>
              </div>
            ) : error ? (
              <div className="text-muted-foreground flex h-32 flex-col items-center justify-center">
                <p>加载用户列表失败</p>
                <Button
                  variant="outline"
                  onClick={() => refetch()}
                  className="mt-2"
                >
                  重试
                </Button>
              </div>
            ) : (
              <UserManagementTable
                users={userListData?.users || []}
                currentUserId={session?.user?.id || ''}
                onEdit={handleEditUser}
                onDelete={handleDeleteUser}
                onToggleStatus={handleToggleStatus}
                onResetPassword={handleResetPassword}
                isLoading={isAnyMutationLoading}
              />
            )}

            {/* 分页信息 */}
            {userListData && userListData.total > 0 && (
              <div className="text-muted-foreground flex items-center justify-between text-sm">
                <div>
                  显示第 {(userListData.page - 1) * userListData.limit + 1} 到{' '}
                  {Math.min(
                    userListData.page * userListData.limit,
                    userListData.total
                  )}{' '}
                  条， 共 {userListData.total} 条记录
                </div>
                <div>
                  第 {userListData.page} 页，共 {userListData.totalPages} 页
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 用户表单对话框 */}
        <UserForm
          open={userFormOpen}
          onOpenChange={setUserFormOpen}
          mode={formMode}
          user={selectedUser}
          onSubmit={handleFormSubmit}
          isLoading={
            createUserMutation.isPending || updateUserMutation.isPending
          }
        />
      </div>
    </div>
  );
}
