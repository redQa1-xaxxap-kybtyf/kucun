// 移动端数据表格组件 - 响应式数据展示
// 桌面端显示表格，移动端显示卡片列表

import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { MoreHorizontal, ChevronRight } from "lucide-react"

// 列定义接口
export interface ColumnDef<T> {
  key: string
  title: string
  render?: (value: any, record: T, index: number) => React.ReactNode
  width?: string | number
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  className?: string
  mobileHidden?: boolean // 移动端是否隐藏
  mobileLabel?: string   // 移动端显示的标签
  mobilePrimary?: boolean // 移动端是否为主要信息
}

// 操作按钮接口
export interface ActionButton<T> {
  key: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  onClick: (record: T, index: number) => void
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  disabled?: (record: T) => boolean
  hidden?: (record: T) => boolean
}

export interface MobileDataTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  loading?: boolean
  empty?: React.ReactNode
  rowKey?: string | ((record: T) => string)
  onRowClick?: (record: T, index: number) => void
  actions?: ActionButton<T>[]
  className?: string
  cardClassName?: string
  tableClassName?: string
  showIndex?: boolean
  stickyHeader?: boolean
  maxHeight?: string | number
}

function MobileDataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  empty,
  rowKey = 'id',
  onRowClick,
  actions = [],
  className,
  cardClassName,
  tableClassName,
  showIndex = false,
  stickyHeader = false,
  maxHeight,
}: MobileDataTableProps<T>) {
  // 获取行的唯一键
  const getRowKey = (record: T, index: number): string => {
    if (typeof rowKey === 'function') {
      return rowKey(record)
    }
    return record[rowKey] || index.toString()
  }

  // 渲染单元格内容
  const renderCellContent = (column: ColumnDef<T>, record: T, index: number) => {
    const value = record[column.key]
    if (column.render) {
      return column.render(value, record, index)
    }
    return value
  }

  // 渲染操作按钮
  const renderActions = (record: T, index: number) => {
    const visibleActions = actions.filter(action => !action.hidden?.(record))
    if (visibleActions.length === 0) return null

    return (
      <div className="flex items-center gap-1">
        {visibleActions.map((action) => {
          const Icon = action.icon
          return (
            <Button
              key={action.key}
              variant={action.variant || 'ghost'}
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                action.onClick(record, index)
              }}
              disabled={action.disabled?.(record)}
              className="h-8 w-8 p-0"
            >
              {Icon ? <Icon className="h-4 w-4" /> : action.label}
            </Button>
          )
        })}
      </div>
    )
  }

  // 加载状态
  if (loading) {
    return (
      <div className={cn("space-y-4", className)}>
        {/* 桌面端骨架屏 */}
        <div className="hidden md:block">
          <div className="border rounded-lg">
            <div className="p-4">
              <Skeleton className="h-4 w-full mb-2" />
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full mb-2" />
              ))}
            </div>
          </div>
        </div>
        
        {/* 移动端骨架屏 */}
        <div className="md:hidden space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2 mb-2" />
                <Skeleton className="h-3 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // 空数据状态
  if (!data || data.length === 0) {
    return (
      <div className={cn("", className)}>
        {empty || (
          <div className="text-center py-12">
            <div className="text-muted-foreground">暂无数据</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn("", className)}>
      {/* 桌面端表格 */}
      <div className="hidden md:block">
        <div 
          className={cn(
            "border rounded-lg",
            maxHeight && "overflow-auto",
            tableClassName
          )}
          style={maxHeight ? { maxHeight } : undefined}
        >
          <Table>
            <TableHeader className={cn(stickyHeader && "sticky top-0 bg-background z-10")}>
              <TableRow>
                {showIndex && (
                  <TableHead className="w-12">#</TableHead>
                )}
                {columns.map((column) => (
                  <TableHead
                    key={column.key}
                    className={cn(
                      column.align === 'center' && "text-center",
                      column.align === 'right' && "text-right",
                      column.className
                    )}
                    style={column.width ? { width: column.width } : undefined}
                  >
                    {column.title}
                  </TableHead>
                ))}
                {actions.length > 0 && (
                  <TableHead className="w-20">操作</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((record, index) => (
                <TableRow
                  key={getRowKey(record, index)}
                  className={cn(
                    onRowClick && "cursor-pointer hover:bg-muted/50"
                  )}
                  onClick={() => onRowClick?.(record, index)}
                >
                  {showIndex && (
                    <TableCell className="font-medium text-muted-foreground">
                      {index + 1}
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        column.align === 'center' && "text-center",
                        column.align === 'right' && "text-right",
                        column.className
                      )}
                    >
                      {renderCellContent(column, record, index)}
                    </TableCell>
                  ))}
                  {actions.length > 0 && (
                    <TableCell>
                      {renderActions(record, index)}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 移动端卡片列表 */}
      <div className="md:hidden space-y-3">
        {data.map((record, index) => {
          // 分离主要信息和次要信息
          const primaryColumns = columns.filter(col => col.mobilePrimary && !col.mobileHidden)
          const secondaryColumns = columns.filter(col => !col.mobilePrimary && !col.mobileHidden)
          
          return (
            <Card
              key={getRowKey(record, index)}
              className={cn(
                "transition-colors",
                onRowClick && "cursor-pointer hover:bg-muted/50 active:bg-muted",
                cardClassName
              )}
              onClick={() => onRowClick?.(record, index)}
            >
              <CardContent className="p-4">
                {/* 主要信息 */}
                {primaryColumns.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {primaryColumns.map((column) => (
                      <div key={column.key} className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {renderCellContent(column, record, index)}
                          </div>
                          {column.mobileLabel && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {column.mobileLabel}
                            </div>
                          )}
                        </div>
                        {actions.length > 0 && (
                          <div className="ml-2 flex-shrink-0">
                            {renderActions(record, index)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 次要信息 */}
                {secondaryColumns.length > 0 && (
                  <div className="space-y-2 text-sm">
                    {secondaryColumns.map((column) => {
                      const content = renderCellContent(column, record, index)
                      if (!content) return null
                      
                      return (
                        <div key={column.key} className="flex justify-between items-center">
                          <span className="text-muted-foreground text-xs">
                            {column.mobileLabel || column.title}:
                          </span>
                          <span className="font-medium text-xs">
                            {content}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* 点击指示器 */}
                {onRowClick && (
                  <div className="flex justify-end mt-3">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// 预设的列类型
export const createTextColumn = <T,>(
  key: string, 
  title: string, 
  options?: Partial<ColumnDef<T>>
): ColumnDef<T> => ({
  key,
  title,
  ...options,
})

export const createBadgeColumn = <T,>(
  key: string,
  title: string,
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' = 'default',
  options?: Partial<ColumnDef<T>>
): ColumnDef<T> => ({
  key,
  title,
  render: (value) => value ? <Badge variant={badgeVariant}>{value}</Badge> : null,
  ...options,
})

export const createDateColumn = <T,>(
  key: string,
  title: string,
  format: (date: string | Date) => string = (date) => new Date(date).toLocaleDateString(),
  options?: Partial<ColumnDef<T>>
): ColumnDef<T> => ({
  key,
  title,
  render: (value) => value ? format(value) : '-',
  ...options,
})

export const createNumberColumn = <T,>(
  key: string,
  title: string,
  formatter?: (value: number) => string,
  options?: Partial<ColumnDef<T>>
): ColumnDef<T> => ({
  key,
  title,
  align: 'right',
  render: (value) => {
    if (value === null || value === undefined) return '-'
    return formatter ? formatter(value) : value.toString()
  },
  ...options,
})

export { MobileDataTable }
