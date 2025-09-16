'use client'

import { useState, useEffect } from 'react'
import { useMediaQuery } from './use-media-query'
import type { SidebarState } from '@/lib/types/layout'

/**
 * 侧边栏状态管理Hook
 * 提供侧边栏的展开/折叠状态管理，支持响应式自动调整
 * 
 * @param initialCollapsed - 初始折叠状态
 * @returns SidebarState - 侧边栏状态和操作方法
 */
export function useSidebar(initialCollapsed: boolean = false): SidebarState {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1024px)')
  
  const [isOpen, setIsOpen] = useState(!isMobile)
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed)

  // 响应式自动调整
  useEffect(() => {
    if (isMobile) {
      // 移动端：隐藏侧边栏，使用抽屉模式
      setIsOpen(false)
      setIsCollapsed(false)
    } else if (isTablet) {
      // 平板端：显示但折叠侧边栏
      setIsOpen(true)
      setIsCollapsed(true)
    } else {
      // 桌面端：显示完整侧边栏
      setIsOpen(true)
      // 保持用户设置的折叠状态
    }
  }, [isMobile, isTablet])

  // 切换展开/折叠状态
  const toggle = () => {
    if (isMobile) {
      // 移动端切换抽屉显示/隐藏
      setIsOpen(!isOpen)
    } else {
      // 桌面端和平板端切换折叠状态
      setIsCollapsed(!isCollapsed)
    }
  }

  // 设置展开状态
  const setOpen = (open: boolean) => {
    setIsOpen(open)
  }

  // 设置折叠状态
  const setCollapsed = (collapsed: boolean) => {
    if (!isMobile) {
      setIsCollapsed(collapsed)
    }
  }

  return {
    isOpen,
    isCollapsed,
    toggle,
    setOpen,
    setCollapsed,
  }
}

/**
 * 本地存储侧边栏状态Hook
 * 在useSidebar基础上增加本地存储功能，记住用户的偏好设置
 * 
 * @param storageKey - 本地存储键名
 * @param initialCollapsed - 初始折叠状态
 * @returns SidebarState - 侧边栏状态和操作方法
 */
export function useSidebarWithStorage(
  storageKey: string = 'sidebar-collapsed',
  initialCollapsed: boolean = false
): SidebarState {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1024px)')
  
  // 从本地存储读取初始状态
  const [isOpen, setIsOpen] = useState(!isMobile)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return initialCollapsed
    
    try {
      const stored = localStorage.getItem(storageKey)
      return stored ? JSON.parse(stored) : initialCollapsed
    } catch {
      return initialCollapsed
    }
  })

  // 响应式自动调整
  useEffect(() => {
    if (isMobile) {
      setIsOpen(false)
      setIsCollapsed(false)
    } else if (isTablet) {
      setIsOpen(true)
      // 平板端可以使用存储的折叠状态
    } else {
      setIsOpen(true)
      // 桌面端使用存储的折叠状态
    }
  }, [isMobile, isTablet])

  // 保存折叠状态到本地存储
  useEffect(() => {
    if (typeof window !== 'undefined' && !isMobile) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(isCollapsed))
      } catch (error) {
        console.warn('Failed to save sidebar state to localStorage:', error)
      }
    }
  }, [isCollapsed, storageKey, isMobile])

  const toggle = () => {
    if (isMobile) {
      setIsOpen(!isOpen)
    } else {
      setIsCollapsed(!isCollapsed)
    }
  }

  const setOpen = (open: boolean) => {
    setIsOpen(open)
  }

  const setCollapsed = (collapsed: boolean) => {
    if (!isMobile) {
      setIsCollapsed(collapsed)
    }
  }

  return {
    isOpen,
    isCollapsed,
    toggle,
    setOpen,
    setCollapsed,
  }
}

/**
 * 侧边栏键盘快捷键Hook
 * 为侧边栏添加键盘快捷键支持
 * 
 * @param sidebarState - 侧边栏状态
 * @param shortcutKey - 快捷键（默认为 'b'，配合 Ctrl/Cmd）
 */
export function useSidebarShortcut(
  sidebarState: SidebarState,
  shortcutKey: string = 'b'
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+B 或 Cmd+B 切换侧边栏
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === shortcutKey) {
        event.preventDefault()
        sidebarState.toggle()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [sidebarState, shortcutKey])
}
