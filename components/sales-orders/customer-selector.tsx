'use client';

import { Check, ChevronsUpDown, Plus, Search, User } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
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
import { cn } from '@/lib/utils';

import { CustomerCreateDialog } from './customer-create-dialog';

interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

interface CustomerSelectorProps {
  customers: Customer[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  isLoading?: boolean;
  onCustomerCreated?: (customer: Customer) => void;
}

/**
 * 可搜索的客户选择器组件
 * 支持按客户名称和手机号码进行模糊搜索
 */
export function CustomerSelector({
  customers,
  value,
  onValueChange,
  placeholder = '搜索并选择客户',
  disabled = false,
  className,
  isLoading = false,
  onCustomerCreated,
}: CustomerSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);

  const selectedCustomer = customers.find(customer => customer.id === value);

  // 过滤客户列表
  const filteredCustomers = React.useMemo(() => {
    if (!searchValue) return customers;

    const search = searchValue.toLowerCase();
    return customers.filter(
      customer =>
        customer.name.toLowerCase().includes(search) ||
        (customer.phone && customer.phone.includes(search)) ||
        (customer.email && customer.email.toLowerCase().includes(search))
    );
  }, [customers, searchValue]);

  // 处理客户选择
  const handleSelect = (customerId: string) => {
    onValueChange?.(customerId);
    setOpen(false);
    setSearchValue('');
  };

  // 获取客户显示信息
  const getCustomerDisplayInfo = (customer: Customer) => {
    const info = [];
    if (customer.phone) info.push(customer.phone);
    if (customer.email) info.push(customer.email);
    return info.join(' • ');
  };

  // 处理新增客户
  const handleCreateCustomer = () => {
    setCreateDialogOpen(true);
    setOpen(false);
  };

  // 处理客户创建成功
  const handleCustomerCreated = (customer: {
    id: string;
    name: string;
    phone?: string;
  }) => {
    // 通知父组件
    onCustomerCreated?.(customer as Customer);

    // 自动选择新创建的客户
    onValueChange?.(customer.id);

    // 关闭创建对话框
    setCreateDialogOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn('h-12 w-full justify-between', className)}
            disabled={disabled || isLoading}
          >
            {selectedCustomer ? (
              <div className="flex items-center gap-2 truncate">
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex flex-col items-start truncate">
                  <span className="truncate font-medium">
                    {selectedCustomer.name}
                  </span>
                  {selectedCustomer.phone && (
                    <span className="text-xs text-muted-foreground">
                      {selectedCustomer.phone}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Search className="h-4 w-4" />
                {isLoading ? '加载中...' : placeholder}
              </div>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="搜索客户名称或手机号..."
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>
                {isLoading ? (
                  '加载中...'
                ) : (
                  <div className="py-6 text-center">
                    <div className="mb-3 text-sm text-muted-foreground">
                      未找到相关客户
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCreateCustomer}
                      className="h-8"
                    >
                      <Plus className="mr-2 h-3 w-3" />
                      新增客户
                    </Button>
                  </div>
                )}
              </CommandEmpty>
              <CommandGroup>
                {filteredCustomers.map(customer => {
                  const isSelected = value === customer.id;
                  const displayInfo = getCustomerDisplayInfo(customer);

                  return (
                    <CommandItem
                      key={customer.id}
                      value={`${customer.name} ${customer.phone || ''} ${customer.email || ''}`}
                      onSelect={() => handleSelect(customer.id)}
                      className="flex items-center gap-3 p-3"
                    >
                      <Check
                        className={cn(
                          'h-4 w-4',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      />

                      <div className="flex-1 space-y-1">
                        {/* 客户基本信息 */}
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{customer.name}</span>
                          {customer.phone && (
                            <Badge variant="outline" className="text-xs">
                              {customer.phone}
                            </Badge>
                          )}
                        </div>

                        {/* 客户详细信息 */}
                        {displayInfo && (
                          <div className="text-xs text-muted-foreground">
                            {displayInfo}
                          </div>
                        )}

                        {/* 客户地址 */}
                        {customer.address && (
                          <div className="text-xs text-muted-foreground">
                            地址：{customer.address}
                          </div>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* 客户创建对话框 */}
      <CustomerCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCustomerCreated={handleCustomerCreated}
        initialName={searchValue}
      />
    </>
  );
}
