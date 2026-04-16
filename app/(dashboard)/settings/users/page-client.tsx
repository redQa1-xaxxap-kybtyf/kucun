/**
 * 用户管理设置页面
 * 严格遵循全栈项目统一约定规范
 * ✅ 符合产品模块UI风格规范
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import React from 'react';

import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { getCsrfTokenHeader } from '@/lib/utils/csrf';
import { getFriendlyErrorMessage } from '@/lib/utils/user-friendly-error';
import type { UserFormData } from '@/lib/validations/settings';

const UserManagementTable = dynamic(
  () =>
    import('@/components/settings/UserManagementTable').then(
      mod => mod.UserManagementTable
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 items-center justify-center bg-slate-50/30">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-3 font-medium text-slate-500">表格加载中...</span>
      </div>
    ),
  }
);

const UserForm = dynamic(
  () => import('@/components/settings/UserForm').then(mod => mod.UserForm),
  { ssr: false, loading: () => null }
);

interface UsersSettingsPageClientProps {
  currentUserId: string;
  isAdmin: boolean;
}

export default function UsersSettingsPageClient({
  currentUserId,
  isAdmin,
}: UsersSettingsPageClientProps) {
  const router = useRouter();
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
    enabled: isAdmin,
  });

  // 创建用户
  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserRequest) => {
      const response = await fetch(
        '/api/settings/users',
        getCsrfTokenHeader({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '创建用户失败');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '新增成功',
        description: '成员账号已创建',
        variant: 'success',
      });
      setUserFormOpen(false);
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户创建后立即看到新记录
      queryClient.refetchQueries({
        queryKey: queryKeys.users.all,
        type: 'active',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '创建失败',
        description: getFriendlyErrorMessage(
          error,
          '成员账号暂时无法创建，请稍后重试'
        ),
        variant: 'destructive',
      });
    },
  });

  // 更新用户
  const updateUserMutation = useMutation({
    mutationFn: async (data: UpdateUserRequest & { userId: string }) => {
      const response = await fetch(
        '/api/settings/users',
        getCsrfTokenHeader({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '更新用户失败');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '保存成功',
        description: '成员资料已更新',
        variant: 'success',
      });
      setUserFormOpen(false);
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户更新后立即看到变化
      queryClient.refetchQueries({
        queryKey: queryKeys.users.all,
        type: 'active',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '更新失败',
        description: getFriendlyErrorMessage(
          error,
          '成员资料暂时无法更新，请稍后重试'
        ),
        variant: 'destructive',
      });
    },
  });

  // 删除用户
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(
        '/api/settings/users',
        getCsrfTokenHeader({
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        })
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '删除用户失败');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '删除成功',
        description: '成员账号已删除',
        variant: 'success',
      });
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户删除后立即看到变化
      queryClient.refetchQueries({
        queryKey: queryKeys.users.all,
        type: 'active',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '删除失败',
        description: getFriendlyErrorMessage(
          error,
          '成员账号暂时无法删除，请稍后重试'
        ),
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
      const response = await fetch(
        '/api/settings/users',
        getCsrfTokenHeader({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, status }),
        })
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '更新用户状态失败');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '状态已更新',
        description: '成员状态已调整',
        variant: 'success',
      });
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户状态更新后立即看到变化
      queryClient.refetchQueries({
        queryKey: queryKeys.users.all,
        type: 'active',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '状态更新失败',
        description: getFriendlyErrorMessage(
          error,
          '成员状态暂时无法更新，请稍后重试'
        ),
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
      const response = await fetch(
        '/api/settings/users/reset-password',
        getCsrfTokenHeader({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, newPassword }),
        })
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '重置密码失败');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '重置成功',
        description: '登录密码已更新',
        variant: 'success',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '重置失败',
        description: getFriendlyErrorMessage(
          error,
          '密码暂时无法重置，请稍后重试'
        ),
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

  const handleFormSubmit = (data: UserFormData) => {
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
  if (!isAdmin) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center space-y-4 p-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-rose-100 bg-rose-50 text-rose-500 shadow-sm">
          <Users className="h-10 w-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black text-slate-900">权限受限</h2>
          <p className="text-sm font-medium text-slate-500">
            只有管理员可以查看和管理成员账号。
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push('/settings')}
          className="mt-4 h-11 px-8 font-bold text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> 返回工作区
        </Button>
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
    <SettingsLayout
      title="成员与权限"
      description="管理成员账号、角色分配和启用状态，方便团队日常使用。"
    >
      <div className="flex-1 space-y-6 pb-20">
        {/* 用户管理主体卡片 */}
        <Card className="overflow-hidden border-slate-200/60 shadow-sm">
          <CardContent className="space-y-6 p-8">
            {/* 操作栏 */}
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 flex-wrap items-center gap-3">
                <div className="relative min-w-[300px] flex-1">
                  <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="搜索账号、姓名或邮箱..."
                    value={searchTerm}
                    onChange={e => handleSearch(e.target.value)}
                    className="h-12 border-slate-200 bg-slate-50/50 pl-11 font-medium focus-visible:ring-blue-500"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={e => handleRoleFilter(e.target.value)}
                  className="ring-offset-background h-12 w-[140px] rounded-md border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="角色"
                >
                  <option value="all">全部角色</option>
                  <option value="admin">管理员</option>
                  <option value="sales">业务成员</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={e => handleStatusFilter(e.target.value)}
                  className="ring-offset-background h-12 w-[140px] rounded-md border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="状态"
                >
                  <option value="all">全部状态</option>
                  <option value="active">正常使用</option>
                  <option value="inactive">已停用</option>
                </select>
              </div>
              <Button
                size="lg"
                onClick={handleCreateUser}
                disabled={isLoading || isAnyMutationLoading}
                className="h-12 bg-slate-900 px-8 font-bold shadow-md hover:bg-slate-800"
              >
                <Plus className="mr-2 h-5 w-5" />
                新增账号
              </Button>
            </div>

            {/* 用户列表 */}
            <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
              {isLoading ? (
                <div className="flex h-64 items-center justify-center bg-slate-50/30">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <span className="ml-3 font-medium text-slate-500">
                    正在加载成员资料...
                  </span>
                </div>
              ) : error ? (
                <div className="text-muted-foreground flex h-64 flex-col items-center justify-center bg-slate-50/30">
                  <p className="font-medium text-rose-500">
                    暂时无法加载成员列表
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {getFriendlyErrorMessage(error, '请稍后重试')}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => refetch()}
                    className="mt-4"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    重新尝试
                  </Button>
                </div>
              ) : (
                <UserManagementTable
                  users={userListData?.users || []}
                  currentUserId={currentUserId}
                  onEdit={handleEditUser}
                  onDelete={handleDeleteUser}
                  onToggleStatus={handleToggleStatus}
                  onResetPassword={handleResetPassword}
                  isLoading={isAnyMutationLoading}
                />
              )}
            </div>

            {/* 分页信息 */}
            {userListData && userListData.total > 0 && (
              <div className="flex items-center justify-between px-1 py-2">
                <div className="text-xs font-medium text-slate-400">
                  显示第 {(userListData.page - 1) * userListData.limit + 1} 到{' '}
                  {Math.min(
                    userListData.page * userListData.limit,
                    userListData.total
                  )}{' '}
                  / 共{' '}
                  <span className="text-slate-900">{userListData.total}</span>{' '}
                  位成员
                </div>
                <div className="text-xs font-bold text-slate-500 tabular-nums">
                  第 {userListData.page} / {userListData.totalPages} 页
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 用户表单对话框 */}
        {userFormOpen && (
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
        )}
      </div>
    </SettingsLayout>
  );
}
