'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { Loader2, Save, X } from 'lucide-react';
import React from 'react';
import { useForm } from 'react-hook-form';

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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { UserManagementUser } from '@/lib/types/settings';
import { UserFormSchema, type UserFormData } from '@/lib/validations/settings';

interface UserFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  user?: UserManagementUser;
  onSubmit: (data: UserFormData) => void;
  isLoading?: boolean;
}

// 表单字段组件
const UserFormFields: React.FC<{
  form: ReturnType<typeof useForm<UserFormData>>;
  mode: 'create' | 'edit';
  isLoading: boolean;
}> = ({ form, mode, isLoading }) => (
  <div className="grid gap-4">
    {/* 用户名 */}
    <FormField
      control={form.control}
      name="username"
      render={({ field }) => (
        <FormItem>
          <FormLabel>用户名 *</FormLabel>
          <FormControl>
            <Input {...field} placeholder="请输入用户名" disabled={isLoading} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />

    {/* 邮箱 */}
    <FormField
      control={form.control}
      name="email"
      render={({ field }) => (
        <FormItem>
          <FormLabel>邮箱 *</FormLabel>
          <FormControl>
            <Input
              {...field}
              type="email"
              placeholder="请输入邮箱地址"
              disabled={isLoading}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />

    {/* 姓名 */}
    <FormField
      control={form.control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormLabel>姓名 *</FormLabel>
          <FormControl>
            <Input
              {...field}
              placeholder="请输入真实姓名"
              disabled={isLoading}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />

    {/* 密码 - 仅在创建模式下显示 */}
    {mode === 'create' && (
      <FormField
        control={form.control}
        name="password"
        render={({ field }) => (
          <FormItem>
            <FormLabel>密码 *</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="password"
                placeholder="请输入密码（至少6位）"
                disabled={isLoading}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    )}

    {/* 角色 */}
    <FormField
      control={form.control}
      name="role"
      render={({ field }) => (
        <FormItem>
          <FormLabel>角色 *</FormLabel>
          <Select
            onValueChange={field.onChange}
            defaultValue={field.value}
            disabled={isLoading}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="选择用户角色" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value="admin">管理员</SelectItem>
              <SelectItem value="sales">销售员</SelectItem>
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  </div>
);

export const UserForm: React.FC<UserFormProps> = ({
  open,
  onOpenChange,
  mode,
  user,
  onSubmit,
  isLoading = false,
}) => {
  // ✅ 表单配置 - 使用统一的表单Schema,避免联合类型
  const form = useForm<UserFormData>({
    resolver: standardSchemaResolver(UserFormSchema),
    mode: 'onBlur', // ✅ 用户离开字段时验证
    reValidateMode: 'onChange', // ✅ 提交后实时验证
    criteriaMode: 'all', // ✅ 显示所有错误
    shouldFocusError: true,
    defaultValues:
      mode === 'create'
        ? {
            userId: undefined,
            username: '',
            email: '',
            name: '',
            password: '',
            role: 'sales',
          }
        : {
            userId: user?.id || '',
            username: user?.username || '',
            email: user?.email || '',
            name: user?.name || '',
            password: '', // 编辑模式下密码为空,表示不修改密码
            role: user?.role || 'sales',
          },
  });

  // 重置表单
  React.useEffect(() => {
    if (open) {
      if (mode === 'create') {
        form.reset({
          userId: undefined,
          username: '',
          email: '',
          name: '',
          password: '',
          role: 'sales',
        });
      } else if (user) {
        form.reset({
          userId: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          password: '', // 编辑模式下密码为空,表示不修改密码
          role: user.role,
        });
      }
    }
  }, [open, mode, user, form]);

  // 表单提交处理
  const handleSubmit = (data: UserFormData) => {
    onSubmit(data);
  };

  // 关闭对话框
  const handleClose = () => {
    if (!isLoading) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? '新增用户' : '编辑用户'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? '创建新的用户账户，请填写完整的用户信息。'
              : '修改用户信息，密码不会被更改。'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data: any) =>
              handleSubmit(data as UserFormData)
            )}
            className="space-y-4"
          >
            <UserFormFields form={form} mode={mode} isLoading={isLoading} />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                <X className="mr-2 h-4 w-4" />
                取消
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {mode === 'create' ? '创建用户' : '保存更改'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
