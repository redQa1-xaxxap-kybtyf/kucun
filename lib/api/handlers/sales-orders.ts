import type { Prisma } from '@prisma/client';
import type { z } from 'zod';

import { prisma } from '@/lib/db';
import { getLongTransactionOptions } from '@/lib/db/transaction-options';
import { generateSalesOrderNumber } from '@/lib/services/simple-order-number-generator';
import type {
  SalesOrderStatus,
  SalesOrderType,
  SalesOrderQueryParams as StandardSalesOrderQueryParams,
} from '@/lib/types/sales-order';
import {
  salesOrderCreateSchema,
  salesOrderQuerySchema as standardSalesOrderQuerySchema,
} from '@/lib/validations/sales-order';

/**
 * 使用标准的销售订单查询参数验证
 * 统一使用 lib/validations/sales-order.ts 中的定义
 */
export const salesOrderQuerySchema = standardSalesOrderQuerySchema;
export type SalesOrderQueryParams = StandardSalesOrderQueryParams;

/**
 * 获取销售订单列表
 */
export async function getSalesOrders(params: SalesOrderQueryParams) {
  const {
    page = 1,
    limit = 20,
    search,
    sortBy,
    sortOrder,
    status,
    customerId,
    startDate,
    endDate,
  } = params;

  const skip = (page - 1) * limit;

  // 构建查询条件
  const where: Prisma.SalesOrderWhereInput = {};

  // 搜索条件 (MySQL 默认不区分大小写)
  if (search) {
    where.OR = [
      { orderNumber: { contains: search } },
      { customer: { name: { contains: search } } },
      { remarks: { contains: search } },
    ];
  }

  if (status) {
    where.status = status;
  }

  if (customerId) {
    where.customerId = customerId;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      // 开始日期：当天的00:00:00
      where.createdAt.gte = new Date(startDate + 'T00:00:00');
    }
    if (endDate) {
      // 结束日期：当天的23:59:59
      where.createdAt.lte = new Date(endDate + 'T23:59:59');
    }
  }

  // 构建排序条件
  const orderBy: Prisma.SalesOrderOrderByWithRelationInput = {};
  // 注释掉不支持的排序字段
  // if (sortBy === 'customerName') {
  //   orderBy.customer = { name: sortOrder };
  if (sortBy === 'totalAmount') {
    orderBy.totalAmount = sortOrder;
  } else {
    orderBy[sortBy as keyof Prisma.SalesOrderOrderByWithRelationInput] =
      sortOrder;
  }

  // 执行查询
  const [orders, total] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        userId: true,
        supplierId: true,
        status: true,
        orderType: true,
        costAmount: true,
        profitAmount: true,
        totalAmount: true,
        remarks: true,
        shippedAt: true,
        createdAt: true,
        updatedAt: true,
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          select: {
            id: true,
            salesOrderId: true,
            productId: true,
            displayUnit: true,
            displayQuantity: true,
            piecesPerUnit: true,
            specification: true,
            remarks: true,
            batchNumber: true,
            colorCode: true,
            productionDate: true,
            quantity: true,
            unitPrice: true,
            subtotal: true,
            unitCost: true,
            profitAmount: true,
            isManualProduct: true,
            manualProductName: true,
            manualSpecification: true,
            manualWeight: true,
            manualUnit: true,
            product: {
              select: {
                id: true,
                name: true,
                code: true,
                unit: true,
                specification: true,
                piecesPerUnit: true,
                weight: true,
              },
            },
          },
        },
        payments: {
          where: {
            status: 'confirmed',
          },
          select: {
            paymentAmount: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    }),
    prisma.salesOrder.count({ where }),
  ]);

  return {
    data: orders.map(order => {
      const { _count, payments, ...orderData } = order;
      // 计算已收款金额
      const paidAmount = payments.reduce(
        (sum, payment) => sum + Number(payment.paymentAmount),
        0
      );
      // 计算待收款金额
      const remainingAmount = Number(orderData.totalAmount) - paidAmount;

      return {
        ...orderData,
        status: orderData.status as SalesOrderStatus,
        orderType: orderData.orderType as SalesOrderType,
        supplierId: orderData.supplierId ?? undefined,
        costAmount: orderData.costAmount ?? undefined,
        profitAmount: orderData.profitAmount ?? undefined,
        remarks: orderData.remarks ?? undefined,
        shippedAt: orderData.shippedAt
          ? orderData.shippedAt.toISOString()
          : undefined,
        createdAt: orderData.createdAt.toISOString(),
        updatedAt: orderData.updatedAt.toISOString(),
        itemCount: _count.items,
        paidAmount,
        remainingAmount,
      };
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * 根据ID获取销售订单详情
 */
export async function getSalesOrderById(id: string) {
  const order = await prisma.salesOrder.findUnique({
    where: { id },
    select: {
      id: true,
      orderNumber: true,
      customerId: true,
      userId: true,
      supplierId: true,
      status: true,
      orderType: true,
      costAmount: true,
      profitAmount: true,
      totalAmount: true,
      remarks: true,
      createdAt: true,
      updatedAt: true,
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
        },
      },
      supplier: {
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
        },
      },
      items: {
        select: {
          id: true,
          salesOrderId: true,
          productId: true,
          displayUnit: true,
          displayQuantity: true,
          piecesPerUnit: true,
          specification: true,
          remarks: true,
          batchNumber: true,
          colorCode: true,
          productionDate: true,
          quantity: true,
          unitPrice: true,
          subtotal: true,
          unitCost: true,
          profitAmount: true,
          isManualProduct: true,
          manualProductName: true,
          manualSpecification: true,
          manualWeight: true,
          manualUnit: true,
          product: {
            select: {
              id: true,
              name: true,
              code: true,
              unit: true,
              specification: true,
              piecesPerUnit: true,
              weight: true,
            },
          },
        },
      },
      _count: {
        select: {
          items: true,
        },
      },
    },
  });

  if (!order) {
    return null;
  }

  const { _count, items, createdAt, updatedAt, ...rest } = order;

  return {
    ...rest,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    items: items.map(item => ({
      ...item,
      batchNumber: item.batchNumber ?? undefined,
      productionDate: item.productionDate
        ? typeof item.productionDate === 'string'
          ? item.productionDate
          : (item.productionDate as Date).toISOString()
        : undefined,
      displayUnit: item.displayUnit || undefined,
      displayQuantity: item.displayQuantity ?? undefined,
      piecesPerUnit:
        item.piecesPerUnit ?? item.product?.piecesPerUnit ?? undefined,
      specification:
        item.specification ||
        (item.isManualProduct
          ? item.manualSpecification || undefined
          : item.product?.specification || undefined),
      remarks: item.remarks ?? undefined,
      product: item.product ? { ...item.product } : undefined,
    })),
    itemCount: _count.items,
  };
}

