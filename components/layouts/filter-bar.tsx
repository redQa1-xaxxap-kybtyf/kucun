'use client';

import * as React from 'react';

import {
  SearchFilterCard,
  type ActionButton,
  type DateRangeFilterConfig,
  type FilterConfig,
  type ToggleButton,
} from '@/components/common/search-filter-card';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  searchValue?: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  searchLabel?: string;
  isSearching?: boolean;
  filters?: FilterConfig[];
  filterValues?: Record<string, string | undefined>;
  onFilterChange?: (key: string, value: string | undefined) => void;
  dateRangeFilter?: DateRangeFilterConfig;
  customFilters?: React.ReactNode;
  toggleButtons?: ToggleButton[];
  actionButtons?: ActionButton[];
  onClearFilters?: () => void;
  showClearButton?: boolean;
  hasActiveFilters?: boolean;
  className?: string;
  cardClassName?: string;
  compact?: boolean;
  title?: React.ReactNode;
  description?: React.ReactNode;
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchLabel,
  isSearching,
  filters,
  filterValues,
  onFilterChange,
  dateRangeFilter,
  customFilters,
  toggleButtons,
  actionButtons,
  onClearFilters,
  showClearButton = true,
  hasActiveFilters,
  className,
  cardClassName,
  compact = true,
  title,
  description,
}: FilterBarProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {(title || description) && (
        <div className="px-1">
          {title && (
            <div className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
              {title}
            </div>
          )}
          {description && (
            <div className="mt-1 text-sm text-[hsl(var(--color-text-secondary))]">
              {description}
            </div>
          )}
        </div>
      )}

      <SearchFilterCard
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        searchPlaceholder={searchPlaceholder}
        searchLabel={searchLabel}
        isSearching={isSearching}
        filters={filters}
        filterValues={filterValues}
        onFilterChange={onFilterChange}
        dateRangeFilter={dateRangeFilter}
        customFilters={customFilters}
        toggleButtons={toggleButtons}
        actionButtons={actionButtons}
        onClearFilters={onClearFilters}
        showClearButton={showClearButton}
        hasActiveFilters={hasActiveFilters}
        compact={compact}
        variant="pro"
        className={cardClassName}
      />
    </div>
  );
}
