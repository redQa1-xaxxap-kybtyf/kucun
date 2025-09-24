/**
 * 布局系统集成测试
 * 测试认证布局系统的完整流程和响应式设计
 * 严格遵循全栈项目统一约定规范
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';
import React from 'react';

import { AuthLayout } from '@/components/common/AuthLayout';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { GlobalSearch } from '@/components/common/GlobalSearch';
import { Header } from '@/components/common/Header';
import { MobileNav } from '@/components/common/MobileNav';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(() => '/dashboard'),
}));

// Mock Next-Auth
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock media query hook
jest.mock('@/hooks/use-media-query', () => ({
  useMediaQuery: jest.fn(),
}));

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  replace: jest.fn(),
};

const mockSession = {
  user: {
    id: '1',
    name: '测试用户',
    email: 'test@example.com',
    username: 'testuser',
    role: 'admin',
    status: 'active',
    avatar: 'https://example.com/avatar.jpg',
  },
  expires: '2024-12-31',
};

describe('布局系统集成测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  describe('认证布局系统', () => {
    it('应该为已认证用户显示完整布局', async () => {
      const { useSession } = require('next-auth/react');
      useSession.mockReturnValue({
        data: mockSession,
        status: 'authenticated',
      });

      render(
        <SessionProvider session={mockSession}>
          <AuthLayout>
            <div>测试内容</div>
          </AuthLayout>
        </SessionProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('测试内容')).toBeInTheDocument();
      });
    });

    it('应该为未认证用户显示加载状态', () => {
      const { useSession } = require('next-auth/react');
      useSession.mockReturnValue({
        data: null,
        status: 'loading',
      });

      render(
        <SessionProvider session={null}>
          <AuthLayout>
            <div>测试内容</div>
          </AuthLayout>
        </SessionProvider>
      );

      expect(screen.getByText('正在加载...')).toBeInTheDocument();
    });

    it('应该重定向未认证用户', () => {
      const { useSession } = require('next-auth/react');
      useSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
      });

      render(
        <SessionProvider session={null}>
          <AuthLayout>
            <div>测试内容</div>
          </AuthLayout>
        </SessionProvider>
      );

      expect(mockRouter.push).toHaveBeenCalledWith(
        expect.stringContaining('/auth/signin')
      );
    });

    it('应该检查用户权限', () => {
      const { useSession } = require('next-auth/react');
      useSession.mockReturnValue({
        data: { ...mockSession, user: { ...mockSession.user, role: 'sales' } },
        status: 'authenticated',
      });

      render(
        <SessionProvider session={mockSession}>
          <AuthLayout requiredRoles={['admin']}>
            <div>管理员内容</div>
          </AuthLayout>
        </SessionProvider>
      );

      expect(mockRouter.push).toHaveBeenCalledWith(
        '/auth/error?error=AccessDenied'
      );
    });
  });

  describe('响应式设计测试', () => {
    it('应该在桌面端显示侧边栏', () => {
      const { useMediaQuery } = require('@/hooks/use-media-query');
      const { useSession } = require('next-auth/react');

      useMediaQuery.mockImplementation((query: string) => {
        if (query === '(max-width: 768px)') return false;
        if (query === '(min-width: 769px) and (max-width: 1024px)')
          return false;
        return true;
      });

      useSession.mockReturnValue({
        data: mockSession,
        status: 'authenticated',
      });

      render(
        <SessionProvider session={mockSession}>
          <DashboardLayout>
            <div>桌面端内容</div>
          </DashboardLayout>
        </SessionProvider>
      );

      // 侧边栏应该可见
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('应该在移动端显示抽屉菜单', () => {
      const { useMediaQuery } = require('@/hooks/use-media-query');
      const { useSession } = require('next-auth/react');

      useMediaQuery.mockImplementation((query: string) => {
        if (query === '(max-width: 768px)') return true;
        return false;
      });

      useSession.mockReturnValue({
        data: mockSession,
        status: 'authenticated',
      });

      render(
        <SessionProvider session={mockSession}>
          <DashboardLayout>
            <div>移动端内容</div>
          </DashboardLayout>
        </SessionProvider>
      );

      // 移动端菜单按钮应该存在
      const menuButton = screen.getByRole('button', { name: /menu/i });
      expect(menuButton).toBeInTheDocument();
    });

    it('应该在平板端显示折叠侧边栏', () => {
      const { useMediaQuery } = require('@/hooks/use-media-query');
      const { useSession } = require('next-auth/react');

      useMediaQuery.mockImplementation((query: string) => {
        if (query === '(max-width: 768px)') return false;
        if (query === '(min-width: 769px) and (max-width: 1024px)') return true;
        return false;
      });

      useSession.mockReturnValue({
        data: mockSession,
        status: 'authenticated',
      });

      render(
        <SessionProvider session={mockSession}>
          <DashboardLayout>
            <div>平板端内容</div>
          </DashboardLayout>
        </SessionProvider>
      );

      // 侧边栏应该是折叠状态
      const sidebar = screen.getByRole('navigation');
      expect(sidebar).toHaveClass('collapsed');
    });
  });

  describe('移动端手势操作测试', () => {
    it('应该支持滑动打开菜单', async () => {
      const { useMediaQuery } = require('@/hooks/use-media-query');
      const { useSession } = require('next-auth/react');

      useMediaQuery.mockReturnValue(true); // 移动端
      useSession.mockReturnValue({
        data: mockSession,
        status: 'authenticated',
      });

      render(
        <SessionProvider session={mockSession}>
          <DashboardLayout>
            <div data-testid="main-content">移动端内容</div>
          </DashboardLayout>
        </SessionProvider>
      );

      const mainContent = screen.getByTestId('main-content');

      // 模拟右滑手势
      fireEvent.touchStart(mainContent, {
        touches: [{ clientX: 10, clientY: 100 }],
      });

      fireEvent.touchMove(mainContent, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      fireEvent.touchEnd(mainContent, {
        changedTouches: [{ clientX: 100, clientY: 100 }],
      });

      await waitFor(() => {
        // 菜单应该打开
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('应该支持滑动关闭菜单', async () => {
      const mockOnOpenChange = jest.fn();

      render(<MobileNav open={true} onOpenChange={mockOnOpenChange} />);

      const drawer = screen.getByRole('dialog');

      // 模拟左滑手势
      fireEvent.touchStart(drawer, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      fireEvent.touchMove(drawer, {
        touches: [{ clientX: 10, clientY: 100 }],
      });

      fireEvent.touchEnd(drawer, {
        changedTouches: [{ clientX: 10, clientY: 100 }],
      });

      await waitFor(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });
    });
  });

  describe('全局搜索功能测试', () => {
    it('应该支持键盘快捷键打开搜索', () => {
      const { useSession } = require('next-auth/react');
      useSession.mockReturnValue({
        data: mockSession,
        status: 'authenticated',
      });

      render(
        <SessionProvider session={mockSession}>
          <AuthLayout enableGlobalSearch={true}>
            <div>内容</div>
          </AuthLayout>
        </SessionProvider>
      );

      // 模拟 Ctrl+K 快捷键
      fireEvent.keyDown(document, {
        key: 'k',
        ctrlKey: true,
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/搜索/)).toBeInTheDocument();
    });

    it('应该支持搜索结果导航', async () => {
      render(
        <GlobalSearch
          open={true}
          onOpenChange={jest.fn()}
          onSearch={jest.fn()}
        />
      );

      const searchInput = screen.getByRole('searchbox');

      // 输入搜索关键词
      fireEvent.change(searchInput, { target: { value: '白色瓷砖' } });

      await waitFor(() => {
        expect(screen.getByText('搜索结果')).toBeInTheDocument();
      });

      // 模拟方向键导航
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
      fireEvent.keyDown(searchInput, { key: 'Enter' });

      expect(mockRouter.push).toHaveBeenCalled();
    });
  });

  describe('面包屑导航测试', () => {
    it('应该自动生成面包屑', () => {
      const { usePathname } = require('next/navigation');
      usePathname.mockReturnValue('/products/create');

      const { Breadcrumb } = require('@/components/common/Breadcrumb');

      render(<Breadcrumb />);

      expect(screen.getByText('首页')).toBeInTheDocument();
      expect(screen.getByText('产品管理')).toBeInTheDocument();
      expect(screen.getByText('新建')).toBeInTheDocument();
    });

    it('应该支持自定义面包屑项', () => {
      const customItems = [
        { title: '自定义首页', href: '/' },
        { title: '自定义页面', isCurrent: true },
      ];

      const { Breadcrumb } = require('@/components/common/Breadcrumb');

      render(<Breadcrumb items={customItems} />);

      expect(screen.getByText('自定义首页')).toBeInTheDocument();
      expect(screen.getByText('自定义页面')).toBeInTheDocument();
    });
  });

  describe('主题切换测试', () => {
    it('应该支持主题切换', async () => {
      const { useSession } = require('next-auth/react');
      useSession.mockReturnValue({
        data: mockSession,
        status: 'authenticated',
      });

      render(
        <SessionProvider session={mockSession}>
          <Header />
        </SessionProvider>
      );

      // 打开用户菜单
      const userButton = screen.getByRole('button', { name: /用户菜单/i });
      fireEvent.click(userButton);

      // 点击主题切换
      const themeButton = screen.getByText('主题');
      fireEvent.click(themeButton);

      // 选择深色主题
      const darkTheme = screen.getByText('深色');
      fireEvent.click(darkTheme);

      await waitFor(() => {
        expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
      });
    });
  });
});
