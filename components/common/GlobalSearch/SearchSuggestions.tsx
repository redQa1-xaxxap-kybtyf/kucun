'use client';

/**
 * 搜索建议列表组件
 * 显示最近搜索和热门搜索
 */

import { Clock, TrendingUp } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * 搜索建议类型
 */
interface SearchSuggestion {
  id: string;
  text: string;
  type: 'recent' | 'popular' | 'suggestion';
}

interface SearchSuggestionsProps {
  onSelect: (text: string) => void;
  selectedIndex?: number;
}

/**
 * 获取搜索建议数据
 * TODO: 从用户历史搜索或热门搜索中获取
 */
const getSearchSuggestions = (): SearchSuggestion[] => [
  { id: '1', text: '产品搜索', type: 'popular' },
  { id: '2', text: '销售订单', type: 'popular' },
  { id: '3', text: '库存查询', type: 'popular' },
  { id: '4', text: '客户管理', type: 'popular' },
];

export function SearchSuggestions({
  onSelect,
  selectedIndex = -1,
}: SearchSuggestionsProps) {
  const suggestions = React.useMemo(() => getSearchSuggestions(), []);

  const recentSuggestions = React.useMemo(
    () => suggestions.filter(s => s.type === 'recent'),
    [suggestions]
  );

  const popularSuggestions = React.useMemo(
    () => suggestions.filter(s => s.type === 'popular'),
    [suggestions]
  );

  return (
    <div className="space-y-4">
      {/* 最近搜索 */}
      {recentSuggestions.length > 0 && (
        <div>
          <h3 className="text-muted-foreground mb-3 flex items-center text-sm font-medium">
            <Clock className="mr-2 h-4 w-4" />
            最近搜索
          </h3>
          <div className="space-y-1">
            {recentSuggestions.map((suggestion, index) => (
              <Button
                key={suggestion.id}
                variant="ghost"
                className={cn(
                  'w-full justify-start',
                  selectedIndex === index && 'bg-accent'
                )}
                onClick={() => onSelect(suggestion.text)}
              >
                <Clock className="text-muted-foreground mr-3 h-4 w-4" />
                {suggestion.text}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* 热门搜索 */}
      {popularSuggestions.length > 0 && (
        <div>
          <h3 className="text-muted-foreground mb-3 flex items-center text-sm font-medium">
            <TrendingUp className="mr-2 h-4 w-4" />
            热门搜索
          </h3>
          <div className="space-y-1">
            {popularSuggestions.map((suggestion, index) => {
              const adjustedIndex = recentSuggestions.length + index;
              return (
                <Button
                  key={suggestion.id}
                  variant="ghost"
                  className={cn(
                    'w-full justify-start',
                    selectedIndex === adjustedIndex && 'bg-accent'
                  )}
                  onClick={() => onSelect(suggestion.text)}
                >
                  <TrendingUp className="text-muted-foreground mr-3 h-4 w-4" />
                  {suggestion.text}
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
