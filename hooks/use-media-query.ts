'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

import {
    BREAKPOINT_QUERIES,
    getDeviceType,
    type BreakpointQuery,
    type DeviceType,
} from '@/lib/utils/breakpoints';

// ============================================================================
// 核心 Hook
// ============================================================================

/**
 * 响应式媒体查询 Hook
 * 用于检测屏幕尺寸变化，支持移动端、平板端、桌面端适配
 *
 * @param query - CSS媒体查询字符串
 * @returns boolean - 是否匹配查询条件
 *
 * @example
 * const isMobile = useMediaQuery('(max-width: 767px)');
 * const isLandscape = useMediaQuery('(orientation: landscape)');
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // 检查是否在客户端环境
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(query);

    // 设置初始值
    setMatches(mediaQuery.matches);

    // 监听变化
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // 添加监听器
    mediaQuery.addEventListener('change', handler);

    // 清理函数
    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }, [query]);

  return matches;
}

/**
 * 使用预定义断点的 Hook
 * 
 * @example
 * const isMobile = useBreakpoint('mobile');
 * const isDesktop = useBreakpoint('desktop');
 * const isSmUp = useBreakpoint('sm');
 */
export function useBreakpoint(breakpoint: BreakpointQuery): boolean {
  return useMediaQuery(BREAKPOINT_QUERIES[breakpoint]);
}

// ============================================================================
// 预定义断点 Hooks（使用统一断点常量）
// ============================================================================

/** 移动端 (< 768px) */
export const useIsMobile = () => useMediaQuery(BREAKPOINT_QUERIES.mobile);

/** 平板端 (768px - 1023px) */
export const useIsTablet = () => useMediaQuery(BREAKPOINT_QUERIES.tablet);

/** 桌面端 (>= 1024px) */
export const useIsDesktop = () => useMediaQuery(BREAKPOINT_QUERIES.desktop);

/** 大屏幕 (>= 1280px) */
export const useIsLargeScreen = () => useMediaQuery(BREAKPOINT_QUERIES.largeScreen);

// ============================================================================
// 组合 Hooks
// ============================================================================

/**
 * 获取当前设备类型
 * 
 * @returns 'mobile' | 'tablet' | 'desktop' | 'largeScreen'
 */
export function useDeviceType(): DeviceType {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isLargeScreen = useIsLargeScreen();

  if (isMobile) return 'mobile';
  if (isTablet) return 'tablet';
  if (isLargeScreen) return 'largeScreen';
  return 'desktop';
}

/**
 * 获取当前窗口宽度（响应式）
 * 使用 useSyncExternalStore 避免 SSR 水合问题
 */
export function useWindowWidth(): number {
  const subscribe = (callback: () => void) => {
    window.addEventListener('resize', callback);
    return () => window.removeEventListener('resize', callback);
  };

  const getSnapshot = () => window.innerWidth;
  const getServerSnapshot = () => 1024; // SSR 默认值

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * 获取当前设备类型（基于窗口宽度）
 * 比多个 useMediaQuery 调用更高效
 */
export function useDeviceTypeByWidth(): DeviceType {
  const width = useWindowWidth();
  return getDeviceType(width);
}

// 重新导出断点相关工具
export { BREAKPOINT_QUERIES, BREAKPOINTS, getDeviceType } from '@/lib/utils/breakpoints';
export type { BreakpointKey, BreakpointQuery, DeviceType } from '@/lib/utils/breakpoints';

