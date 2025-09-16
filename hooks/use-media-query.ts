'use client'

import { useEffect, useState } from 'react'

/**
 * 响应式媒体查询Hook
 * 用于检测屏幕尺寸变化，支持移动端、平板端、桌面端适配
 * 
 * @param query - CSS媒体查询字符串
 * @returns boolean - 是否匹配查询条件
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    // 检查是否在客户端环境
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia(query)
    
    // 设置初始值
    setMatches(mediaQuery.matches)

    // 监听变化
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    // 添加监听器
    mediaQuery.addEventListener('change', handler)

    // 清理函数
    return () => {
      mediaQuery.removeEventListener('change', handler)
    }
  }, [query])

  return matches
}

/**
 * 预定义的响应式断点Hooks
 */
export const useIsMobile = () => useMediaQuery('(max-width: 768px)')
export const useIsTablet = () => useMediaQuery('(min-width: 769px) and (max-width: 1024px)')
export const useIsDesktop = () => useMediaQuery('(min-width: 1025px)')
export const useIsLargeScreen = () => useMediaQuery('(min-width: 1440px)')

/**
 * 组合Hook：获取当前设备类型
 */
export function useDeviceType() {
  const isMobile = useIsMobile()
  const isTablet = useIsTablet()
  const isDesktop = useIsDesktop()
  const isLargeScreen = useIsLargeScreen()

  if (isMobile) return 'mobile'
  if (isTablet) return 'tablet'
  if (isLargeScreen) return 'large'
  if (isDesktop) return 'desktop'
  return 'desktop' // 默认值
}
