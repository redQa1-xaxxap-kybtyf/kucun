'use client';

/**
 * 全局搜索对话框组件 (重构版)
 * 拆分后的主组件,只负责组合子组件
 */

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

import { SearchResultList } from './SearchResultList';
import { SearchSuggestions } from './SearchSuggestions';
import type { SearchResultItem } from './searchApi';
import { useGlobalSearch } from './useGlobalSearch';
import { useKeyboardNav } from './useKeyboardNav';

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch?: (query: string) => void;
}

export function GlobalSearch({
  open,
  onOpenChange,
  onSearch,
}: GlobalSearchProps) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);

  // 搜索逻辑
  const { query, setQuery, results, isLoading, error } = useGlobalSearch();

  // 处理结果选择
  const handleResultSelect = React.useCallback(
    (item: SearchResultItem) => {
      router.push(item.href);
      onOpenChange(false);
      setQuery('');
      onSearch?.(query);
    },
    [router, onOpenChange, setQuery, onSearch, query]
  );

  // 键盘导航
  const { selectedIndex, handleKeyDown } = useKeyboardNav({
    totalItems: results.length,
    onSelect: index => handleResultSelect(results[index]),
    onClose: () => onOpenChange(false),
    onSearch: () => {
      if (query.trim()) {
        router.push(`/search?q=${encodeURIComponent(query)}`);
        onOpenChange(false);
        onSearch?.(query);
      }
    },
  });

  // 重置状态
  React.useEffect(() => {
    if (!open) {
      setQuery('');
    } else {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [open, setQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="sr-only">全局搜索</DialogTitle>
        </DialogHeader>

        {/* 搜索输入框 */}
        <div className="relative px-6">
          <Search className="text-muted-foreground absolute top-1/2 left-9 h-4 w-4 -translate-y-1/2" />
          <Input
            ref={inputRef}
            type="search"
            placeholder="搜索产品、订单、客户..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="focus-visible:border-primary h-12 rounded-none border-0 border-b pl-10 text-base focus-visible:ring-0"
          />
        </div>

        {/* 搜索结果 */}
        <ScrollArea className="max-h-96">
          <div className="px-6 pb-6">
            {query.trim() ? (
              <SearchResultList
                results={results}
                isLoading={isLoading}
                error={error}
                selectedIndex={selectedIndex}
                onSelect={handleResultSelect}
              />
            ) : (
              <SearchSuggestions onSelect={text => setQuery(text)} />
            )}
          </div>
        </ScrollArea>

        {/* 底部提示 */}
        <div className="text-muted-foreground border-t px-6 py-3 text-xs">
          <div className="flex items-center justify-between">
            <span>使用 ↑↓ 导航，Enter 选择，Esc 关闭</span>
            <span>Ctrl+K 快速打开</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