/**
 * 自动冲抵预收款 (FIFO策略)
 * @param tx Prisma事务对象
 * @param customerId 客户ID
 * @param orderTotal 订单总额
 * @param specifiedAmount 手动指定冲抵金额(可选)
 * @returns 冲抵结果 { totalApplied: 总冲抵金额, records: 冲抵记录详情 }
 */
async function applyPrepaymentToOrder(
  tx: Prisma.TransactionClient,
  customerId: string,
  orderTotal: number,
  specifiedAmount?: number
): Promise<{
  totalApplied: number;
  records: Array<{ id: string; amount: number }>;
}> {
  // 查询客户可用的预收款(按FIFO策略,最早的先冲抵)
  const prepayments = await tx.paymentRecord.findMany({
    where: {
      customerId,
      paymentType: 'prepayment',
      status: { in: ['confirmed', 'applied'] }, // 已确认或部分已冲抵的预收款
    },
    orderBy: { paymentDate: 'asc' }, // FIFO: 按付款日期升序
  });

  // 过滤出有剩余可用金额的预收款
  const availablePrepayments = prepayments.filter(
    p => p.paymentAmount - p.appliedAmount > 0
  );

  if (availablePrepayments.length === 0) {
    return { totalApplied: 0, records: [] };
  }

  // 计算需要冲抵的金额
  const targetAmount = specifiedAmount
    ? Math.min(specifiedAmount, orderTotal)
    : orderTotal;

  let remainingAmount = targetAmount;
  const appliedRecords: Array<{ id: string; amount: number }> = [];

  // 逐个冲抵预收款(FIFO)
  for (const prepayment of availablePrepayments) {
    if (remainingAmount <= 0) {
      break;
    }

    const availableAmount = prepayment.paymentAmount - prepayment.appliedAmount;
    const applyAmount = Math.min(availableAmount, remainingAmount);

    // 更新预收款已冲抵金额
    await tx.paymentRecord.update({
      where: { id: prepayment.id },
      data: {
        appliedAmount: { increment: applyAmount },
        status:
          prepayment.appliedAmount + applyAmount >= prepayment.paymentAmount
            ? 'applied' // 全部冲抵完成
            : 'confirmed', // 部分冲抵
      },
    });

    appliedRecords.push({ id: prepayment.id, amount: applyAmount });
    remainingAmount -= applyAmount;
  }

  return {
    totalApplied: targetAmount - remainingAmount,
    records: appliedRecords,
  };
}

