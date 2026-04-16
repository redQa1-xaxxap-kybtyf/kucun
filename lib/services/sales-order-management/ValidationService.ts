// @ts-nocheck

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

import {
  COST_PRICE_MAX,
  COST_PRICE_MAX_LABEL,
  formatCostPrice,
  hasAtMostCostPriceDecimals,
} from '@/lib/utils/cost-price';

const prisma = new PrismaClient();

// 数据验证模式
export const OrderValidationSchema = z.object({
  customerId: z.string().uuid('客户信息格式无效'),
  userId: z.string().uuid('用户编号格式无效'),
  items: z
    .array(
      z.object({
        productId: z.string().uuid('产品信息格式无效').optional(),
        variantId: z.string().uuid('规格信息格式无效').optional(),
        quantity: z.number().positive('数量必须大于0'),
        unitPrice: z.number().min(0, '单价不能为负数'),
        unitCost: z
          .number()
          .min(0, '成本不能为负数')
          .max(COST_PRICE_MAX, `成本不能超过${COST_PRICE_MAX_LABEL}`)
          .refine(hasAtMostCostPriceDecimals, '成本最多保留3位小数')
          .optional(),
      })
    )
    .min(1, '订单必须包含至少一个商品'),
  totalAmount: z.number().min(0, '订单总金额不能为负数'),
});

export const InventoryReservationSchema = z.object({
  productId: z.string().uuid('产品信息格式无效'),
  variantId: z.string().uuid('规格信息格式无效').optional(),
  quantity: z.number().positive('预留数量必须大于0'),
  expirationHours: z.number().min(1).max(168).optional(), // 1小时到7天
});

export const ExpenseCalculationSchema = z.object({
  expenseTypeCode: z.string().min(1, '费用类型代码不能为空'),
  baseAmount: z.number().min(0, '基础金额不能为负数').optional(),
  quantity: z.number().positive('数量必须大于0').optional(),
  weight: z.number().positive('重量必须大于0').optional(),
  customRate: z.number().min(0, '自定义费率不能为负数').optional(),
});

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface BusinessRuleValidation {
  ruleName: string;
  passed: boolean;
  message: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
}

export class ValidationService {
  /**
   * 验证订单数据
   */
  public async validateOrderData(orderData: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 基础数据格式验证
      OrderValidationSchema.parse(orderData);
    } catch (error: any) {
      if (error.errors) {
        errors.push(...error.errors.map((e: any) => e.message));
      }
    }

    // 业务规则验证
    const businessRules = await this.validateBusinessRules(orderData);
    businessRules.forEach(rule => {
      if (!rule.passed) {
        if (rule.severity === 'ERROR') {
          errors.push(rule.message);
        } else if (rule.severity === 'WARNING') {
          warnings.push(rule.message);
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 验证业务规则
   */
  private async validateBusinessRules(
    orderData: any
  ): Promise<BusinessRuleValidation[]> {
    const rules: BusinessRuleValidation[] = [];

    // 规则1: 客户存在性验证
    if (orderData.customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: orderData.customerId },
      });
      rules.push({
        ruleName: 'customer_exists',
        passed: !!customer,
        message: customer ? '客户验证通过' : '客户不存在',
        severity: customer ? 'INFO' : 'ERROR',
      });
    }

    // 规则2: 产品存在性验证
    if (orderData.items) {
      for (const item of orderData.items) {
        if (item.productId) {
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
          });
          rules.push({
            ruleName: 'product_exists',
            passed: !!product && product.status === 'active',
            message: product
              ? product.status === 'active'
                ? '产品验证通过'
                : '产品已停用'
              : '产品不存在',
            severity: product && product.status === 'active' ? 'INFO' : 'ERROR',
          });
        }
      }
    }

