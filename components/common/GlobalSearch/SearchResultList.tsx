'use client';

/**
 * 搜索结果列表组件
 * 显示搜索结果、加载状态、错误状态
 */

import {
  AlertCircle,
  FileText,
  Package,
  Search,
  ShoppingCart,
  Users,
} from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { SearchResultItem } from './searchApi';

interface SearchResultListProps {
  results: SearchResultItem[];
  isLoading: boolean;
  error: Error | null;
  selectedIndex: number;
  onSelect: (item: SearchResultItem) => void;
}

/**
 * 获取类型图标
 */
function getTypeIcon(type: SearchResultItem['type']) {
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
}

/**
 * 获取类型标签
 */
function getTypeLabel(type: SearchResultItem['type']) {
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
}

export function SearchResultList({
  results,
  isLoading,
  error,
  selectedIndex,
  onSelect,
}: SearchResultListProps) {
  // 加载状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="border-primary h-6 w-6 animate-spin rounded-full border-b-2"></div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="py-8 text-center">
        <AlertCircle className="text-destructive mx-auto mb-4 h-12 w-12" />
        <p className="text-destructive font-medium">搜索失败</p>
        <p className="text-muted-foreground mt-1 text-sm">
          {error.message || '请稍后重试'}
        </p>
      </div>
    );
  }

  // 无结果状态
  if (results.length === 0) {
    return (
      <div className="py-8 text-center">
        <Search className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
        <p className="text-muted-foreground">未找到相关结果</p>
        <p className="text-muted-foreground mt-1 text-sm">
          尝试使用不同的关键词
        </p>
      </div>
    );
  }

  // 结果列表
  return (
    <div className="space-y-2">
      <h3 className="text-muted-foreground mb-3 text-sm font-medium">
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
          onClick={() => onSelect(item)}
        >
          <div className="flex w-full items-start space-x-3">
            <div className="text-muted-foreground mt-0.5">
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
                <p className="text-muted-foreground mt-1 text-sm">
                  {item.description}
                </p>
              )}
            </div>
          </div>
        </Button>
      ))}
    </div>
  );
}