/**
 * 创建销售订单
 */
export async function createSalesOrder(
  data: z.infer<typeof salesOrderCreateSchema>,
  userId: string
) {
  // 验证数据
  const validatedData = salesOrderCreateSchema.parse(data);

  // 生成订单号 - 使用新的安全生成服务
  const orderNumber = await generateSalesOrderNumber();

  // 计算订单金额
  let totalAmount = 0;
  let costAmount = 0;
  let profitAmount = 0;

  for (const item of validatedData.items) {
    const itemSubtotal =
      item.subtotal || (item.quantity ?? 0) * (item.unitPrice ?? 0);
    const itemCost = (item.unitCost || 0) * (item.quantity ?? 0);

    totalAmount += itemSubtotal;
    costAmount += itemCost;
    profitAmount += itemSubtotal - itemCost; // 正确计算：销售额 - 成本
  }

  // 使用事务创建订单，确保数据一致性
  const order = await prisma.$transaction(
    async tx => {
      // 验证客户是否存在
      const customer = await tx.customer.findUnique({
        where: { id: validatedData.customerId },
        select: { id: true },
      });
      if (!customer) {
        throw new Error('指定的客户不存在');
      }

      // 如果有供应商，验证供应商是否存在
      if (validatedData.supplierId) {
        const supplier = await tx.supplier.findUnique({
          where: { id: validatedData.supplierId },
          select: { id: true },
        });
        if (!supplier) {
          throw new Error('指定的供应商不存在');
        }
      }

      // ✅ 性能优化1: 批量验证产品是否存在（对于非手动输入的产品）
      // 优化前：N次查询（N=订单项数量），10个订单项=10次查询
      // 优化后：1次批量查询，10个订单项=1次查询（减少90%）
      const productIds = validatedData.items
        .filter(item => !item.isManualProduct && item.productId)
        .map(item => item.productId!)
        .filter((id, index, self) => self.indexOf(id) === index); // 去重：相同产品ID只查询一次

      if (productIds.length > 0) {
        // 批量查询所有产品
        const products = await tx.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true },
        });

        // 构建已存在的产品ID集合，用于O(1)查找
        const existingProductIds = new Set(products.map(p => p.id));

        // 验证所有产品都存在
        for (const productId of productIds) {
          if (!existingProductIds.has(productId)) {
            throw new Error(`产品ID ${productId} 不存在`);
          }
        }
      }

      // ✅ 性能优化2: 批量查询和预留库存（如果订单状态为confirmed）
      // 优化前：N次库存查询 + N次库存更新，10个订单项=20次数据库操作
      // 优化后：1次批量查询 + N次更新（Map缓存），10个订单项=11次操作（减少45%）
      if (validatedData.status === 'confirmed') {
        const reservationTargets = validatedData.items
          .filter(item => !item.isManualProduct && item.productId)
          .map(item => ({
            productId: item.productId as string,
            batchNumber: item.batchNumber ?? null,
          }));

        if (reservationTargets.length > 0) {
          const uniqueProductIds = Array.from(
            new Set(reservationTargets.map(target => target.productId))
          );

          const inventories = await tx.inventory.findMany({
            where: {
              productId: { in: uniqueProductIds },
            },
          });

          const normalizeBatchNumber = (value?: string | null) =>
            value ? value.trim() : '';
          const buildInventoryKey = (
            productId: string,
            batchNumber?: string | null
          ) => `${productId}::${normalizeBatchNumber(batchNumber)}`;

          const inventoryByKey = new Map<
            string,
            (typeof inventories)[number]
          >();
          const inventoryByProduct = new Map<
            string,
            Array<(typeof inventories)[number]>
          >();

          for (const inv of inventories) {
            const key = buildInventoryKey(inv.productId, inv.batchNumber);
            inventoryByKey.set(key, inv);
            const bucket = inventoryByProduct.get(inv.productId) ?? [];
            bucket.push(inv);
            inventoryByProduct.set(inv.productId, bucket);
          }

          const localReservation = new Map<string, number>();

          for (const item of validatedData.items) {
            if (item.isManualProduct || !item.productId) {
              continue;
            }

            const batchKey = buildInventoryKey(
              item.productId,
              item.batchNumber ?? null
            );
            const candidates = inventoryByProduct.get(item.productId) ?? [];
            let inventory = inventoryByKey.get(batchKey);

            if (!inventory && item.batchNumber) {
              const normalizedTarget = normalizeBatchNumber(item.batchNumber);
              inventory = candidates.find(
                candidate =>
                  normalizeBatchNumber(candidate.batchNumber) ===
                  normalizedTarget
              );
            }

            if (!inventory) {
              if (candidates.length === 0) {
                throw new Error(`产品ID ${item.productId} 库存记录不存在`);
              }
              if (candidates.length > 1) {
                throw new Error(
                  `产品ID ${item.productId} 存在多个库存批次，请在订单明细中指定批次号`
                );
              }
              inventory = candidates[0];
            }

            if (!inventory) {
              throw new Error(`产品ID ${item.productId} 库存记录不存在`);
            }

            inventoryByKey.set(batchKey, inventory);

            const reservationKey = buildInventoryKey(
              inventory.productId,
              inventory.batchNumber
            );
            const pendingReservation =
              localReservation.get(reservationKey) ?? 0;
            const effectiveReserved =
              inventory.reservedQuantity + pendingReservation;
            const availableQuantity = inventory.quantity - effectiveReserved;

            const batchLabel = normalizeBatchNumber(
              item.batchNumber ?? inventory.batchNumber ?? null
            );
            const batchMessage = batchLabel ? ` (批次: ${batchLabel})` : '';

            const itemQuantity = item.quantity ?? 0;
            if (availableQuantity < itemQuantity) {
              throw new Error(
                `产品ID ${item.productId}${batchMessage} 可用库存不足。可用: ${availableQuantity}, 需要: ${itemQuantity}`
              );
            }

            const expectedReserved =
              inventory.reservedQuantity + pendingReservation;
            const updatedCount = await tx.inventory.updateMany({
              where: {
                id: inventory.id,
                reservedQuantity: expectedReserved,
                quantity: { gte: expectedReserved + itemQuantity },
              },
              data: {
                reservedQuantity: { increment: itemQuantity },
              },
            });

            if (updatedCount.count === 0) {
              throw new Error(
                `产品ID ${item.productId}${batchMessage} 库存预留失败,可能已被其他订单占用,请重试`
              );
            }

            localReservation.set(
              reservationKey,
              pendingReservation + itemQuantity
            );
          }
        }
      }

      // 计算额外费用总额
      const additionalFees =
        validatedData.feeItems?.reduce((sum, fee) => sum + fee.feeAmount, 0) ||
        0;

      // 创建订单
      const salesOrder = await tx.salesOrder.create({
        data: {
          orderNumber,
          customerId: validatedData.customerId,
          userId,
          supplierId: validatedData.supplierId,
          status: validatedData.status || 'draft',
          orderType: validatedData.orderType,
          costAmount,
          profitAmount,
          itemsAmount: totalAmount,
          additionalFees,
          totalAmount: totalAmount + additionalFees,
          remarks: validatedData.remarks,
          items: {
            create: validatedData.items.map(item => ({
              productId: item.productId,
              batchNumber: item.batchNumber || null,
              colorCode: item.colorCode,
              productionDate: item.productionDate,
              quantity: item.quantity ?? 0,
              unitPrice: item.unitPrice ?? 0,
              subtotal: item.subtotal ?? 0,
              unitCost: item.unitCost,
              displayUnit: item.displayUnit || '片',
              displayQuantity: item.displayQuantity ?? item.quantity ?? 0,
              piecesPerUnit: item.piecesPerUnit ?? null,
              specification: item.specification || null,
              remarks: item.remarks || null,
              // costSubtotal: item.costSubtotal, // 属性不存在
              // profitAmount: item.profitAmount, // 属性不存在
              isManualProduct: item.isManualProduct,
              manualProductName: item.manualProductName,
              manualSpecification: item.manualSpecification,
              manualWeight: item.manualWeight,
              manualUnit: item.manualUnit,
            })),
          },
          feeItems: {
            create:
              validatedData.feeItems?.map(fee => ({
                feeType: fee.feeType,
                feeName: fee.feeName,
                feeAmount: fee.feeAmount,
                remarks: fee.remarks || null,
              })) || [],
          },
        },
        select: {
          id: true,
          orderNumber: true,
          customerId: true,
          userId: true,
          supplierId: true,
          status: true,
          orderType: true,
          costAmount: true,
          profitAmount: true,
          totalAmount: true,
          paidAmount: true,
          remarks: true,
          createdAt: true,
          updatedAt: true,
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
            },
          },
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
          items: {
            select: {
              id: true,
              salesOrderId: true,
              productId: true,
              displayUnit: true,
              displayQuantity: true,
              piecesPerUnit: true,
              specification: true,
              remarks: true,
              batchNumber: true,
              colorCode: true,
              productionDate: true,
              quantity: true,
              unitPrice: true,
              subtotal: true,
              unitCost: true,
              profitAmount: true,
              isManualProduct: true,
              manualProductName: true,
              manualSpecification: true,
              manualWeight: true,
              manualUnit: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  unit: true,
                  specification: true,
                  piecesPerUnit: true,
                  weight: true,
                },
              },
            },
          },
          _count: {
            select: {
              items: true,
            },
          },
        },
      });

      // ✅ 性能优化3: 批量插入客户产品价格历史（仅记录非手动输入的产品）
      // 优化前：N次单独插入，10个订单项=10次INSERT操作
      // 优化后：1次批量插入，10个订单项=1次INSERT操作（减少90%）
      const priceType =
        validatedData.orderType === 'NORMAL' ? 'SALES' : 'FACTORY';

      // 收集所有需要记录的价格数据
      const priceRecords = validatedData.items
        .filter(
          item => !item.isManualProduct && item.productId && item.unitPrice
        )
        .map(item => ({
          customerId: validatedData.customerId,
          productId: item.productId!,
          priceType,
          unitPrice: item.unitPrice!,
          orderId: salesOrder.id,
          orderType: 'SALES_ORDER' as const,
        }));

      // 批量插入所有价格记录（SQLite 不支持 skipDuplicates，改用逐条插入）
      if (priceRecords.length > 0) {
        for (const record of priceRecords) {
          try {
            await tx.customerProductPrice.create({
              data: record,
            });
          } catch (error) {
            // 忽略重复记录错误（唯一索引冲突）
            console.debug('价格记录已存在，跳过');
          }
        }
      }

      // 如果是调货销售且状态为confirmed，自动创建应付款记录
      if (
        validatedData.orderType === 'TRANSFER' &&
        validatedData.supplierId &&
        costAmount > 0 &&
        validatedData.status === 'confirmed'
      ) {
        // 生成应付款单号
        const payableNumber = `PAY-${Date.now()}-${salesOrder.id.slice(-6)}`;

        // 计算应付款到期日期（默认30天后）
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        // 创建应付款记录
        await tx.payableRecord.create({
          data: {
            payableNumber,
            supplierId: validatedData.supplierId,
            userId,
            sourceType: 'sales_order',
            sourceId: salesOrder.id,
            sourceNumber: salesOrder.orderNumber,
            payableAmount: costAmount,
            remainingAmount: costAmount,
            dueDate,
            status: 'pending',
            paymentTerms: '30天',
            description: `调货销售订单 ${salesOrder.orderNumber} 自动生成应付款`,
            remarks: `关联销售订单：${salesOrder.orderNumber}，成本金额：¥${costAmount.toFixed(2)}`,
          },
        });
      }

      // ✅ 自动冲抵预收款
      if (validatedData.usePrepayment) {
        const prepaymentResult = await applyPrepaymentToOrder(
          tx,
          validatedData.customerId,
          totalAmount,
          validatedData.prepaymentAmount ?? undefined
        );

        // 更新订单已付金额
        if (prepaymentResult.totalApplied > 0) {
          await tx.salesOrder.update({
            where: { id: salesOrder.id },
            data: {
              paidAmount: prepaymentResult.totalApplied,
            },
          });

          // 更新返回的订单对象
          salesOrder.paidAmount = prepaymentResult.totalApplied;
        }
      }

      return salesOrder;
    },
    getLongTransactionOptions() // 根据数据库类型自动配置事务选项（SQLite默认串行化，MySQL/PostgreSQL使用Serializable，15秒超时）
  );

  const { _count, items, createdAt, updatedAt, ...rest } = order;

  return {
    ...rest,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    items: items.map(item => ({
      ...item,
      batchNumber: item.batchNumber ?? undefined,
      productionDate: item.productionDate
        ? typeof item.productionDate === 'string'
          ? item.productionDate
          : (item.productionDate as Date).toISOString()
        : undefined,
      displayUnit: item.displayUnit || undefined,
      displayQuantity: item.displayQuantity ?? undefined,
      piecesPerUnit:
        item.piecesPerUnit ?? item.product?.piecesPerUnit ?? undefined,
      specification:
        item.specification ||
        (item.isManualProduct
          ? item.manualSpecification || undefined
          : item.product?.specification || undefined),
      remarks: item.remarks ?? undefined,
      product: item.product ? { ...item.product } : undefined,
    })),
    itemCount: _count.items,
  };
}

// 订单号生成逻辑已移至 lib/services/order-number-generator.ts
// 使用数据库序列表保证并发安全