    // 规则3: 库存充足性验证
    if (orderData.items) {
      for (const item of orderData.items) {
        if (item.productId && item.quantity) {
          const inventory = await prisma.inventory.findFirst({
            where: {
              productId: item.productId,
              variantId: item.variantId || null,
            },
          });

          const availableQuantity = inventory
            ? inventory.quantity - inventory.reservedQuantity
            : 0;

          rules.push({
            ruleName: 'inventory_sufficient',
            passed: availableQuantity >= item.quantity,
            message:
              availableQuantity >= item.quantity
                ? '库存充足'
                : `库存不足，可用: ${availableQuantity}，需要: ${item.quantity}`,
            severity: availableQuantity >= item.quantity ? 'INFO' : 'WARNING',
          });
        }
      }
    }

    // 规则4: 价格合理性验证（利润率 + 历史价偏离）
    if (orderData.items && orderData.customerId) {
      const priceType =
        orderData.orderType === 'TRANSFER' ? 'FACTORY' : 'SALES';

      const productIds = Array.from(
        new Set(
          orderData.items
            .filter((item: any) => item.productId)
            .map((item: any) => item.productId)
        )
      ) as string[];

      const priceMap = new Map<string, number>();

      if (productIds.length > 0) {
        const priceRecords = await prisma.customerProductPrice.findMany({
          where: {
            customerId: orderData.customerId,
            productId: { in: productIds },
            priceType,
          },
          orderBy: { createdAt: 'desc' },
          select: { productId: true, unitPrice: true },
        });

        for (const record of priceRecords) {
          if (priceMap.has(record.productId)) {
            continue;
          }
          priceMap.set(record.productId, Number(record.unitPrice));
        }
      }

      for (const item of orderData.items) {
        const unitPrice = Number(item.unitPrice ?? 0);
        const unitCost =
          item.unitCost !== undefined && item.unitCost !== null
            ? Number(item.unitCost)
            : null;

        if (unitPrice === 0) {
          rules.push({
            ruleName: 'unit_price_non_zero',
            passed: false,
            message: '单价为 0，请确认是否为正常售价',
            severity: 'WARNING',
          });
          continue;
        }

        if (unitPrice < 0) {
          rules.push({
            ruleName: 'unit_price_non_negative',
            passed: false,
            message: '单价不能为负数',
            severity: 'ERROR',
          });
          continue;
        }

        if (unitCost !== null && Number.isFinite(unitCost) && unitPrice > 0) {
          const margin = (unitPrice - unitCost) / unitPrice;
          rules.push({
            ruleName: 'price_margin_check',
            passed: margin >= 0.05, // 最低5%利润率
            message:
              margin >= 0.05
                ? `利润率正常: ${(margin * 100).toFixed(2)}%`
                : `利润率过低: ${(margin * 100).toFixed(2)}%`,
            severity: margin >= 0.05 ? 'INFO' : 'WARNING',
          });

          rules.push({
            ruleName: 'price_not_below_cost',
            passed: unitPrice >= unitCost,
            message:
              unitPrice >= unitCost
                ? '售价高于成本'
                : `售价低于成本（售价: ${unitPrice.toFixed(2)}, 成本: ${formatCostPrice(unitCost, { withSymbol: false })}）`,
            severity: unitPrice >= unitCost ? 'INFO' : 'WARNING',
          });
        }

        const referencePrice = item.productId
          ? priceMap.get(item.productId)
          : undefined;

        if (referencePrice !== undefined && referencePrice > 0) {
          const deviation =
            Math.abs(unitPrice - referencePrice) / referencePrice;
          const maxDeviation = 0.5; // 允许 ±50% 偏离（仅提示，不阻断）

          rules.push({
            ruleName: 'customer_price_deviation',
            passed: deviation <= maxDeviation,
            message:
              deviation <= maxDeviation
                ? '售价与客户历史价一致'
                : `售价偏离客户历史价较大（历史价: ${referencePrice.toFixed(2)}, 当前: ${unitPrice.toFixed(2)}）`,
            severity: deviation <= maxDeviation ? 'INFO' : 'WARNING',
          });
        }
      }
    }

