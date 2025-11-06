/* eslint-disable max-lines-per-function, max-lines, react-hooks/exhaustive-deps */
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';
import {
  useFieldArray,
  useForm,
  useWatch,
  type FieldErrors,
  type Path,
} from 'react-hook-form';

import { CustomerSelector } from '@/components/sales-orders/customer-selector';
import { FeeItemsInput } from '@/components/sales-orders/fee-items-input';
import { InventoryChecker } from '@/components/sales-orders/inventory-checker';
import { SupplierSelector } from '@/components/sales-orders/supplier-selector';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/components/ui/use-toast';
import {
  useCustomerPriceHistory,
  type PriceType,
} from '@/hooks/use-price-history';
import { getProducts, productQueryKeys } from '@/lib/api/products';
import {
  createSalesOrder,
  salesOrderQueryKeys,
  updateSalesOrder,
} from '@/lib/api/sales-orders';
import { getSuppliers, supplierQueryKeys } from '@/lib/api/suppliers';
import type { Customer } from '@/lib/types/customer';
import type { Product } from '@/lib/types/product';
import {
  TRANSFER_MODE_LABELS,
  type SalesOrder,
  type SalesOrderItem,
  type SalesOrderStatus,
  type TransferFulfillmentMode,
} from '@/lib/types/sales-order';
import type { SalesOrderFeeItem } from '@/lib/types/sales-order-fee';
import type { Supplier } from '@/lib/types/supplier';
import { logger } from '@/lib/utils/console-logger';
import {
  transformFormDataToCreateInput,
  transformFormDataToUpdateInput,
  type SalesOrderFormData,
} from '@/lib/utils/sales-order-transforms';
import { convertUnitPrice } from '@/lib/utils/unit-conversion';
import {
  salesOrderCreateSchema as CreateSalesOrderSchema,
  type SalesOrderCreateFormData as CreateSalesOrderData,
  type SalesOrderItemFormData,
} from '@/lib/validations/sales-order';

import { OrderItemsSection } from './erp-sales-order-form/OrderItemsSection';
import { PrepaymentSection } from './erp-sales-order-form/PrepaymentSection';

const UNIT_MAPPING: Record<string, string> = {
  piece: '件',
  pieces: '件',
  box: '箱',
  boxes: '箱',
  pack: '包',
  packs: '包',
  set: '套',
  sets: '套',
  unit: '个',
  units: '个',
  kg: '公斤',
  g: '克',
  m: '米',
  cm: '厘米',
  mm: '毫米',
  m2: '平方米',
  m3: '立方米',
  l: '升',
  ml: '毫升',
};

// 客户数据查询已移至 CustomerSelector 组件内部
type SuppliersResponse = Awaited<ReturnType<typeof getSuppliers>>;

interface ERPSalesOrderFormProps {
  mode?: 'create' | 'edit';
  orderId?: string;
  initialData?: SalesOrder;
  initialOrderNumber?: string; // 新增：服务端预生成的订单号
  onSuccess?: (order: { id: string; orderNumber?: string }) => void;
  onCancel?: () => void;
}

/**
 * ERP风格的销售订单表单组件
 * 采用中国主流ERP系统的界面设计模式
 * 优化：支持接收预生成的订单号，消除加载延迟
 */
