'use client';

/**
 * @deprecated 已完全废弃并清理 - 导航徽章功能已移除
 *
 * 原因：
 * 1. 性能问题：徽章轮询导致菜单切换缓慢
 * 2. 用户体验：频繁请求影响系统性能
 * 3. 功能冗余：通知中心已提供类似功能
 *
 * 如果需要类似功能，请考虑：
 * 1. 使用 WebSocket 实时推送
 * 2. 在特定页面内部显示统计数据
 * 3. 优化通知中心功能
 *
 * 此文件已被清空，仅保留空实现以避免编译错误
 */

// 空实现：避免编译错误

/**
 * @deprecated 已废弃 - 返回空数据
 */
export function useNavigationBadges() {
  return {
    badgeData: [],
    isLoading: false,
    error: null,
    refetch: () => Promise.resolve(),
    addBadgesToNavItems: <T>(navItems: T[]) => navItems,
    getBadgeForNavItem: () => undefined,
    getTotalBadgeCount: () => 0,
    getUrgentBadgeCount: () => 0,
  };
}

/**
 * @deprecated 已废弃 - 返回空方法
 */
export function useNavigationBadgeUpdater() {
  return {
    updateBadge: async () => true,
    clearBadge: async () => true,
    incrementBadge: async () => true,
    decrementBadge: async () => true,
  };
}
