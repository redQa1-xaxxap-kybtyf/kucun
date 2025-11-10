'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';

import { useToast } from '@/components/ui/use-toast';
import { customerQueryKeys, getCustomers } from '@/lib/api/customers';
import { getProducts, productQueryKeys } from '@/lib/api/products';
import type { Customer } from '@/lib/types/customer';
import type { Product } from '@/lib/types/product';
import {
  salesOrderCreateSchema as CreateSalesOrderSchema,
  type SalesOrderCreateFormData as CreateSalesOrderData,
} from '@/lib/validations/sales-order';

export interface SalesOrderBasicsResult {
  form: UseFormReturn<CreateSalesOrderData>;
  autoOrderNumber: string;
  customers: Customer[];
  customersLoading: boolean;
  selectedCustomer: Customer | null;
  customerId: string;
  status: CreateSalesOrderData['status'];
  orderNumber?: string;
  products: Product[];
  handleGenerateOrderNumber: () => Promise<void>;
  handleCancel: () => void;
  toast: ReturnType<typeof useToast>['toast'];
}

export function useSalesOrderBasics(
  onCancel?: () => void,
  initialOrderNumber?: string // 新增：服务端预生成的订单号
): SalesOrderBasicsResult {
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<CreateSalesOrderData>({
    resolver: zodResolver(CreateSalesOrderSchema),
    mode: 'onBlur', // ✅ 用户离开字段时验证
    reValidateMode: 'onChange', // ✅ 提交后实时验证
    criteriaMode: 'all', // ✅ 显示所有错误
    shouldFocusError: true,
    defaultValues: {
      customerId: '',
      status: 'draft',
      remarks: '',
      items: [],
    },
  });

  const status = form.watch('status');
  const orderNumber = form.watch('orderNumber');

  const autoOrderNumber = useAutoOrderNumber(toast, initialOrderNumber);
  const { customers, customersLoading, selectedCustomer, customerId } =
    useCustomerSelection(form);
  const products = useProducts();

  const handleGenerateOrderNumber = React.useCallback(async () => {
    try {
      const response = await fetch('/api/sales-orders/generate-order-number', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (data.success) {
        form.setValue('orderNumber', data.data.orderNumber);
      } else {
        toast({
          title: '订单号生成失败',
          description: '请稍后重试。',
          variant: 'destructive',
        });
      }
    } catch (_error) {
      toast({
        title: '订单号生成失败',
        description: '请稍后重试。',
        variant: 'destructive',
      });
    }
  }, [form, toast]);

  const handleCancel = React.useCallback(() => {
    if (onCancel) {
      onCancel();
      return;
    }
    router.back();
  }, [onCancel, router]);

  return {
    form,
    autoOrderNumber,
    customers,
    customersLoading,
    selectedCustomer,
    customerId,
    status,
    orderNumber,
    products,
    handleGenerateOrderNumber,
    handleCancel,
    toast,
  };
}

function useAutoOrderNumber(
  toast: ReturnType<typeof useToast>['toast'],
  initialOrderNumber?: string // 新增：服务端预生成的订单号
): string {
  const [autoOrderNumber, setAutoOrderNumber] = React.useState('');

  React.useEffect(() => {
    // 如果有预生成的订单号，直接使用
    if (initialOrderNumber) {
      setAutoOrderNumber(initialOrderNumber);
      return;
    }

    // 降级方案：客户端异步生成（保持向后兼容）
    let isMounted = true;

    const generateOrderNumber = async () => {
      try {
        const response = await fetch(
          '/api/sales-orders/generate-order-number',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
        const data = await response.json();
        if (isMounted && data.success) {
          setAutoOrderNumber(data.data.orderNumber);
        }
      } catch (_error) {
        if (!isMounted) {
          return;
        }
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const timeStr = now.getTime().toString().slice(-4);
        setAutoOrderNumber(`SO${dateStr}${timeStr}`);
        toast({
          title: '订单号生成失败',
          description: '已为你生成临时订单号，请稍后重试。',
          variant: 'destructive',
        });
      }
    };

    void generateOrderNumber();

    return () => {
      isMounted = false;
    };
  }, [toast, initialOrderNumber]);

  return autoOrderNumber;
}

interface CustomerSelectionResult {
  customers: Customer[];
  customersLoading: boolean;
  selectedCustomer: Customer | null;
  customerId: string;
}

function useCustomerSelection(
  form: UseFormReturn<CreateSalesOrderData>
): CustomerSelectionResult {
  const customerId = form.watch('customerId');

  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: customerQueryKeys.list({ page: 1, limit: 100 }),
    queryFn: () => getCustomers({ page: 1, limit: 100 }),
  });

  const customers = React.useMemo(
    () => customersData?.data ?? [],
    [customersData]
  );

  const [selectedCustomer, setSelectedCustomer] =
    React.useState<Customer | null>(null);

  React.useEffect(() => {
    if (customerId) {
      const customer =
        customers.find(current => current.id === customerId) ?? null;
      setSelectedCustomer(customer);
    } else {
      setSelectedCustomer(null);
    }
  }, [customerId, customers]);

  return {
    customers,
    customersLoading,
    selectedCustomer,
    customerId: customerId || '',
  };
}

function useProducts(): Product[] {
  const { data: productsData } = useQuery({
    queryKey: productQueryKeys.list({
      page: 1,
      limit: 200,
      includeInventory: true,
      includeBatchSpecs: true,
    }),
    queryFn: () =>
      getProducts({
        page: 1,
        limit: 200,
        includeInventory: true,
        includeBatchSpecs: true,
      }),
  });

  return React.useMemo(() => productsData?.data ?? [], [productsData]);
}
