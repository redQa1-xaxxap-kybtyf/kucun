'use client'

import { useQuery } from '@tanstack/react-query'
import type { NavigationItem } from '@/lib/types/layout'

/**
 * 导航徽章数据类型
 */
interface NavigationBadgeData {
  /** 导航项ID */
  navId: string
  /** 徽章文本 */
  badge?: string | number
  /** 徽章变体 */
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline'
}

/**
 * 模拟API数据获取函数
 * 实际项目中应该从真实API获取数据
 */
async function fetchNavigationBadges(): Promise<NavigationBadgeData[]> {
  // 模拟API延迟
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // 模拟返回数据
  return [
    {
      navId: 'sales-orders',
      badge: 3,
      badgeVariant: 'destructive', // 待处理订单用红色徽章
    },
    {
      navId: 'inventory',
      badge: 5,
      badgeVariant: 'destructive', // 库存预警用红色徽章
    },
    {
      navId: 'return-orders',
      badge: 1,
      badgeVariant: 'secondary', // 退货订单用灰色徽章
    },
    {
      navId: 'customers',
      badge: 2,
      badgeVariant: 'outline', // 待跟进客户用轮廓徽章
    },
  ]
}

/**
 * 导航徽章数据Hook
 * 用于获取和管理导航菜单项的徽章显示
 */
export function useNavigationBadges() {
  const {
    data: badgeData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['navigation-badges'],
    queryFn: fetchNavigationBadges,
    staleTime: 30 * 1000, // 30秒内数据保持新鲜
    gcTime: 5 * 60 * 1000, // 5分钟缓存时间
    refetchInterval: 60 * 1000, // 每分钟自动刷新
    refetchOnWindowFocus: true, // 窗口获得焦点时刷新
  })

  /**
   * 为导航项添加徽章数据
   */
  const addBadgesToNavItems = (navItems: NavigationItem[]): NavigationItem[] => {
    if (!badgeData) return navItems

    return navItems.map(item => {
      const badgeInfo = badgeData.find(badge => badge.navId === item.id)
      
      if (badgeInfo) {
        return {
          ...item,
          badge: badgeInfo.badge,
          badgeVariant: badgeInfo.badgeVariant,
        }
      }
      
      return item
    })
  }

  /**
   * 获取特定导航项的徽章信息
   */
  const getBadgeForNavItem = (navId: string): NavigationBadgeData | undefined => {
    return badgeData?.find(badge => badge.navId === navId)
  }

  /**
   * 获取总的未读/待处理数量
   */
  const getTotalBadgeCount = (): number => {
    if (!badgeData) return 0
    
    return badgeData.reduce((total, badge) => {
      const count = typeof badge.badge === 'number' ? badge.badge : 0
      return total + count
    }, 0)
  }

  /**
   * 获取紧急项目数量（红色徽章）
   */
  const getUrgentBadgeCount = (): number => {
    if (!badgeData) return 0
    
    return badgeData
      .filter(badge => badge.badgeVariant === 'destructive')
      .reduce((total, badge) => {
        const count = typeof badge.badge === 'number' ? badge.badge : 0
        return total + count
      }, 0)
  }

  return {
    /** 徽章数据 */
    badgeData,
    /** 是否正在加载 */
    isLoading,
    /** 错误信息 */
    error,
    /** 手动刷新 */
    refetch,
    /** 为导航项添加徽章 */
    addBadgesToNavItems,
    /** 获取特定导航项徽章 */
    getBadgeForNavItem,
    /** 获取总徽章数量 */
    getTotalBadgeCount,
    /** 获取紧急徽章数量 */
    getUrgentBadgeCount,
  }
}

/**
 * 导航项徽章更新Hook
 * 用于实时更新特定导航项的徽章
 */
export function useNavigationBadgeUpdater() {
  /**
   * 更新特定导航项的徽章
   * 实际项目中应该调用API更新服务器数据
   */
  const updateBadge = async (navId: string, badge?: string | number, variant?: NavigationBadgeData['badgeVariant']) => {
    // 这里应该调用API更新徽章数据
    console.log(`更新导航徽章: ${navId}`, { badge, variant })
    
    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // 实际项目中应该触发数据重新获取或使用乐观更新
    return true
  }

  /**
   * 清除特定导航项的徽章
   */
  const clearBadge = async (navId: string) => {
    return updateBadge(navId, undefined, undefined)
  }

  /**
   * 增加徽章数量
   */
  const incrementBadge = async (navId: string, increment: number = 1) => {
    // 实际项目中应该从当前数据中获取现有数量
    console.log(`增加导航徽章: ${navId} +${increment}`)
    await new Promise(resolve => setTimeout(resolve, 200))
    return true
  }

  /**
   * 减少徽章数量
   */
  const decrementBadge = async (navId: string, decrement: number = 1) => {
    console.log(`减少导航徽章: ${navId} -${decrement}`)
    await new Promise(resolve => setTimeout(resolve, 200))
    return true
  }

  return {
    updateBadge,
    clearBadge,
    incrementBadge,
    decrementBadge,
  }
}
