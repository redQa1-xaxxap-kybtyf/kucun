'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Control, useController } from 'react-hook-form'

// UI Components
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'

// Icons
import { ChevronRight, ChevronDown, Building2, Store, User, Search, Check, ChevronsUpDown, AlertCircle } from 'lucide-react'

// API and Types
import { getCustomers, searchCustomers, customerQueryKeys } from '@/lib/api/customers'
import { Customer } from '@/lib/types/customer'
import { CUSTOMER_TYPE_LABELS, CUSTOMER_TYPE_VARIANTS } from '@/lib/types/customer'

// 客户层级树节点类型
interface CustomerTreeNode extends Customer {
  children?: CustomerTreeNode[]
  level: number
  expanded?: boolean
}

// 客户层级树组件属性
interface CustomerHierarchyTreeProps {
  customers: Customer[]
  onSelectCustomer?: (customer: Customer) => void
  selectedCustomerId?: string
  maxLevel?: number
  showStats?: boolean
}

// 客户层级树组件
export function CustomerHierarchyTree({ 
  customers, 
  onSelectCustomer, 
  selectedCustomerId,
  maxLevel = 5,
  showStats = false
}: CustomerHierarchyTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  // 构建树形结构
  const buildTree = (customers: Customer[], parentId?: string, level = 0): CustomerTreeNode[] => {
    if (level > maxLevel) return []
    
    return customers
      .filter(customer => customer.parentCustomerId === parentId)
      .map(customer => ({
        ...customer,
        level,
        children: buildTree(customers, customer.id, level + 1),
        expanded: expandedNodes.has(customer.id)
      }))
  }

  const treeData = buildTree(customers)

  // 切换节点展开状态
  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
  }

  // 渲染树节点
  const renderTreeNode = (node: CustomerTreeNode) => {
    const hasChildren = node.children && node.children.length > 0
    const isSelected = selectedCustomerId === node.id
    const isExpanded = node.expanded

    // 客户类型图标
    const getCustomerIcon = (extendedInfo?: string) => {
      try {
        const info = extendedInfo ? JSON.parse(extendedInfo) : {}
        switch (info.customerType) {
          case 'company': return <Building2 className="h-4 w-4" />
          case 'store': return <Store className="h-4 w-4" />
          case 'individual': return <User className="h-4 w-4" />
          default: return <Building2 className="h-4 w-4" />
        }
      } catch {
        return <Building2 className="h-4 w-4" />
      }
    }

    return (
      <div key={node.id} className="select-none">
        <div
          className={`flex items-center py-2 px-3 rounded-md cursor-pointer hover:bg-muted/50 transition-colors ${
            isSelected ? 'bg-primary/10 border border-primary/20' : ''
          }`}
          style={{ paddingLeft: `${12 + node.level * 20}px` }}
          onClick={() => onSelectCustomer?.(node)}
        >
          {/* 展开/折叠按钮 */}
          <div className="w-4 h-4 mr-2 flex items-center justify-center">
            {hasChildren ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleNode(node.id)
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </Button>
            ) : (
              <div className="w-3 h-3" />
            )}
          </div>

          {/* 客户图标 */}
          <div className="mr-2 text-muted-foreground">
            {getCustomerIcon(node.extendedInfo)}
          </div>

          {/* 客户信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className={`font-medium truncate ${isSelected ? 'text-primary' : ''}`}>
                {node.name}
              </span>
              
              {/* 客户类型标签 */}
              {node.extendedInfo && (() => {
                try {
                  const info = JSON.parse(node.extendedInfo)
                  if (info.customerType) {
                    return (
                      <Badge variant={CUSTOMER_TYPE_VARIANTS[info.customerType]} className="text-xs">
                        {CUSTOMER_TYPE_LABELS[info.customerType]}
                      </Badge>
                    )
                  }
                } catch {}
                return null
              })()}
            </div>
            
            {/* 联系信息 */}
            <div className="text-xs text-muted-foreground truncate">
              {node.phone && <span>{node.phone}</span>}
              {node.phone && node.address && <span className="mx-1">•</span>}
              {node.address && <span>{node.address}</span>}
            </div>

            {/* 统计信息 */}
            {showStats && (node.totalOrders !== undefined || node.totalAmount !== undefined) && (
              <div className="text-xs text-muted-foreground mt-1">
                {node.totalOrders !== undefined && <span>订单: {node.totalOrders}</span>}
                {node.totalOrders !== undefined && node.totalAmount !== undefined && <span className="mx-1">•</span>}
                {node.totalAmount !== undefined && <span>金额: ¥{node.totalAmount.toLocaleString()}</span>}
              </div>
            )}
          </div>

          {/* 子客户数量 */}
          {hasChildren && (
            <Badge variant="outline" className="text-xs">
              {node.children!.length}
            </Badge>
          )}
        </div>

        {/* 子节点 */}
        {hasChildren && isExpanded && (
          <div className="ml-2">
            {node.children!.map(child => renderTreeNode(child))}
          </div>
        )}
      </div>
    )
  }

  if (treeData.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>暂无客户数据</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1">
        {treeData.map(node => renderTreeNode(node))}
      </div>
    </ScrollArea>
  )
}

