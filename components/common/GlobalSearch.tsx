'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Search,
  Package,
  ShoppingCart,
  Users,
  FileText,
  Clock,
  TrendingUp
} from 'lucide-react'

/**
 * 搜索结果项类型
 */
interface SearchResultItem {
  id: string
  title: string
  description?: string
  type: 'product' | 'order' | 'customer' | 'document'
  href: string
  metadata?: Record<string, any>
}

/**
 * 搜索建议类型
 */
interface SearchSuggestion {
  id: string
  text: string
  type: 'recent' | 'popular' | 'suggestion'
}

interface GlobalSearchProps {
  /** 是否打开 */
  open: boolean
  /** 打开状态变化回调 */
  onOpenChange: (open: boolean) => void
  /** 搜索回调 */
  onSearch?: (query: string) => void
}

/**
 * 模拟搜索数据
 */
const mockSearchResults: SearchResultItem[] = [
  {
    id: '1',
    title: '白色瓷砖 W001',
    description: '规格: 600x600mm, 库存: 120片',
    type: 'product',
    href: '/products/1',
    metadata: { stock: 120, price: 45.00 }
  },
  {
    id: '2',
    title: '销售订单 #SO-2024-001',
    description: '客户: 张三装饰公司, 金额: ¥12,500',
    type: 'order',
    href: '/sales-orders/2',
    metadata: { amount: 12500, status: 'confirmed' }
  },
  {
    id: '3',
    title: '张三装饰公司',
    description: '联系人: 张三, 电话: 138****1234',
    type: 'customer',
    href: '/customers/3',
    metadata: { phone: '138****1234' }
  }
]

const mockSuggestions: SearchSuggestion[] = [
  { id: '1', text: '白色瓷砖', type: 'recent' },
  { id: '2', text: '销售订单', type: 'recent' },
  { id: '3', text: '库存不足', type: 'popular' },
  { id: '4', text: '待发货订单', type: 'popular' },
]

/**
 * 全局搜索对话框组件
 * 提供全局搜索功能，支持产品、订单、客户等多种类型的搜索
 */