    // 规则5: 订单金额一致性验证
    // 口径：totalAmount 不包含抹零；应收 = totalAmount + roundingAdjustment
    if (
      orderData.items &&
      orderData.totalAmount !== undefined &&
      orderData.totalAmount !== null
    ) {
      const itemsAmount = orderData.items.reduce((sum: number, item: any) => {
        const quantity = Number(item.quantity ?? 0);
        const unitPrice = Number(item.unitPrice ?? 0);
        const subtotal =
          item.subtotal !== undefined && item.subtotal !== null
            ? Number(item.subtotal)
            : Math.round(quantity * unitPrice * 100) / 100;
        return sum + subtotal;
      }, 0);

      const additionalFees = Array.isArray(orderData.feeItems)
        ? orderData.feeItems.reduce((sum: number, fee: any) => {
            const paidBy = fee.paidBy ?? 'customer';
            if (paidBy === 'company') {
              return sum;
            }
            const amount = Number(fee.feeAmount ?? 0);
            return Number.isFinite(amount) ? sum + amount : sum;
          }, 0)
        : 0;

      const calculatedTotal =
        Math.round((itemsAmount + additionalFees) * 100) / 100;
      const expectedTotal =
        Math.round(Number(orderData.totalAmount) * 100) / 100;
      const difference = Math.abs(calculatedTotal - expectedTotal);

      rules.push({
        ruleName: 'amount_consistency',
        passed: difference < 0.01, // 允许1分钱的舍入误差
        message:
          difference < 0.01
            ? '订单金额一致'
            : `订单金额不一致，差额: ${difference.toFixed(2)}（计算值: ${calculatedTotal.toFixed(2)}, 订单值: ${expectedTotal.toFixed(2)}）`,
        severity: difference < 0.01 ? 'INFO' : 'ERROR',
      });
    }

    return rules;
  }

  /**
   * 验证库存预留请求
   */
  public async validateInventoryReservation(
    reservationData: any
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      InventoryReservationSchema.parse(reservationData);
    } catch (error: any) {
      if (error.errors) {
        errors.push(...error.errors.map((e: any) => e.message));
      }
    }

    // 检查产品是否存在
    if (reservationData.productId) {
      const product = await prisma.product.findUnique({
        where: { id: reservationData.productId },
      });
      if (!product) {
        errors.push('产品不存在');
      } else if (product.status !== 'active') {
        errors.push('产品已停用');
      }
    }

    // 检查库存可用性
    if (reservationData.productId && reservationData.quantity) {
      const inventory = await prisma.inventory.findFirst({
        where: {
          productId: reservationData.productId,
          variantId: reservationData.variantId || null,
        },
      });

      if (!inventory) {
        errors.push('产品库存不存在');
      } else {
        const availableQuantity =
          inventory.quantity - inventory.reservedQuantity;
        if (availableQuantity < reservationData.quantity) {
          errors.push(
            `库存不足，可用: ${availableQuantity}，需要: ${reservationData.quantity}`
          );
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 验证费用计算请求
   */
  public async validateExpenseCalculation(
    expenseData: any
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      ExpenseCalculationSchema.parse(expenseData);
    } catch (error: any) {
      if (error.errors) {
        errors.push(...error.errors.map((e: any) => e.message));
      }
    }

    // 检查费用类型是否存在
    if (expenseData.expenseTypeCode) {
      const expenseType = await prisma.expenseType.findUnique({
        where: { typeCode: expenseData.expenseTypeCode },
      });

      if (!expenseType) {
        errors.push('费用类型不存在');
      } else if (!expenseType.isActive) {
        errors.push('费用类型已停用');
      } else {
        // 验证计算方法所需的参数
        switch (expenseType.calculationMethod) {
          case 'PERCENTAGE':
            if (!expenseData.baseAmount) {
              errors.push('百分比计算需要提供基础金额');
            }
            break;
          case 'WEIGHT_BASED':
            if (!expenseData.weight) {
              errors.push('重量计算需要提供重量');
            }
            break;
          case 'QUANTITY_BASED':
            if (!expenseData.quantity) {
              errors.push('数量计算需要提供数量');
            }
            break;
          case 'MANUAL':
            if (!expenseData.customRate) {
              errors.push('手动计算需要提供自定义费率');
            }
            break;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