// 客户选择器组件属性
interface CustomerSelectorProps {
  control: Control<any>
  name: string
  label?: string
  placeholder?: string
  disabled?: boolean
  excludeId?: string
  onlyParents?: boolean
}

// 客户选择器组件
export function CustomerSelector({
  control,
  name,
  label = '选择客户',
  placeholder = '搜索客户...',
  disabled = false,
  excludeId,
  onlyParents = false
}: CustomerSelectorProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const { field } = useController({
    control,
    name,
  })

  // 搜索客户
  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['customers', 'search', searchQuery, excludeId],
    queryFn: () => searchCustomers(searchQuery, excludeId),
    enabled: searchQuery.length > 0,
    staleTime: 30000, // 30秒缓存
  })

  // 获取选中的客户信息
  const { data: selectedCustomer } = useQuery({
    queryKey: ['customers', 'detail', field.value],
    queryFn: async () => {
      if (!field.value) return null
      const response = await fetch(`/api/customers/${field.value}`)
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
    enabled: !!field.value,
  })

  const customers = searchResults?.data || []
  const filteredCustomers = onlyParents 
    ? customers.filter(customer => !customer.parentCustomerId)
    : customers

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            {selectedCustomer ? (
              <div className="flex items-center space-x-2">
                <span className="truncate">{selectedCustomer.name}</span>
                {selectedCustomer.extendedInfo && (() => {
                  try {
                    const info = JSON.parse(selectedCustomer.extendedInfo)
                    if (info.customerType) {
                      return (
                        <Badge variant={CUSTOMER_TYPE_VARIANTS[info.customerType]} className="text-xs">
                          {CUSTOMER_TYPE_LABELS[info.customerType]}
                        </Badge>
                      )
                    }
                  } catch {}
                  return null
                })()}
              </div>
            ) : (
              placeholder
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput
              placeholder="搜索客户..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              {isLoading && (
                <div className="p-2">
                  <Skeleton className="h-8 w-full" />
                </div>
              )}
              
              {!isLoading && filteredCustomers.length === 0 && searchQuery && (
                <CommandEmpty>未找到匹配的客户</CommandEmpty>
              )}
              
              {!isLoading && filteredCustomers.length === 0 && !searchQuery && (
                <CommandEmpty>请输入关键词搜索客户</CommandEmpty>
              )}

              {filteredCustomers.length > 0 && (
                <CommandGroup>
                  {/* 清空选择选项 */}
                  <CommandItem
                    value=""
                    onSelect={() => {
                      field.onChange('')
                      setOpen(false)
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4" />
                      <span className="text-muted-foreground">清空选择</span>
                    </div>
                  </CommandItem>
                  
                  {filteredCustomers.map((customer) => (
                    <CommandItem
                      key={customer.id}
                      value={customer.id}
                      onSelect={() => {
                        field.onChange(customer.id)
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${
                          field.value === customer.id ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium truncate">{customer.name}</span>
                          {customer.extendedInfo && (() => {
                            try {
                              const info = JSON.parse(customer.extendedInfo)
                              if (info.customerType) {
                                return (
                                  <Badge variant={CUSTOMER_TYPE_VARIANTS[info.customerType]} className="text-xs">
                                    {CUSTOMER_TYPE_LABELS[info.customerType]}
                                  </Badge>
                                )
                              }
                            } catch {}
                            return null
                          })()}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {customer.phone && <span>{customer.phone}</span>}
                          {customer.phone && customer.address && <span className="mx-1">•</span>}
                          {customer.address && <span>{customer.address}</span>}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