export function GlobalSearch({ open, onOpenChange, onSearch }: GlobalSearchProps) {
  const router = useRouter()
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<SearchResultItem[]>([])
  const [suggestions, setSuggestions] = React.useState<SearchSuggestion[]>(mockSuggestions)
  const [isLoading, setIsLoading] = React.useState(false)
  const [selectedIndex, setSelectedIndex] = React.useState(-1)

  // 搜索输入框引用
  const inputRef = React.useRef<HTMLInputElement>(null)

  // 搜索函数
  const performSearch = React.useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    setIsLoading(true)
    
    // 模拟API调用延迟
    await new Promise(resolve => setTimeout(resolve, 300))
    
    // 模拟搜索结果过滤
    const filteredResults = mockSearchResults.filter(item =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    
    setResults(filteredResults)
    setIsLoading(false)
  }, [])

  // 防抖搜索
  React.useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, performSearch])

  // 处理搜索结果选择
  const handleResultSelect = (item: SearchResultItem) => {
    router.push(item.href)
    onOpenChange(false)
    setQuery('')
    onSearch?.(query)
  }

  // 处理建议选择
  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.text)
    inputRef.current?.focus()
  }

  // 键盘导航
  const handleKeyDown = (event: React.KeyboardEvent) => {
    const totalItems = results.length + suggestions.length
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setSelectedIndex(prev => (prev + 1) % totalItems)
        break
      case 'ArrowUp':
        event.preventDefault()
        setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems)
        break
      case 'Enter':
        event.preventDefault()
        if (selectedIndex >= 0) {
          if (selectedIndex < results.length) {
            handleResultSelect(results[selectedIndex])
          } else {
            const suggestionIndex = selectedIndex - results.length
            handleSuggestionSelect(suggestions[suggestionIndex])
          }
        } else if (query.trim()) {
          // 直接搜索
          router.push(`/search?q=${encodeURIComponent(query)}`)
          onOpenChange(false)
          onSearch?.(query)
        }
        break
      case 'Escape':
        onOpenChange(false)
        break
    }
  }

  // 重置状态当对话框关闭时
  React.useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setSelectedIndex(-1)
    } else {
      // 对话框打开时聚焦输入框
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  // 获取类型图标
  const getTypeIcon = (type: SearchResultItem['type']) => {
    switch (type) {
      case 'product':
        return <Package className="h-4 w-4" />
      case 'order':
        return <ShoppingCart className="h-4 w-4" />
      case 'customer':
        return <Users className="h-4 w-4" />
      case 'document':
        return <FileText className="h-4 w-4" />
      default:
        return <Search className="h-4 w-4" />
    }
  }

  // 获取类型标签
  const getTypeLabel = (type: SearchResultItem['type']) => {
    switch (type) {
      case 'product':
        return '产品'
      case 'order':
        return '订单'
      case 'customer':
        return '客户'
      case 'document':
        return '文档'
      default:
        return '其他'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="sr-only">全局搜索</DialogTitle>
        </DialogHeader>
        
        {/* 搜索输入框 */}
        <div className="relative px-6">
          <Search className="absolute left-9 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="search"
            placeholder="搜索产品、订单、客户..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10 h-12 text-base border-0 border-b rounded-none focus-visible:ring-0 focus-visible:border-primary"
          />
        </div>

        {/* 搜索结果 */}
        <ScrollArea className="max-h-96">
          <div className="px-6 pb-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : query.trim() ? (
              results.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">搜索结果</h3>
                  {results.map((item, index) => (
                    <Button
                      key={item.id}
                      variant="ghost"
                      className={cn(
                        'w-full justify-start h-auto p-3 text-left',
                        selectedIndex === index && 'bg-accent'
                      )}
                      onClick={() => handleResultSelect(item)}
                    >
                      <div className="flex items-start space-x-3 w-full">
                        <div className="mt-0.5 text-muted-foreground">
                          {getTypeIcon(item.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className="font-medium truncate">{item.title}</p>
                            <Badge variant="outline" className="text-xs">
                              {getTypeLabel(item.type)}
                            </Badge>
                          </div>
                          {item.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">未找到相关结果</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    尝试使用不同的关键词
                  </p>
                </div>
              )
            ) : (
              <div className="space-y-4">
                {/* 最近搜索 */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    最近搜索
                  </h3>
                  <div className="space-y-1">
                    {suggestions.filter(s => s.type === 'recent').map((suggestion, index) => (
                      <Button
                        key={suggestion.id}
                        variant="ghost"
                        className={cn(
                          'w-full justify-start',
                          selectedIndex === results.length + index && 'bg-accent'
                        )}
                        onClick={() => handleSuggestionSelect(suggestion)}
                      >
                        <Clock className="h-4 w-4 mr-3 text-muted-foreground" />
                        {suggestion.text}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* 热门搜索 */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    热门搜索
                  </h3>
                  <div className="space-y-1">
                    {suggestions.filter(s => s.type === 'popular').map((suggestion, index) => {
                      const adjustedIndex = results.length + suggestions.filter(s => s.type === 'recent').length + index
                      return (
                        <Button
                          key={suggestion.id}
                          variant="ghost"
                          className={cn(
                            'w-full justify-start',
                            selectedIndex === adjustedIndex && 'bg-accent'
                          )}
                          onClick={() => handleSuggestionSelect(suggestion)}
                        >
                          <TrendingUp className="h-4 w-4 mr-3 text-muted-foreground" />
                          {suggestion.text}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* 底部提示 */}
        <div className="border-t px-6 py-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>使用 ↑↓ 导航，Enter 选择，Esc 关闭</span>
            <span>Ctrl+K 快速打开</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
