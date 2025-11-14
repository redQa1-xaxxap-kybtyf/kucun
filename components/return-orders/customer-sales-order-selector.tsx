'use client';

import { Check, ChevronsUpDown, Package, Search, User } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import {
  RETURN_ALLOWED_SALES_ORDER_STATUSES,
  SALES_ORDER_STATUS_LABELS,
  type SalesOrderStatus,
} from '@/lib/config/sales-order';
import { cn, formatCurrency } from '@/lib/utils';
import { formatDate } from '@/lib/utils/datetime';

interface Customer {
  id: string;
  name: string;
  phone?: string;
}

interface SalesOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName?: string;
  totalAmount: number;
  status: SalesOrderStatus;
  createdAt: string;
}

interface CustomerSalesOrderSelectorProps {
  customers: Customer[];
  salesOrders: SalesOrder[];
  selectedCustomerId?: string;
  value?: string; // 选中的销售订单ID
  onCustomerChange?: (customerId: string) => void;
  onValueChange: (salesOrderId: string, salesOrder: SalesOrder) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  isLoadingCustomers?: boolean;
  isLoadingSalesOrders?: boolean;
}

/**
 * 客户-销售订单级联选择器
 * 先选择客户，然后显示该客户的销售订单列表
 * 支持快速搜索和筛选
 */
export function CustomerSalesOrderSelector({
  customers,
  salesOrders,
  selectedCustomerId,
  value,
  onCustomerChange,
  onValueChange,
  placeholder = '选择客户和销售订单',
  disabled = false,
  className,
  isLoadingCustomers = false,
  isLoadingSalesOrders = false,
}: CustomerSalesOrderSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  const [internalCustomerId, setInternalCustomerId] = React.useState<string>(
    selectedCustomerId || ''
  );

  // ✅ 修复：监听 selectedCustomerId 变化，同步更新 internalCustomerId
  React.useEffect(() => {
    if (selectedCustomerId) {
      setInternalCustomerId(selectedCustomerId);
    }
  }, [selectedCustomerId]);

  // 当前选中的客户
  const selectedCustomer = customers.find(
    customer => customer.id === internalCustomerId
  );

  // 当前选中的销售订单
  const selectedOrder = salesOrders.find(order => order.id === value);

  // 过滤客户列表（如果还没选择客户）
  const filteredCustomers = React.useMemo(() => {
    if (internalCustomerId) {
      return [];
    }
    if (!searchValue) {
      return customers;
    }

    const search = searchValue.toLowerCase();
    return customers.filter(
      customer =>
        customer.name.toLowerCase().includes(search) ||
        (customer.phone && customer.phone.includes(search))
    );
  }, [customers, searchValue, internalCustomerId]);

  // 过滤销售订单列表（已选择客户后）
  const filteredSalesOrders = React.useMemo(() => {
    if (!internalCustomerId) {
      return [];
    }

    // 过滤: 只显示该客户的订单，且只显示可退货状态的订单
    // 使用集中化的配置，确保与后端逻辑一致
    const customerOrders = salesOrders.filter(
      order =>
        order.customerId === internalCustomerId &&
        RETURN_ALLOWED_SALES_ORDER_STATUSES.includes(order.status)
    );

    if (!searchValue) {
      return customerOrders;
    }

    const search = searchValue.toLowerCase();
    return customerOrders.filter(order =>
      order.orderNumber.toLowerCase().includes(search)
    );
  }, [salesOrders, internalCustomerId, searchValue]);

  // 处理客户选择
  const handleSelectCustomer = (customerId: string) => {
    setInternalCustomerId(customerId);
    onCustomerChange?.(customerId);
    setSearchValue('');
  };

  // 处理销售订单选择
  const handleSelectOrder = (order: SalesOrder) => {
    onValueChange(order.id, order);
    setOpen(false);
    setSearchValue('');
  };

  // 返回客户列表
  const handleBackToCustomers = () => {
    setInternalCustomerId('');
    setSearchValue('');
  };

  // 格式化金额
  // 格式化状态 - 使用集中化的配置
  const formatStatus = (status: string) =>
    SALES_ORDER_STATUS_LABELS[
      status as keyof typeof SALES_ORDER_STATUS_LABELS
    ] || status;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'h-9 w-full justify-between text-left font-normal',
            !value && 'text-muted-foreground',
            className
          )}
          disabled={disabled}
        >
          {selectedOrder ? (
            <div className="flex items-center gap-2 truncate">
              <Package className="h-4 w-4 shrink-0" />
              <div className="flex flex-col truncate">
                <span className="truncate text-sm font-medium">
                  {selectedOrder.orderNumber}
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  {selectedOrder.customerName || selectedCustomer?.name}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="text-sm">{placeholder}</span>
            </div>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={
              internalCustomerId
                ? '搜索销售订单号...'
                : '搜索客户名称或手机号...'
            }
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {/* 显示客户列表 */}
            {!internalCustomerId && (
              <>
                {isLoadingCustomers ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
                  </div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-6">
                    <Search className="text-muted-foreground h-8 w-8" />
                    <p className="text-muted-foreground text-sm">
                      未找到匹配的客户
                    </p>
                  </div>
                ) : (
                  <CommandGroup heading="选择客户">
                    {filteredCustomers.map(customer => (
                      <CommandItem
                        key={customer.id}
                        value={customer.id}
                        onSelect={() => handleSelectCustomer(customer.id)}
                        className="flex items-center gap-3 p-3"
                      >
                        <User className="text-muted-foreground h-4 w-4 shrink-0" />
                        <div className="flex-1">
                          <div className="font-medium">{customer.name}</div>
                          {customer.phone && (
                            <div className="text-muted-foreground text-xs">
                              {customer.phone}
                            </div>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}

            {/* 显示销售订单列表 */}
            {internalCustomerId && (
              <>
                <div className="bg-muted/30 border-b p-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="text-muted-foreground h-4 w-4" />
                      <span className="text-sm font-medium">
                        {selectedCustomer?.name}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={handleBackToCustomers}
                    >
                      切换客户
                    </Button>
                  </div>
                </div>

                {isLoadingSalesOrders ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
                  </div>
                ) : filteredSalesOrders.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-6">
                    <Package className="text-muted-foreground h-8 w-8" />
                    <p className="text-muted-foreground text-sm">
                      该客户暂无可选的销售订单
                    </p>
                  </div>
                ) : (
                  <CommandGroup heading="选择销售订单">
                    {filteredSalesOrders.map(order => (
                      <CommandItem
                        key={order.id}
                        value={order.id}
                        onSelect={() => handleSelectOrder(order)}
                        className="flex items-center gap-3 p-3"
                      >
                        <Check
                          className={cn(
                            'h-4 w-4 shrink-0',
                            value === order.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">
                              {order.orderNumber}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {formatStatus(order.status)}
                            </span>
                          </div>
                          <Separator className="my-1" />
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {formatDate(order.createdAt)}
                            </span>
                            <span className="font-medium">
                              {formatCurrency(order.totalAmount)}
                            </span>
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