export function ERPSalesOrderForm({
  mode = 'create',
  orderId,
  initialData,
  initialOrderNumber,
  onSuccess,
  onCancel,
}: ERPSalesOrderFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 客户数据查询已移至 CustomerSelector 组件内部
  // 不再需要在表单组件中预加载客户列表

  const suppliersQueryParams = React.useMemo(
    () =>
      ({
        page: 1,
        limit: 100,
        status: 'active',
        sortBy: 'name',
        sortOrder: 'asc',
      }) as const,
    []
  );
  const suppliersQueryKey = React.useMemo(
    () => supplierQueryKeys.list(suppliersQueryParams),
    [suppliersQueryParams]
  );

  const [resolvedCustomer, setResolvedCustomer] =
    React.useState<Customer | null>(() => initialData?.customer ?? null);
  React.useEffect(() => {
    if (mode === 'edit' && initialData?.customer) {
      setResolvedCustomer(initialData.customer);
    }
  }, [mode, initialData?.customer]);

  const mapFormDataForTransform = React.useCallback(
    (payload: CreateSalesOrderData): SalesOrderFormData => ({
      customerId: payload.customerId,
      status: payload.status,
      orderType: payload.orderType,
      transferMode: payload.transferMode,
      supplierId: payload.supplierId,
      remarks: payload.remarks ?? '',
      items: payload.items ?? [],
      feeItems: (payload.feeItems ?? []).map(fee => ({
        id: fee.id ?? undefined,
        feeType: fee.feeType,
        feeName: fee.feeName,
        feeAmount: fee.feeAmount,
        remarks: fee.remarks ?? '',
      })),
      roundingAdjustment: payload.roundingAdjustment,
      usePrepayment: payload.usePrepayment,
      prepaymentAmount: payload.prepaymentAmount,
    }),
    []
  );

  // 表单状态
  const form = useForm<CreateSalesOrderData>({
    resolver: zodResolver(CreateSalesOrderSchema),
    mode: 'onSubmit',
    defaultValues: {
      customerId: '',
      status: 'draft',
      orderType: 'NORMAL',
      transferMode: 'SUPPLIER_ONLY',
      supplierId: '',
      remarks: '',
      feeItems: [],
      items: [],
      roundingAdjustment: undefined,
    },
  });

  const { fields, append, remove } = useFieldArray<
    CreateSalesOrderData,
    'items'
  >({
    control: form.control,
    name: 'items',
  });

  const findFirstError = React.useCallback(
    (
      errors: FieldErrors<CreateSalesOrderData>
    ): { path: Path<CreateSalesOrderData>; message: string } | null => {
      const traverse = (
        value: unknown,
        currentPath: string
      ): { path: string; message: string } | null => {
        if (!value) {
          return null;
        }

        if (
          typeof value === 'object' &&
          value !== null &&
          'message' in (value as Record<string, unknown>)
        ) {
          const message = String(
            (value as { message?: unknown }).message ?? ''
          ).trim();

          if (message) {
            return { path: currentPath, message };
          }
        }

        if (Array.isArray(value)) {
          for (let index = 0; index < value.length; index += 1) {
            const result = traverse(
              value[index],
              currentPath ? `${currentPath}.${index}` : String(index)
            );
            if (result) {
              return result;
            }
          }
        } else if (typeof value === 'object' && value !== null) {
          for (const [key, child] of Object.entries(
            value as Record<string, unknown>
          )) {
            const nextPath = currentPath ? `${currentPath}.${key}` : key;
            const result = traverse(child, nextPath);
            if (result) {
              return result;
            }
          }
        }

        return null;
      };

      const result = traverse(errors, '');
      if (!result) {
        return null;
      }

      return {
        path: result.path as Path<CreateSalesOrderData>,
        message: result.message,
      };
    },
    []
  );

  // 监听客户ID变化
  const selectedCustomerId = form.watch('customerId');
  const orderType = form.watch('orderType');
  const transferMode = form.watch('transferMode') as
    | TransferFulfillmentMode
    | undefined;
  const feeItems = (form.watch('feeItems') || []) as SalesOrderFeeItem[];
  const roundingAdjustment = Number(form.watch('roundingAdjustment') ?? 0);

  // 客户数据查询已移至 CustomerSelector 组件内部

  const { data: productsData, isLoading: _productsLoading } = useQuery({
    queryKey: productQueryKeys.list({
      includeInventory: true,
      includeBatchSpecs: true,
    }),
    queryFn: () =>
      getProducts({
        includeInventory: true,
        includeStatistics: false,
        includeBatchSpecs: true,
      }),
  });

  const { data: suppliersData, isLoading: suppliersLoading } = useQuery({
    queryKey: suppliersQueryKey,
    queryFn: () => getSuppliers(suppliersQueryParams),
  });

  // 获取客户的历史价格（根据订单类型决定价格类型）
  // 普通销售用SALES价格，调货销售用FACTORY价格
  const priceType: PriceType = orderType === 'NORMAL' ? 'SALES' : 'FACTORY';

  const { data: priceHistoryData } = useCustomerPriceHistory({
    customerId: selectedCustomerId,
    priceType,
  });

  // 创建订单
  const createMutation = useMutation({
    mutationFn: createSalesOrder,
    onSuccess: data => {
      toast({
        title: '订单创建成功',
        description: `订单号：${data.orderNumber}`,
        variant: 'success',
      });

      // ✅ 失效销售订单缓存
      queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.all });

      // ✅ 关键修复：同时失效应收款缓存并强制重新获取
      queryClient.invalidateQueries({
        queryKey: ['finance', 'receivables'],
        refetchType: 'active',
      });

      onSuccess?.(data);
    },
    onError: error => {
      toast({
        title: '创建失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // 更新订单
  const updateMutation = useMutation({
    mutationFn: updateSalesOrder,
    onSuccess: response => {
      const order = response.data;
      toast({
        title: '订单更新成功',
        description: `订单号：${order?.orderNumber || ''}`,
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.all });
      if (orderId) {
        queryClient.invalidateQueries({
          queryKey: salesOrderQueryKeys.detail(orderId),
        });
      }
      if (order) {
        onSuccess?.(order);
      }
    },
    onError: error => {
      toast({
        title: '更新失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // 计算总金额：始终基于系统数量（片数）和片单价
  const watchedItems = (useWatch<CreateSalesOrderData>({
    control: form.control,
    name: 'items',
    defaultValue: form.getValues('items'),
  }) ?? []) as SalesOrderItemFormData[];

  const inventoryCheckItems = React.useMemo(
    () =>
      watchedItems.map(item => {
        const quantity = Number(item.quantity ?? 0);
        const safeQuantity = Number.isFinite(quantity) ? quantity : 0;
        const productId = (item.productId ?? '').toString().trim();
        const batchNumber = item.batchNumber ?? '';

        return {
          productId,
          quantity: safeQuantity,
          batchNumber,
        };
      }),
    [watchedItems]
  );

  // 优化：使用 ref 跟踪上一次的 orderType，避免不必要的 setValue 调用
  const prevOrderTypeRef = React.useRef<'NORMAL' | 'TRANSFER'>(orderType);

  React.useEffect(() => {
    // 只在 orderType 真正改变时才执行
    if (prevOrderTypeRef.current === orderType) {
      return;
    }

    prevOrderTypeRef.current = orderType;

    if (orderType === 'TRANSFER') {
      // 切换到调货模式：只在 transferMode 为空时设置默认值
      const currentTransferMode = form.getValues('transferMode');
      if (!currentTransferMode) {
        form.setValue('transferMode', 'SUPPLIER_ONLY', {
          shouldDirty: false,
          shouldValidate: false,
        });
      }
    } else {
      // 切换到普通模式：重置相关字段
      const currentTransferMode = form.getValues('transferMode');
      const currentSupplierId = form.getValues('supplierId');

      if (currentTransferMode !== 'SUPPLIER_ONLY') {
        form.setValue('transferMode', 'SUPPLIER_ONLY', {
          shouldDirty: false,
          shouldValidate: false,
        });
      }

      if (currentSupplierId) {
        form.setValue('supplierId', '', {
          shouldDirty: true,
          shouldValidate: false,
        });
      }
    }
  }, [form, orderType]);

  const coerceNumeric = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const totalAmount = watchedItems.reduce((sum, item) => {
    // 计算片单价（如果当前显示单位是件，需要转换为片单价）
    const piecePriceForCalculation =
      item.displayUnit === '件' && item.unitPrice && item.piecesPerUnit
        ? convertUnitPrice.unitPriceToPiecePrice(
            item.unitPrice,
            item.piecesPerUnit
          )
        : item.unitPrice || 0;

    // 金额 = 系统数量（片数） × 片单价
    return sum + (item.quantity || 0) * piecePriceForCalculation;
  }, 0);

  const additionalFees = feeItems.reduce(
    (sum: number, fee) => sum + coerceNumeric(fee.feeAmount),
    0
  );
  const orderTotalWithFees = totalAmount + additionalFees + roundingAdjustment;

  const totalLocalQuantity = watchedItems.reduce(
    (sum, item) => sum + coerceNumeric(item.localQuantity),
    0
  );
  const totalTransferQuantity = watchedItems.reduce(
    (sum, item) => sum + coerceNumeric(item.transferQuantity),
    0
  );
  const formatCurrency = (value: number) =>
    value.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const formatPieces = (value: number) =>
    `${value.toLocaleString('zh-CN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })} 片`;

  // 重量格式化工具函数 - 始终以吨为单位显示,保留1位小数
  const formatWeight = (totalKg: number): string =>
    `${Number.isFinite(totalKg) ? (totalKg / 1000).toFixed(1) : '0.0'}吨`;

  // 计算总重量：根据单位和每件片数正确计算
  const productMap = React.useMemo(() => {
    const map = new Map<string, Product>();
    (productsData?.data ?? []).forEach(product => {
      if (product?.id) {
        map.set(product.id, product);
      }
    });
    return map;
  }, [productsData?.data]);

  const totalWeight = React.useMemo(
    () =>
      watchedItems.reduce((sum, item, index) => {
        const quantityPieces = Number(item.quantity ?? 0);
        if (!Number.isFinite(quantityPieces) || quantityPieces <= 0) {
          return sum;
        }

        const productId = (item.productId ?? '').toString().trim();
        const product = productId ? productMap.get(productId) : undefined;
        const batchSpec =
          product && item.batchNumber
            ? product.batchSpecs?.find(
                spec => spec.batchNumber === item.batchNumber
              )
            : undefined;

        const effectivePiecesPerUnit =
          (item.piecesPerUnit && item.piecesPerUnit > 0
            ? item.piecesPerUnit
            : undefined) ??
          (batchSpec?.piecesPerUnit && batchSpec.piecesPerUnit > 0
            ? batchSpec.piecesPerUnit
            : undefined) ??
          (product?.piecesPerUnit && product.piecesPerUnit > 0
            ? product.piecesPerUnit
            : undefined) ??
          1;

        let weightKg: number | undefined;

        if (item.isManualProduct) {
          // 手动输入产品：manualWeight是用户输入的重量，根据displayUnit判断是每件还是每片
          const manualWeight = Number(item.manualWeight ?? 0);
          if (manualWeight > 0) {
            if (item.displayUnit === '件') {
              // 用户输入的是每件重量
              weightKg = manualWeight * Number(item.displayQuantity ?? 0);
            } else {
              // 用户输入的是每片重量
              weightKg = manualWeight * quantityPieces;
            }
          }
        } else {
          // 库存产品：weight字段存储的是每件的重量(kg)，不是每片
          const weightPerUnit =
            (batchSpec && batchSpec.weight && batchSpec.weight > 0
              ? batchSpec.weight
              : undefined) ??
            (product && product.weight && product.weight > 0
              ? product.weight
              : undefined);

          if (weightPerUnit && weightPerUnit > 0) {
            if (item.displayUnit === '件') {
              // 销售单位是"件"：总重量 = 每件重量 × 件数
              const displayQty = Number(item.displayQuantity ?? 0);
              weightKg = weightPerUnit * displayQty;
            } else {
              // 销售单位是"片"：总重量 = (每件重量 / 每件片数) × 片数
              const weightPerPiece = weightPerUnit / effectivePiecesPerUnit;
              weightKg = weightPerPiece * quantityPieces;
            }
          }

          // 调试日志：输出重量计算详情
          if (productId && index === 0) {
            // 只输出第一个产品的调试信息，避免刷屏
            logger.debug('sales-orders', '重量计算调试 [第1个产品]', {
              productCode: product?.code,
              productName: product?.name,
              batchNumber: item.batchNumber,
              displayUnit: item.displayUnit,
              displayQuantity: item.displayQuantity,
              quantityPieces,
              effectivePiecesPerUnit,
              batchWeight: batchSpec?.weight,
              productWeight: product?.weight,
              weightPerUnit,
              calculatedWeightKg: weightKg,
            });
          }
        }

        if (!weightKg || !Number.isFinite(weightKg)) {
          return sum;
        }

        return sum + weightKg;
      }, 0),
    [watchedItems, productMap]
  );

  // 添加产品
  const addOrderItem = () => {
    append({
      productId: '',
      productCode: '',
      batchNumber: '',
      colorCode: '',
      productionDate: '',
      specification: '',
      unit: '',
      displayUnit: '片' as const,
      displayQuantity: 1,
      quantity: 1,
      unitPrice: 0,
      unitCost: undefined,
      costSubtotal: undefined,
      profitAmount: undefined,
      localQuantity: undefined,
      transferQuantity: undefined,
      piecesPerUnit: undefined,
      subtotal: 0,
      remarks: '',
      isManualProduct: false,
      manualProductName: '',
      manualSpecification: '',
      manualWeight: undefined,
      manualUnit: '',
      weightPerPieceKg: undefined,
    });
  };

  // 自动生成订单号状态
  const [autoOrderNumber, setAutoOrderNumber] = React.useState<string>('');

  const creationDisplayDate = React.useMemo(() => {
    if (mode === 'edit' && initialData?.createdAt) {
      const parsedDate = new Date(initialData.createdAt);
      if (!Number.isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }
    return new Date();
  }, [mode, initialData?.createdAt]);

  const initializedOrderRef = React.useRef<string | null>(null);

  // 编辑模式：填充初始数据
  React.useEffect(() => {
    if (mode !== 'edit') {
      initializedOrderRef.current = null;
      return;
    }

    if (!initialData) {
      return;
    }

    const orderKey =
      [initialData.id, initialData.orderNumber, initialData.updatedAt]
        .filter(Boolean)
        .join('__') || 'unknown-order';

    if (initializedOrderRef.current === orderKey) {
      return;
    }

    initializedOrderRef.current = orderKey;

    const mappedItems: SalesOrderItemFormData[] = (initialData.items ?? []).map(
      (item: SalesOrderItem) => {
        const product = item.product;
        const normalizedUnit =
          product?.unit && typeof product.unit === 'string'
            ? (UNIT_MAPPING[
                product.unit.toLowerCase() as keyof typeof UNIT_MAPPING
              ] ?? product.unit)
            : (product?.unit ?? '');

        return {
          productId: item.productId ?? '',
          productCode: item.productCode ?? product?.code ?? '',
          batchNumber: item.batchNumber ?? '',
          colorCode: item.colorCode ?? '',
          productionDate: item.productionDate ?? '',
          specification: item.specification ?? product?.specification ?? '',
          unit: normalizedUnit,
          displayUnit: (item.displayUnit as '片' | '件' | null) ?? '片',
          displayQuantity: item.displayQuantity ?? item.quantity ?? 0,
          quantity: item.quantity ?? 0,
          unitPrice: item.unitPrice ?? 0,
          unitCost: item.unitCost ?? undefined,
          costSubtotal: item.costSubtotal ?? undefined,
          profitAmount: item.profitAmount ?? undefined,
          piecesPerUnit:
            item.piecesPerUnit ?? product?.piecesPerUnit ?? undefined,
          remarks: item.remarks ?? '',
          subtotal:
            item.subtotal ?? (item.quantity ?? 0) * (item.unitPrice ?? 0),
          isManualProduct: item.isManualProduct ?? false,
          manualProductName: item.manualProductName ?? '',
          manualSpecification: item.manualSpecification ?? '',
          manualWeight: item.manualWeight ?? undefined,
          manualUnit: item.manualUnit ?? '',
          localQuantity: item.localQuantity ?? undefined,
          transferQuantity: item.transferQuantity ?? undefined,
          weightPerPieceKg: undefined,
        };
      }
    );

    form.reset({
      orderNumber: initialData.orderNumber,
      customerId: initialData.customerId,
      status: initialData.status,
      orderType: initialData.orderType,
      transferMode:
        (initialData.transferMode as TransferFulfillmentMode | undefined) ??
        'SUPPLIER_ONLY',
      supplierId: initialData.supplierId ?? '',
      remarks: initialData.remarks ?? '',
      roundingAdjustment: initialData.roundingAdjustment ?? undefined,
      items: mappedItems,
      feeItems: Array.isArray(initialData.feeItems)
        ? initialData.feeItems.map(fee => ({
            id: fee.id ?? undefined,
            feeType: fee.feeType,
            feeName: fee.feeName,
            feeAmount: fee.feeAmount,
            remarks: fee.remarks ?? '',
          }))
        : [],
    });
  }, [form, mode, initialData]);

  // 页面加载时设置订单号（仅创建模式）
  // 优化：优先使用服务端预生成的订单号，消除加载延迟
  React.useEffect(() => {
    if (mode === 'create') {
      // 如果有预生成的订单号，直接使用
      if (initialOrderNumber) {
        setAutoOrderNumber(initialOrderNumber);
        return;
      }

      // 降级方案：客户端异步生成（保持向后兼容）
      const generateOrderNumber = async () => {
        const generateLocalOrderNumber = () => {
          const now = new Date();
          const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
          const timeStr = now.getTime().toString().slice(-4);
          return `SO${dateStr}${timeStr}`;
        };

        try {
          const response = await fetch(
            '/api/sales-orders/generate-order-number',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
            }
          );
          const data = await response.json();
          if (response.ok && data?.success && data.data?.orderNumber) {
            setAutoOrderNumber(data.data.orderNumber);
            return;
          }

          // 接口可达但未成功，降级到本地生成
          logger.warn(
            'sales-orders',
            '自动生成订单号返回非成功结果',
            undefined,
            { status: response.status, body: data }
          );
          setAutoOrderNumber(generateLocalOrderNumber());
        } catch (error) {
          logger.error('sales-orders', '自动生成订单号失败', error);
          // 如果API失败，使用本地生成逻辑作为备用
          setAutoOrderNumber(generateLocalOrderNumber());
        }
      };

      generateOrderNumber();
    }
  }, [mode, initialOrderNumber]);

  // 客户创建成功处理（客户数据查询已移至 CustomerSelector 组件内部）
  const handleCustomerCreated = (customer: Customer) => {
    // CustomerSelector 组件会自动处理新创建的客户
    toast({
      title: '客户创建成功',
      description: `客户 "${customer.name}" 已创建并自动选择`,
      variant: 'success',
    });
  };
  const handleCustomerResolved = React.useCallback(
    (customer: Customer | undefined) => {
      setResolvedCustomer(customer ?? null);
    },
    []
  );

  const handleSupplierCreated = (supplier: Supplier) => {
    queryClient.setQueryData<SuppliersResponse | undefined>(
      suppliersQueryKey,
      previous => {
        if (!previous) {
          return {
            data: [supplier],
            pagination: {
              page: suppliersQueryParams.page,
              limit: suppliersQueryParams.limit,
              total: 1,
              totalPages: 1,
            },
          };
        }

        const existingIndex = previous.data.findIndex(
          existing => existing.id === supplier.id
        );

        const updatedData =
          existingIndex >= 0
            ? previous.data.map((item, index) =>
                index === existingIndex ? supplier : item
              )
            : [supplier, ...previous.data].slice(
                0,
                previous.pagination?.limit ?? previous.data.length + 1
              );

        if (!previous.pagination) {
          return {
            ...previous,
            data: updatedData,
          };
        }

        const previousTotal =
          typeof previous.pagination.total === 'number'
            ? previous.pagination.total
            : previous.data.length;
        const newTotal = existingIndex >= 0 ? previousTotal : previousTotal + 1;

        const updatedPagination = {
          ...previous.pagination,
          total: newTotal,
          totalPages:
            previous.pagination.limit && previous.pagination.limit > 0
              ? Math.ceil(newTotal / previous.pagination.limit)
              : previous.pagination.totalPages,
        };

        return {
          ...previous,
          data: updatedData,
          pagination: updatedPagination,
        };
      }
    );

    form.setValue('supplierId', supplier.id, {
      shouldDirty: true,
      shouldTouch: true,
    });

    toast({
      title: '供应商创建成功',
      description: `供应商 "${supplier.name}" 已创建并自动选择`,
      variant: 'success',
    });
  };

  // 提交表单
  // Zod schema 验证已经在 React Hook Form 中自动执行
  const onSubmit = (data: CreateSalesOrderData) => {
    if (mode === 'edit' && orderId) {
      // 编辑模式：更新现有订单
      const formDataForTransform = mapFormDataForTransform(data);
      const apiData = transformFormDataToUpdateInput(
        orderId,
        formDataForTransform
      );
      updateMutation.mutate(apiData);
    } else {
      const formDataForTransform = mapFormDataForTransform(data);
      const apiData = transformFormDataToCreateInput(formDataForTransform);
      createMutation.mutate(apiData);
    }
  };

  const submitWithStatus = React.useCallback(
    (status: SalesOrderStatus) => {
      const snapshot = form.getValues();
      if (!snapshot.customerId || snapshot.customerId.trim() === '') {
        form.setError('customerId', {
          type: 'manual',
          message: '请选择客户',
        });
        try {
          form.setFocus('customerId');
        } catch (error) {
          logger.debug('sales-orders', 'Failed to focus customer field', error);
        }
        toast({
          variant: 'destructive',
          title: '客户未选择',
          description: '请选择客户后再保存订单。',
        });
        return;
      }
      // Zod schema 验证会在 handleSubmit 中自动执行
      form.setValue('status', status, {
        shouldDirty: true,
        shouldValidate: false,
      });
      void form.handleSubmit(onSubmit, errors => {
        const firstError = findFirstError(errors);

        if (firstError?.path) {
          try {
            form.setFocus(firstError.path);
          } catch (error) {
            logger.debug(
              'sales-orders',
              'Failed to focus first error field',
              firstError.path,
              error
            );
          }
        }

        toast({
          variant: 'destructive',
          title: '请检查订单信息',
          description:
            firstError?.message || '部分字段填写不完整，请检查后再试',
        });
      })();
    },
    [findFirstError, form, onSubmit, toast]
  );

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* ERP标准布局：基本信息区域 */}
          <div className="bg-card rounded-lg border shadow-sm">
            <div className="border-b bg-gradient-to-r from-blue-50 to-slate-50 px-4 py-2.5">
              <h3 className="text-sm font-semibold text-gray-700">基本信息</h3>
            </div>
            <div className="p-4">
              {/* 第一行：订单号和创建日期 */}
              <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {/* 订单号 */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">
                    订单号
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 font-mono text-sm font-medium text-blue-700">
                      {mode === 'edit'
                        ? form.watch('orderNumber') || initialData?.orderNumber
                        : autoOrderNumber || '正在生成...'}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    {mode === 'edit'
                      ? '编辑现有订单'
                      : '系统将自动生成唯一订单号'}
                  </p>
                </div>

                {/* 创建日期 */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">
                    创建日期
                  </Label>
                  <div className="rounded-md border bg-gray-50 px-3 py-1.5 text-sm text-gray-700">
                    {creationDisplayDate.toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                </div>
              </div>

              {/* 第二行：客户和订单类型 */}
              <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {/* 客户名称 */}
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-sm font-medium text-gray-700">
                        客户名称 <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <CustomerSelector
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="搜索并选择客户"
                          onCustomerCreated={handleCustomerCreated}
                          onCustomerResolved={handleCustomerResolved}
                          initialCustomer={initialData?.customer}
                          className="h-9"
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                {/* 订单类型 */}
                <FormField
                  control={form.control}
                  name="orderType"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-sm font-medium text-gray-700">
                        订单类型 <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          className="flex flex-row space-x-8 pt-1.5"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="NORMAL" id="normal" />
                            <Label
                              htmlFor="normal"
                              className="cursor-pointer text-sm font-normal"
                            >
                              正常销售
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="TRANSFER" id="transfer" />
                            <Label
                              htmlFor="transfer"
                              className="cursor-pointer text-sm font-normal"
                            >
                              调货销售
                            </Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </div>

              {/* 第三行：客户地址 */}
              {selectedCustomerId && (
                <div className="mb-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">
                      客户地址
                    </Label>
                    <div className="flex min-h-[36px] items-center rounded-md border bg-gray-50 px-3 py-1.5 text-sm text-gray-700">
                      {resolvedCustomer ? (
                        resolvedCustomer.address?.trim() ? (
                          <span className="truncate">
                            {resolvedCustomer.address.trim()}
                          </span>
                        ) : (
                          <span className="text-gray-400">
                            该客户暂无地址，可在客户资料中维护
                          </span>
                        )
                      ) : (
                        <span className="text-gray-400">
                          正在加载客户地址...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 调货销售特殊字段 */}
              {orderType === 'TRANSFER' && (
                <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50/50 p-3">
                  <h4 className="mb-3 text-sm font-semibold text-orange-800">
                    调货销售信息
                  </h4>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="transferMode"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5 md:col-span-3">
                          <FormLabel className="text-sm font-medium text-gray-700">
                            调货履约模式 <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <RadioGroup
                              value={field.value ?? 'SUPPLIER_ONLY'}
                              onValueChange={value =>
                                field.onChange(value as TransferFulfillmentMode)
                              }
                              className="grid gap-3 md:grid-cols-2"
                            >
                              <div className="border-border flex items-start gap-2 rounded-md border bg-white/80 p-3 shadow-sm">
                                <RadioGroupItem
                                  value="SUPPLIER_ONLY"
                                  id="transfer-mode-supplier"
                                  className="mt-0.5"
                                />
                                <div className="space-y-1">
                                  <Label
                                    htmlFor="transfer-mode-supplier"
                                    className="cursor-pointer text-sm font-medium text-gray-700"
                                  >
                                    {TRANSFER_MODE_LABELS.SUPPLIER_ONLY}
                                  </Label>
                                  <p className="text-xs text-gray-500">
                                    订单全部由供应商调货发出，本地仓无需参与。
                                  </p>
                                </div>
                              </div>
                              <div className="border-border flex items-start gap-2 rounded-md border bg-white/80 p-3 shadow-sm">
                                <RadioGroupItem
                                  value="MIXED"
                                  id="transfer-mode-mixed"
                                  className="mt-0.5"
                                />
                                <div className="space-y-1">
                                  <Label
                                    htmlFor="transfer-mode-mixed"
                                    className="cursor-pointer text-sm font-medium text-gray-700"
                                  >
                                    {TRANSFER_MODE_LABELS.MIXED}
                                  </Label>
                                  <p className="text-xs text-gray-500">
                                    本地仓与供应商共同完成发货，可在订单明细中拆分数量。
                                  </p>
                                </div>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />

                    {/* 供应商选择 */}
                    <FormField
                      control={form.control}
                      name="supplierId"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-sm font-medium text-gray-700">
                            供应商/调出方{' '}
                            <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <SupplierSelector
                              suppliers={suppliersData?.data || []}
                              value={field.value}
                              onValueChange={field.onChange}
                              placeholder="搜索并选择供应商"
                              disabled={suppliersLoading}
                              isLoading={suppliersLoading}
                              onSupplierCreated={handleSupplierCreated}
                              onRefreshSuppliers={() => {
                                queryClient.invalidateQueries({
                                  queryKey: suppliersQueryKey,
                                });
                                queryClient.refetchQueries({
                                  queryKey: suppliersQueryKey,
                                });
                              }}
                              className="h-9"
                            />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <OrderItemsSection
            fields={fields}
            remove={remove}
            onAddItem={addOrderItem}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
            products={productsData?.data || []}
            orderType={orderType}
            transferMode={transferMode}
            unitMapping={UNIT_MAPPING}
            form={form}
            selectedCustomerId={selectedCustomerId}
            priceHistory={priceHistoryData?.data}
            priceType={priceType}
            toast={toast}
          />

          {/* 费用项管理 */}
          <div className="bg-card rounded border">
            <div className="bg-muted/30 border-b px-3 py-2">
              <h3 className="text-sm font-medium">费用项管理</h3>
            </div>
            <div className="space-y-3 p-3">
              <div className="flex items-center justify-between rounded border bg-amber-50/60 px-3 py-2">
                <span className="text-muted-foreground text-xs">费用合计</span>
                <span className="text-sm font-semibold text-amber-600">
                  ￥{formatCurrency(additionalFees)}
                </span>
              </div>
              <FeeItemsInput
                feeItems={feeItems}
                onChange={next =>
                  form.setValue('feeItems', next, {
                    shouldDirty: true,
                    shouldValidate: false,
                  })
                }
                disabled={createMutation.isPending || updateMutation.isPending}
              />
            </div>
          </div>

          {/* 预收款冲抵 */}
          <div className="bg-card rounded border">
            <div className="bg-muted/30 border-b px-3 py-2">
              <h3 className="text-sm font-medium">预收款冲抵</h3>
            </div>
            <div className="p-3">
              <PrepaymentSection
                form={form}
                customerId={form.watch('customerId')}
                orderTotal={orderTotalWithFees}
                disabled={createMutation.isPending || updateMutation.isPending}
              />
            </div>
          </div>

          {/* ERP标准布局：汇总信息 */}
          <div className="bg-card rounded border">
            <div className="bg-muted/30 border-b px-3 py-2">
              <h3 className="text-sm font-medium">汇总信息</h3>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                <div className="flex items-center justify-between rounded border bg-blue-50/50 px-3 py-2">
                  <span className="text-muted-foreground text-xs">
                    产品种类
                  </span>
                  <span className="text-sm font-semibold text-blue-600">
                    {fields.length} 种
                  </span>
                </div>
                <div className="flex items-center justify-between rounded border bg-green-50/50 px-3 py-2">
                  <span className="text-muted-foreground text-xs">总数量</span>
                  <span className="text-sm font-semibold text-green-600">
                    {watchedItems
                      .reduce((sum, item) => sum + (item.quantity || 0), 0)
                      .toLocaleString('zh-CN', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}{' '}
                    片
                  </span>
                </div>
                <div className="flex items-center justify-between rounded border bg-purple-50/50 px-3 py-2">
                  <span className="text-muted-foreground text-xs">总重量</span>
                  <span className="text-sm font-semibold text-purple-600">
                    {formatWeight(totalWeight)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded border bg-orange-50/50 px-3 py-2">
                  <span className="text-muted-foreground text-xs">
                    产品金额
                  </span>
                  <span className="text-lg font-bold text-orange-600">
                    ￥{formatCurrency(totalAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded border bg-amber-50/60 px-3 py-2">
                  <span className="text-muted-foreground text-xs">
                    额外费用
                  </span>
                  <span className="text-sm font-semibold text-amber-600">
                    ￥{formatCurrency(additionalFees)}
                  </span>
                </div>
                {Math.abs(roundingAdjustment) > 0.0001 && (
                  <div className="flex items-center justify-between rounded border bg-slate-50 px-3 py-2">
                    <span className="text-muted-foreground text-xs">
                      抹零调整
                    </span>
                    <span className="text-sm font-semibold text-slate-700">
                      ￥{formatCurrency(roundingAdjustment)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between rounded border bg-orange-100 px-3 py-2">
                  <span className="text-muted-foreground text-xs">
                    订单总金额
                  </span>
                  <span className="text-lg font-bold text-orange-700">
                    ￥{formatCurrency(orderTotalWithFees)}
                  </span>
                </div>

                {orderType === 'TRANSFER' && (
                  <div className="flex items-center justify-between rounded border bg-sky-50 px-3 py-2">
                    <span className="text-muted-foreground text-xs">
                      履约模式
                    </span>
                    <span className="text-sm font-semibold text-sky-700">
                      {transferMode
                        ? TRANSFER_MODE_LABELS[transferMode]
                        : TRANSFER_MODE_LABELS.SUPPLIER_ONLY}
                    </span>
                  </div>
                )}
                {orderType === 'TRANSFER' && (
                  <div className="flex items-center justify-between rounded border bg-sky-50/80 px-3 py-2">
                    <span className="text-muted-foreground text-xs">
                      调货数量
                    </span>
                    <span className="text-sm font-semibold text-sky-700">
                      {formatPieces(totalTransferQuantity)}
                    </span>
                  </div>
                )}
                {orderType === 'TRANSFER' && transferMode === 'MIXED' && (
                  <div className="flex items-center justify-between rounded border bg-emerald-50/70 px-3 py-2">
                    <span className="text-muted-foreground text-xs">
                      本地发货数量
                    </span>
                    <span className="text-sm font-semibold text-emerald-700">
                      {formatPieces(totalLocalQuantity)}
                    </span>
                  </div>
                )}

                {/* 调货销售财务汇总 */}
                {orderType === 'TRANSFER' && (
                  <div className="flex items-center justify-between rounded border bg-blue-50/50 px-3 py-2">
                    <span className="text-muted-foreground text-xs">
                      总成本
                    </span>
                    <span className="text-sm font-semibold text-blue-600">
                      ￥
                      {formatCurrency(
                        watchedItems.reduce((sum, item) => {
                          const unitCost = Number(item.unitCost) || 0;
                          const effectiveQuantity =
                            transferMode === 'MIXED'
                              ? Number(item.transferQuantity) || 0
                              : Number(item.quantity) || 0;
                          return sum + unitCost * effectiveQuantity;
                        }, 0)
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 库存检查 */}
          {watchedItems.length > 0 && (
            <InventoryChecker
              items={inventoryCheckItems}
              products={productsData?.data || []}
              onInventoryCheck={() => {
                // 处理库存检查结果
              }}
            />
          )}

          {/* ERP标准布局：操作按钮 */}
          <div className="bg-card sticky bottom-0 rounded border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onCancel?.() || router.back()}
                  disabled={createMutation.isPending}
                  className="h-8 text-xs"
                >
                  取消
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    createMutation.isPending ||
                    updateMutation.isPending ||
                    !form.watch('customerId')
                  }
                  className="h-8 text-xs"
                  onClick={() => submitWithStatus('draft')}
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="mr-1 h-3 w-3" />
                  )}
                  {mode === 'edit' ? '更新草稿' : '保存草稿'}
                </Button>
                <Button
                  type="button"
                  disabled={
                    createMutation.isPending ||
                    updateMutation.isPending ||
                    fields.length === 0 ||
                    !form.watch('customerId')
                  }
                  className="h-8 text-xs"
                  onClick={() => submitWithStatus('confirmed')}
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="mr-1 h-3 w-3" />
                  )}
                  {mode === 'edit' ? '更新并确认' : '提交订单'}
                </Button>
              </div>
            </div>

            <div className="mt-2 text-center">
              <p className="text-xs text-gray-500">
                保存草稿：可随时修改；提交订单：确认后进入处理流程
              </p>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
