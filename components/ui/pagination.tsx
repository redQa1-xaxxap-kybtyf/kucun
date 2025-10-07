'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * 分页信息接口
 * 统一的分页数据结构，符合项目规范
 */
export interface PaginationInfo {
  /** 当前页码（从 1 开始） */
  page: number;
  /** 每页显示数量 */
  limit: number;
  /** 总记录数 */
  total: number;
  /** 总页数 */
  totalPages: number;
}

/**
 * 分页组件属性接口
 */
export interface PaginationProps {
  /** 分页信息 */
  pagination: PaginationInfo;
  /** 页码变化回调函数 */
  onPageChange: (page: number) => void;
  /** ✅ hover 预取下一页回调 - 提升用户体验 */
  onNextPageHover?: () => void;
  /** ✅ hover 预取上一页回调 - 提升用户体验 */
  onPrevPageHover?: () => void;
  /** 是否显示记录范围（如：显示第 1-20 条，共 100 条） */
  showRange?: boolean;
  /** 是否显示总记录数 */
  showTotal?: boolean;
  /** 是否禁用（加载中时使用） */
  disabled?: boolean;
  /** 自定义样式类名 */
  className?: string;
  /** 自定义容器样式类名 */
  containerClassName?: string;
}

/**
 * 统一分页组件
 *
 * 遵循项目统一约定规范：
 * - 使用 shadcn/ui Button 组件保持风格一致
 * - 支持响应式设计，移动端友好
 * - 完全类型安全，无 any 类型
 * - 符合 ESLint 规范
 *
 * @example
 * ```tsx
 * <Pagination
 *   pagination={{ page: 1, limit: 20, total: 100, totalPages: 5 }}
 *   onPageChange={(page) => setPage(page)}
 *   showRange
 *   showTotal
 * />
 * ```
 */
export function Pagination({
  pagination,
  onPageChange,
  onNextPageHover,
  onPrevPageHover,
  showRange = true,
  showTotal = true,
  disabled = false,
  className,
  containerClassName,
}: PaginationProps) {
  // 如果只有一页或没有数据，不显示分页
  if (!pagination || pagination.totalPages <= 1 || pagination.total === 0) {
    return null;
  }

  const { page, limit, total, totalPages } = pagination;

  // 计算当前显示的记录范围
  const startRecord = (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, total);

  // 上一页处理
  const handlePrevPage = () => {
    if (page > 1 && !disabled) {
      onPageChange(page - 1);
    }
  };

  // 下一页处理
  const handleNextPage = () => {
    if (page < totalPages && !disabled) {
      onPageChange(page + 1);
    }
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between border-t pt-4',
        containerClassName
      )}
    >
      {/* 左侧：记录信息 */}
      <div className="text-muted-foreground text-sm">
        {showRange && (
          <span className="hidden sm:inline">
            显示第 {startRecord} - {endRecord} 条{showTotal && <span>，</span>}
          </span>
        )}
        {showTotal && <span>共 {total} 条记录</span>}
      </div>

      {/* 右侧：分页控制 */}
      <div className={cn('flex items-center gap-2', className)}>
        {/* 上一页按钮 */}
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevPage}
          onMouseEnter={page > 1 && !disabled ? onPrevPageHover : undefined}
          disabled={page <= 1 || disabled}
          aria-label="上一页"
          className="h-8"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">上一页</span>
        </Button>

        {/* 页码信息 */}
        <div className="text-muted-foreground text-sm">
          第 {page} / {totalPages} 页
        </div>

        {/* 下一页按钮 */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleNextPage}
          onMouseEnter={
            page < totalPages && !disabled ? onNextPageHover : undefined
          }
          disabled={page >= totalPages || disabled}
          aria-label="下一页"
          className="h-8"
        >
          <span className="hidden sm:inline">下一页</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * 简化版分页组件
 * 只显示基本的上一页/下一页按钮和页码
 * 适用于空间受限的场景
 */
export function SimplePagination({
  pagination,
  onPageChange,
  disabled = false,
  className,
}: Omit<PaginationProps, 'showRange' | 'showTotal' | 'containerClassName'>) {
  if (!pagination || pagination.totalPages <= 1 || pagination.total === 0) {
    return null;
  }

  const { page, totalPages } = pagination;

  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1 || disabled}
        aria-label="上一页"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <span className="text-muted-foreground text-sm">
        {page} / {totalPages}
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages || disabled}
        aria-label="下一页"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * 计算分页信息的辅助函数
 *
 * @param page - 当前页码
 * @param limit - 每页数量
 * @param total - 总记录数
 * @returns 完整的分页信息对象
 *
 * @example
 * ```ts
 * const pagination = calculatePagination(1, 20, 100);
 * // { page: 1, limit: 20, total: 100, totalPages: 5 }
 * ```
 */
export function calculatePagination(
  page: number,
  limit: number,
  total: number
): PaginationInfo {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
