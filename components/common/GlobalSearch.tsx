'use client';

import {
  Clock,
  FileText,
  Package,
  Search,
  ShoppingCart,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

/**
 * 搜索结果项类型
 */
interface SearchResultItem {
  id: string;
  title: string;
  description?: string;
  type: 'product' | 'order' | 'customer' | 'document';
  href: string;
  metadata?: Record<string, any>;
}

/**
 * 搜索建议类型
 */
interface SearchSuggestion {
  id: string;
  text: string;
  type: 'recent' | 'popular' | 'suggestion';
}

interface GlobalSearchProps {
  /** 是否打开 */
  open: boolean;
  /** 打开状态变化回调 */
  onOpenChange: (open: boolean) => void;
  /** 搜索回调 */
  onSearch?: (query: string) => void;
}

/**
 * 搜索建议数据 - 可以从用户历史搜索或热门搜索中获取
 */
const getSearchSuggestions = (): SearchSuggestion[] => [
  { id: '1', text: '产品搜索', type: 'popular' },
  { id: '2', text: '销售订单', type: 'popular' },
  { id: '3', text: '库存查询', type: 'popular' },
  { id: '4', text: '客户管理', type: 'popular' },
];

/**
 * 全局搜索对话框组件
 * 提供全局搜索功能，支持产品、订单、客户等多种类型的搜索
 */
export function GlobalSearch({
  open,
  onOpenChange,
  onSearch,
}: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<SearchResultItem[]>([]);
  const [suggestions] = React.useState<SearchSuggestion[]>(
    getSearchSuggestions()
  );
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(-1);

  // 搜索输入框引用
  const inputRef = React.useRef<HTMLInputElement>(null);

  // 搜索函数
  const performSearch = React.useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);

    try {
      // 待办：实现真实的全局搜索API调用
      // 可以并行搜索产品、订单、客户等多个数据源
      const [productResults, orderResults, customerResults] = await Promise.all(
        [
          searchProducts(searchQuery),
          searchOrders(searchQuery),
          searchCustomers(searchQuery),
        ]
      );

      const allResults = [
        ...productResults,
        ...orderResults,
        ...customerResults,
      ];

      setResults(allResults);
    } catch (error) {
      console.error('搜索失败:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 搜索产品
  const searchProducts = async (query: string): Promise<SearchResultItem[]> => {
    try {
      const response = await fetch(
        `/api/products/search?search=${encodeURIComponent(query)}&limit=5`
      );
      if (!response.ok) {return [];}

      const data = await response.json();
      return data.map((product: any) => ({
        id: product.id,
        title: `${product.name} ${product.code}`,
        description: `规格: ${product.specification || '无'}, 库存: ${product.inventory?.reduce((sum: number, inv: any) => sum + inv.quantity, 0) || 0}${product.unit}`,
        type: 'product' as const,
        href: `/products/${product.id}`,
        metadata: {
          stock:
            product.inventory?.reduce(
              (sum: number, inv: any) => sum + inv.quantity,
              0
            ) || 0,
        },
      }));
    } catch {
      return [];
    }
  };

  // 搜索订单
  const searchOrders = async (query: string): Promise<SearchResultItem[]> => {
    try {
      const response = await fetch(
        `/api/sales-orders?search=${encodeURIComponent(query)}&limit=5`
      );
      if (!response.ok) {return [];}

      const data = await response.json();
      return (data.orders || []).map((order: any) => ({
        id: order.id,
        title: `销售订单 #${order.orderNumber}`,
        description: `客户: ${order.customer?.name || '未知'}, 金额: ¥${order.totalAmount?.toLocaleString() || '0'}`,
        type: 'order' as const,
        href: `/sales-orders/${order.id}`,
        metadata: { amount: order.totalAmount, status: order.status },
      }));
    } catch {
      return [];
    }
  };

  // 搜索客户
  const searchCustomers = async (
    query: string
  ): Promise<SearchResultItem[]> => {
    try {
      const response = await fetch(
        `/api/customers/search?q=${encodeURIComponent(query)}&limit=5`
      );
      if (!response.ok) {return [];}

      const data = await response.json();
      return data.map((customer: any) => ({
        id: customer.id,
        title: customer.name,
        description: `联系人: ${customer.contactPerson || customer.name}, 电话: ${customer.phone || '未提供'}`,
        type: 'customer' as const,
        href: `/customers/${customer.id}`,
        metadata: { phone: customer.phone },
      }));
    } catch {
      return [];
    }
  };

  // 防抖搜索
  React.useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // 处理搜索结果选择
  const handleResultSelect = (item: SearchResultItem) => {
    router.push(item.href);
    onOpenChange(false);
    setQuery('');
    onSearch?.(query);
  };

  // 处理建议选择
  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.text);
    inputRef.current?.focus();
  };

  // 键盘导航
  const handleKeyDown = (event: React.KeyboardEvent) => {
    const totalItems = results.length + suggestions.length;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex(prev => (prev + 1) % totalItems);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems);
        break;
      case 'Enter':
        event.preventDefault();
        if (selectedIndex >= 0) {
          if (selectedIndex < results.length) {
            handleResultSelect(results[selectedIndex]);
          } else {
            const suggestionIndex = selectedIndex - results.length;
            handleSuggestionSelect(suggestions[suggestionIndex]);
          }
        } else if (query.trim()) {
          // 直接搜索
          router.push(`/search?q=${encodeURIComponent(query)}`);
          onOpenChange(false);
          onSearch?.(query);
        }
        break;
      case 'Escape':
        onOpenChange(false);
        break;
    }
  };

  // 重置状态当对话框关闭时
  React.useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setSelectedIndex(-1);
    } else {
      // 对话框打开时聚焦输入框
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // 获取类型图标
  const getTypeIcon = (type: SearchResultItem['type']) => {
    switch (type) {
      case 'product':
        return <Package className="h-4 w-4" />;
      case 'order':
        return <ShoppingCart className="h-4 w-4" />;
      case 'customer':
        return <Users className="h-4 w-4" />;
      case 'document':
        return <FileText className="h-4 w-4" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  // 获取类型标签
  const getTypeLabel = (type: SearchResultItem['type']) => {
    switch (type) {
      case 'product':
        return '产品';
      case 'order':
        return '订单';
      case 'customer':
        return '客户';
      case 'document':
        return '文档';
      default:
        return '其他';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="px-6 pb-0 pt-6">
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
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-12 rounded-none border-0 border-b pl-10 text-base focus-visible:border-primary focus-visible:ring-0"
          />
        </div>

        {/* 搜索结果 */}
        <ScrollArea className="max-h-96">
          <div className="px-6 pb-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary"></div>
              </div>
            ) : query.trim() ? (
              results.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                    搜索结果
                  </h3>
                  {results.map((item, index) => (
                    <Button
                      key={item.id}
                      variant="ghost"
                      className={cn(
                        'h-auto w-full justify-start p-3 text-left',
                        selectedIndex === index && 'bg-accent'
                      )}
                      onClick={() => handleResultSelect(item)}
                    >
                      <div className="flex w-full items-start space-x-3">
                        <div className="mt-0.5 text-muted-foreground">
                          {getTypeIcon(item.type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2">
                            <p className="truncate font-medium">{item.title}</p>
                            <Badge variant="outline" className="text-xs">
                              {getTypeLabel(item.type)}
                            </Badge>
                          </div>
                          {item.description && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">未找到相关结果</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    尝试使用不同的关键词
                  </p>
                </div>
              )
            ) : (
              <div className="space-y-4">
                {/* 最近搜索 */}
                <div>
                  <h3 className="mb-3 flex items-center text-sm font-medium text-muted-foreground">
                    <Clock className="mr-2 h-4 w-4" />
                    最近搜索
                  </h3>
                  <div className="space-y-1">
                    {suggestions
                      .filter(s => s.type === 'recent')
                      .map((suggestion, index) => (
                        <Button
                          key={suggestion.id}
                          variant="ghost"
                          className={cn(
                            'w-full justify-start',
                            selectedIndex === results.length + index &&
                              'bg-accent'
                          )}
                          onClick={() => handleSuggestionSelect(suggestion)}
                        >
                          <Clock className="mr-3 h-4 w-4 text-muted-foreground" />
                          {suggestion.text}
                        </Button>
                      ))}
                  </div>
                </div>

                {/* 热门搜索 */}
                <div>
                  <h3 className="mb-3 flex items-center text-sm font-medium text-muted-foreground">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    热门搜索
                  </h3>
                  <div className="space-y-1">
                    {suggestions
                      .filter(s => s.type === 'popular')
                      .map((suggestion, index) => {
                        const adjustedIndex =
                          results.length +
                          suggestions.filter(s => s.type === 'recent').length +
                          index;
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
                            <TrendingUp className="mr-3 h-4 w-4 text-muted-foreground" />
                            {suggestion.text}
                          </Button>
                        );
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
  );
}
