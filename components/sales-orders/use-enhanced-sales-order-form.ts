'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import {
  useFieldArray,
  type FieldArrayWithId,
  type UseFormReturn,
} from 'react-hook-form';

import { customerQueryKeys, getCustomers } from '@/lib/api/customers';
import { getProducts, productQueryKeys } from '@/lib/api/products';
import { createSalesOrder, salesOrderQueryKeys } from '@/lib/api/sales-orders';
import type { Customer } from '@/lib/types/customer';
import type { Product } from '@/lib/types/product';
import { transformFormDataToCreateInput } from '@/lib/utils/sales-order-transforms';
import type { SalesOrderCreateFormData as CreateSalesOrderData } from '@/lib/validations/sales-order';

const ORDER_NUMBER_API = '/api/sales-orders/generate-order-number';

function generateLocalOrderNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.getTime().toString().slice(-4);
  return `SO${dateStr}${timeStr}`;
}

export function useCustomerData(form: UseFormReturn<CreateSalesOrderData>) {
  const { data, isLoading } = useQuery({
    queryKey: customerQueryKeys.list({ page: 1, limit: 100 }),
    queryFn: () => getCustomers({ page: 1, limit: 100 }),
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const customers = React.useMemo<Customer[]>(() => data?.data ?? [], [data]);
  const [selectedCustomer, setSelectedCustomer] =
    React.useState<Customer | null>(null);
  const customerId = form.watch('customerId');

  React.useEffect(() => {
    if (!customerId) {
      setSelectedCustomer(null);
      return;
    }

    const customer = customers.find(item => item.id === customerId) ?? null;
    setSelectedCustomer(customer);
  }, [customerId, customers]);

  return { customers, customersLoading: isLoading, selectedCustomer };
}

export function useProductsData() {
  const { data } = useQuery({
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

  return React.useMemo<Product[]>(() => data?.data ?? [], [data]);
}

export function useOrderNumber(
  form: UseFormReturn<CreateSalesOrderData>,
  notifyError: (message: {
    title: string;
    description: string;
    variant: 'destructive';
  }) => void
) {
  const [autoOrderNumber, setAutoOrderNumber] = React.useState('');

  React.useEffect(() => {
    let mounted = true;

    const fetchOrderNumber = async () => {
      try {
        const response = await fetch(ORDER_NUMBER_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();

        if (mounted && data?.success && data.data?.orderNumber) {
          setAutoOrderNumber(data.data.orderNumber);
        } else if (mounted) {
          setAutoOrderNumber(generateLocalOrderNumber());
        }
      } catch {
        if (mounted) {
          setAutoOrderNumber(generateLocalOrderNumber());
        }
      }
    };

    fetchOrderNumber();

    return () => {
      mounted = false;
    };
  }, []);

  const handleGenerateOrderNumber = React.useCallback(async () => {
    try {
      const response = await fetch(ORDER_NUMBER_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();

      if (data?.success && data.data?.orderNumber) {
        form.setValue('orderNumber', data.data.orderNumber);
        setAutoOrderNumber(data.data.orderNumber);
        return;
      }

      throw new Error('FAILED_TO_GENERATE');
    } catch {
      const fallback = generateLocalOrderNumber();
      form.setValue('orderNumber', fallback);
      setAutoOrderNumber(fallback);
      notifyError({
        title: '生成订单号失败',
        description: '已使用本地生成的订单号，请稍后重试',
        variant: 'destructive',
      });
    }
  }, [form, notifyError]);

  return { autoOrderNumber, handleGenerateOrderNumber };
}

function useOrderItemFieldArray(form: UseFormReturn<CreateSalesOrderData>) {
  return useFieldArray({
    control: form.control,
    name: 'items',
  });
}

function useProductSearchState(products: Product[]) {
  const [productSearch, setProductSearch] = React.useState('');

  const filteredProducts = React.useMemo(() => {
    if (!productSearch.trim()) {
      return products;
    }

    const keyword = productSearch.trim().toLowerCase();
    return products.filter(
      product =>
        product.name.toLowerCase().includes(keyword) ||
        product.code.toLowerCase().includes(keyword)
    );
  }, [products, productSearch]);

  return { productSearch, setProductSearch, filteredProducts };
}

function useStockWarningsManager(
  products: Product[],
  fields: FieldArrayWithId<CreateSalesOrderData, 'items', 'id'>[]
) {
  const [stockWarnings, setStockWarnings] = React.useState<
    Record<number, string>
  >({});

  const checkProductStock = React.useCallback(
    (productId: string, itemIndex: number) => {
      const product = products.find(item => item.id === productId);
      if (!product?.inventory) {
        setStockWarnings(prev => {
          if (prev[itemIndex]) {
            const next = { ...prev };
            delete next[itemIndex];
            return next;
          }
          return prev;
        });
        return;
      }

      const availableStock = product.inventory.availableQuantity ?? 0;
      const requestedQuantity = fields[itemIndex]?.quantity ?? 0;

      if (requestedQuantity > availableStock) {
        setStockWarnings(prev => ({
          ...prev,
          [itemIndex]: `库存不足！可用库存：${availableStock}${product.unit}`,
        }));
      } else {
        setStockWarnings(prev => {
          if (!prev[itemIndex]) {
            return prev;
          }
          const next = { ...prev };
          delete next[itemIndex];
          return next;
        });
      }
    },
    [fields, products]
  );

  return { stockWarnings, setStockWarnings, checkProductStock };
}

interface UseOrderItemsResult {
  fields: FieldArrayWithId<CreateSalesOrderData, 'items', 'id'>[];
  addOrderItem: () => void;
  removeOrderItem: (index: number) => void;
  updateOrderItem: (
    index: number,
    field: string,
    value: string | number
  ) => void;
  handleProductSelect: (productId: string, itemIndex: number) => void;
  productSearch: string;
  setProductSearch: React.Dispatch<React.SetStateAction<string>>;
  filteredProducts: Product[];
  stockWarnings: Record<number, string>;
  setStockWarnings: React.Dispatch<
    React.SetStateAction<Record<number, string>>
  >;
  totalAmount: number;
  totalQuantity: number;
}

export function useOrderItems(
  form: UseFormReturn<CreateSalesOrderData>,
  products: Product[]
): UseOrderItemsResult {
  const { fields, append, remove, update } = useOrderItemFieldArray(form);
  const { productSearch, setProductSearch, filteredProducts } =
    useProductSearchState(products);
  const { stockWarnings, setStockWarnings, checkProductStock } =
    useStockWarningsManager(products, fields);

  const addOrderItem = React.useCallback(() => {
    append({
      productId: '',
      quantity: 1,
      unitPrice: 0,
      displayUnit: '件' as const,
      displayQuantity: 1,
      unitCost: undefined,
      manualWeight: undefined,
    } as unknown as never);
  }, [append]);

  const removeOrderItem = React.useCallback(
    (index: number) => {
      remove(index);
    },
    [remove]
  );

  const updateOrderItem = React.useCallback(
    (index: number, field: string, value: string | number) => {
      const currentItem = fields[index];
      if (!currentItem) {
        return;
      }

      const updatedItem = { ...currentItem, [field]: value };

      if (field === 'quantity' || field === 'unitPrice') {
        updatedItem.subtotal =
          (updatedItem.quantity ?? 0) * (updatedItem.unitPrice || 0);
      }

      update(index, updatedItem);

      if (field === 'productId' && value) {
        checkProductStock(String(value), index);
      }
    },
    [checkProductStock, fields, update]
  );

  const handleProductSelect = React.useCallback(
    (productId: string, itemIndex: number) => {
      const product = products.find(item => item.id === productId);
      if (!product) {
        return;
      }

      updateOrderItem(itemIndex, 'productId', productId);
    },
    [products, updateOrderItem]
  );

  const totalAmount = React.useMemo(
    () =>
      fields.reduce(
        (sum, item) => sum + (item.quantity ?? 0) * (item.unitPrice || 0),
        0
      ),
    [fields]
  );

  const totalQuantity = React.useMemo(
    () => fields.reduce((sum, item) => sum + (item.quantity ?? 0), 0),
    [fields]
  );

  return {
    fields,
    addOrderItem,
    removeOrderItem,
    updateOrderItem,
    handleProductSelect,
    productSearch,
    setProductSearch,
    filteredProducts,
    stockWarnings,
    setStockWarnings,
    totalAmount,
    totalQuantity,
  };
}

interface SalesOrderSubmissionParams {
  form: UseFormReturn<CreateSalesOrderData>;
  onSuccess?: (order: unknown) => void;
  router: { push: (href: string) => void };
  toast: (message: {
    title: string;
    description: string;
    variant?: 'destructive' | 'default';
  }) => void;
  fieldsLength: number;
  customerId?: string;
  status: string;
}

export function useSalesOrderSubmission({
  form,
  onSuccess,
  router,
  toast,
  fieldsLength,
  customerId,
  status,
}: SalesOrderSubmissionParams) {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: createSalesOrder,
    onSuccess: data => {
      toast({
        title: '创建成功',
        description: `销售订单"${data.orderNumber}"创建成功！`,
      });
      queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.lists() });

      if (onSuccess) {
        onSuccess(data);
      } else {
        router.push('/sales-orders');
      }
    },
    onError: error => {
      toast({
        title: '创建失败',
        description: error instanceof Error ? error.message : '创建失败',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = React.useCallback(
    (data: CreateSalesOrderData) => {
      const { orderNumber: _orderNumber, ...submitData } = data;
      const apiData = transformFormDataToCreateInput(submitData);

      createMutation.mutate(apiData);
    },
    [createMutation]
  );

  const handleSaveDraft = React.useCallback(() => {
    form.setValue('status', 'draft');
    form.handleSubmit(onSubmit)();
  }, [form, onSubmit]);

  const handleSubmitOrder = React.useCallback(() => {
    form.setValue('status', 'confirmed');
    form.handleSubmit(onSubmit)();
  }, [form, onSubmit]);

  const disableDraft = createMutation.isPending || !customerId;
  const disableSubmit =
    createMutation.isPending || fieldsLength === 0 || !customerId;
  const isDraftSubmitting = createMutation.isPending && status === 'draft';
  const isConfirmSubmitting =
    createMutation.isPending && status === 'confirmed';

  return {
    onSubmit,
    handleSaveDraft,
    handleSubmitOrder,
    disableDraft,
    disableSubmit,
    isDraftSubmitting,
    isConfirmSubmitting,
    isPending: createMutation.isPending,
  };
}
