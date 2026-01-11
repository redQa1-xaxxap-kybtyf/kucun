import { ChevronRight } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

import type {
  ActionButton,
  ColumnDef,
  MobileDataTableProps,
} from './mobile-data-table';

export function toDisplayValue(value: unknown): React.ReactNode {
  if (React.isValidElement(value)) {
    return value;
  }

  if (value === null || value === undefined) {
    return '';
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return typeof value === 'boolean' ? (value ? '是' : '否') : String(value);
  }

  if (value instanceof Date) {
    return value.toLocaleString();
  }

  if (Array.isArray(value)) {
    return value.length ? value.map(toDisplayValue).join(', ') : '';
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

interface TableUtilitiesOptions<T extends Record<string, unknown>>
  extends Pick<
    MobileDataTableProps<T>,
    'rowKey' | 'actions' | 'onRowClick' | 'onItemClick'
  > {}

export function useTableUtilities<T extends Record<string, unknown>>({
  rowKey,
  actions = [],
  onRowClick,
  onItemClick,
}: TableUtilitiesOptions<T>) {
  const getRowKey = React.useCallback(
    (record: T, index: number): string => {
      if (typeof rowKey === 'function') {
        return rowKey(record);
      }
      const raw = record[rowKey as keyof T];
      if (raw === null || raw === undefined) {
        return index.toString();
      }
      if (typeof raw === 'string') {
        return raw || index.toString();
      }
      return String(raw);
    },
    [rowKey]
  );

  const handleRowClick = React.useCallback(
    (record: T, index: number) => {
      onRowClick?.(record, index);
      onItemClick?.(record);
    },
    [onItemClick, onRowClick]
  );

  const renderCellContent = React.useCallback(
    (column: ColumnDef<T>, record: T, index: number) => {
      const value = record[column.key as keyof T];
      if (column.render) {
        return column.render(value, record, index);
      }
      return toDisplayValue(value);
    },
    []
  );

  const renderActionButtons = React.useCallback(
    (record: T, index: number) => {
      const visibleActions = actions.filter(action => !action.hidden?.(record));
      if (visibleActions.length === 0) {
        return null;
      }

      return (
        <div className="flex items-center gap-1">
          {visibleActions.map(action => {
            const Icon = action.icon;
            return (
              <Button
                key={action.key}
                variant={action.variant || 'ghost'}
                size="sm"
                onClick={e => {
                  e.stopPropagation();
                  action.onClick(record, index);
                }}
                disabled={action.disabled?.(record)}
                className="h-8 w-8 p-0"
              >
                {Icon ? <Icon className="h-4 w-4" /> : action.label}
              </Button>
            );
          })}
        </div>
      );
    },
    [actions]
  );

  return {
    getRowKey,
    handleRowClick,
    renderCellContent,
    renderActionButtons,
  };
}

interface DesktopTableViewProps<T extends Record<string, unknown>> {
  data: T[];
  columns: ColumnDef<T>[];
  showIndex: boolean;
  actions: ActionButton<T>[];
  tableClassName?: string;
  stickyHeader: boolean;
  maxHeight?: string | number;
  getRowKey: (record: T, index: number) => string;
  handleRowClick: (record: T, index: number) => void;
  renderCellContent: (
    column: ColumnDef<T>,
    record: T,
    index: number
  ) => React.ReactNode;
  renderActionButtons: (record: T, index: number) => React.ReactNode;
  hasClickableRow: boolean;
}

export function DesktopTableView<T extends Record<string, unknown>>({
  data,
  columns,
  showIndex,
  actions,
  tableClassName,
  stickyHeader,
  maxHeight,
  getRowKey,
  handleRowClick,
  renderCellContent,
  renderActionButtons,
  hasClickableRow,
}: DesktopTableViewProps<T>) {
  return (
    <div className="hidden md:block">
      <div
        className={cn(
          'rounded-lg border',
          maxHeight && 'max-h-[var(--table-max-height)] overflow-auto',
          tableClassName
        )}
        style={
          maxHeight
            ? ({
                '--table-max-height':
                  typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
              } as React.CSSProperties)
            : undefined
        }
      >
        <Table>
          <TableHeader
            className={cn(stickyHeader && 'bg-background sticky top-0 z-10')}
          >
            <TableRow>
              {showIndex && <TableHead className="w-12">#</TableHead>}
              {columns.map(column => (
                <TableHead
                  key={column.key}
                  className={cn(
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right',
                    column.className
                  )}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.title}
                </TableHead>
              ))}
              {actions.length > 0 && (
                <TableHead className="w-16">操作</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((record, index) => (
              <TableRow
                key={getRowKey(record, index)}
                className={cn(
                  hasClickableRow && 'hover:bg-muted/50 cursor-pointer'
                )}
                onClick={() => handleRowClick(record, index)}
              >
                {showIndex && (
                  <TableCell className="text-muted-foreground font-medium">
                    {index + 1}
                  </TableCell>
                )}
                {columns.map(column => (
                  <TableCell
                    key={column.key}
                    className={cn(
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right',
                      column.className
                    )}
                  >
                    {renderCellContent(column, record, index)}
                  </TableCell>
                ))}
                {actions.length > 0 && (
                  <TableCell>{renderActionButtons(record, index)}</TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

interface MobileRecordCardProps<T extends Record<string, unknown>> {
  record: T;
  index: number;
  primaryColumns: ColumnDef<T>[];
  secondaryColumns: ColumnDef<T>[];
  actions: ActionButton<T>[];
  cardClassName?: string;
  hasClickableRow: boolean;
  getRowKey: (record: T, index: number) => string;
  handleRowClick: (record: T, index: number) => void;
  renderCellContent: (
    column: ColumnDef<T>,
    record: T,
    index: number
  ) => React.ReactNode;
  renderActionButtons: (record: T, index: number) => React.ReactNode;
  renderActions?: (record: T) => React.ReactNode;
  renderMobileCard?: (item: T) => React.ReactNode;
}

function MobileRecordCard<T extends Record<string, unknown>>({
  record,
  index,
  primaryColumns,
  secondaryColumns,
  actions,
  cardClassName,
  hasClickableRow,
  getRowKey,
  handleRowClick,
  renderCellContent,
  renderActionButtons,
  renderActions,
  renderMobileCard,
}: MobileRecordCardProps<T>) {
  const customContent = renderMobileCard?.(record);

  return (
    <Card
      key={getRowKey(record, index)}
      className={cn(
        'transition-colors',
        hasClickableRow && 'hover:bg-muted/50 active:bg-muted cursor-pointer',
        cardClassName
      )}
      onClick={() => handleRowClick(record, index)}
    >
      <CardContent className="p-4">
        {customContent ? (
          customContent
        ) : (
          <>
            {primaryColumns.length > 0 && (
              <div className="mb-3 space-y-2">
                {primaryColumns.map(column => (
                  <div
                    key={column.key}
                    className="flex items-start justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {renderCellContent(column, record, index)}
                      </div>
                      {column.mobileLabel && (
                        <div className="text-muted-foreground mt-1 text-xs">
                          {column.mobileLabel}
                        </div>
                      )}
                    </div>
                    {actions.length > 0 && (
                      <div className="ml-2 shrink-0">
                        {renderActionButtons(record, index)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {secondaryColumns.length > 0 && (
              <div className="space-y-2 text-sm">
                {secondaryColumns.map(column => {
                  const content = renderCellContent(column, record, index);
                  if (!content) {
                    return null;
                  }

                  return (
                    <div
                      key={column.key}
                      className="flex items-center justify-between"
                    >
                      <span className="text-muted-foreground text-xs">
                        {column.mobileLabel || column.title}:
                      </span>
                      <span className="text-xs font-medium">{content}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {renderActions && (
          <div className="mt-3 flex justify-end">{renderActions(record)}</div>
        )}

        {hasClickableRow && !renderActions && (
          <div className="mt-3 flex justify-end">
            <ChevronRight className="text-muted-foreground h-4 w-4" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface MobileCardListProps<T extends Record<string, unknown>> {
  data: T[];
  columns: ColumnDef<T>[];
  actions: ActionButton<T>[];
  cardClassName?: string;
  getRowKey: (record: T, index: number) => string;
  handleRowClick: (record: T, index: number) => void;
  renderCellContent: (
    column: ColumnDef<T>,
    record: T,
    index: number
  ) => React.ReactNode;
  renderActionButtons: (record: T, index: number) => React.ReactNode;
  onRowClick?: (record: T, index: number) => void;
  onItemClick?: (record: T) => void;
  renderActions?: (record: T) => React.ReactNode;
  renderMobileCard?: (item: T) => React.ReactNode;
}

export function MobileCardList<T extends Record<string, unknown>>({
  data,
  columns,
  actions,
  cardClassName,
  getRowKey,
  handleRowClick,
  renderCellContent,
  renderActionButtons,
  onRowClick,
  onItemClick,
  renderActions,
  renderMobileCard,
}: MobileCardListProps<T>) {
  const hasClickableRow = Boolean(onRowClick || onItemClick);
  const primaryColumns = React.useMemo(
    () => columns.filter(col => col.mobilePrimary && !col.mobileHidden),
    [columns]
  );
  const secondaryColumns = React.useMemo(
    () => columns.filter(col => !col.mobilePrimary && !col.mobileHidden),
    [columns]
  );

  return (
    <div className="space-y-3 md:hidden">
      {data.map((record, index) => (
        <MobileRecordCard
          key={getRowKey(record, index)}
          record={record}
          index={index}
          primaryColumns={primaryColumns}
          secondaryColumns={secondaryColumns}
          actions={actions}
          cardClassName={cardClassName}
          hasClickableRow={hasClickableRow}
          getRowKey={getRowKey}
          handleRowClick={handleRowClick}
          renderCellContent={renderCellContent}
          renderActionButtons={renderActionButtons}
          renderActions={renderActions}
          renderMobileCard={renderMobileCard}
        />
      ))}
    </div>
  );
}
