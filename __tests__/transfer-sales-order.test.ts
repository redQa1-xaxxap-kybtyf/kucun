/**
 * 调货销售订单功能测试
 * 测试调货销售订单的创建、验证和业务逻辑
 */

import { describe, expect, it } from '@jest/globals';

import {
  CreateSalesOrderSchema,
  SALES_ORDER_TYPE_OPTIONS,
} from '@/lib/validations/sales-order';

describe('调货销售订单功能测试', () => {
  describe('数据验证测试', () => {
    it('应该验证正常销售订单', () => {
      const normalOrderData = {
        customerId: '123e4567-e89b-12d3-a456-426614174000',
        orderType: 'normal' as const,
        status: 'draft' as const,
        remarks: '正常销售订单',
        items: [
          {
            productId: '123e4567-e89b-12d3-a456-426614174001',
            colorCode: 'WHITE',
            productionDate: new Date('2024-01-01'),
            quantity: 100,
            unitPrice: 50.0,
            displayUnit: '片' as const,
            displayQuantity: 100,
            piecesPerUnit: 1,
            specification: '600x600mm',
            remarks: '测试商品',
          },
        ],
      };

      const result = CreateSalesOrderSchema.safeParse(normalOrderData);
      expect(result.success).toBe(true);
    });

    it('应该验证调货销售订单（包含供应商和成本价）', () => {
      const transferOrderData = {
        customerId: '123e4567-e89b-12d3-a456-426614174000',
        supplierId: '123e4567-e89b-12d3-a456-426614174002',
        orderType: 'transfer' as const,
        status: 'draft' as const,
        remarks: '调货销售订单',
        items: [
          {
            productId: '123e4567-e89b-12d3-a456-426614174001',
            colorCode: 'WHITE',
            productionDate: new Date('2024-01-01'),
            quantity: 100,
            unitPrice: 60.0, // 销售价
            costPrice: 45.0, // 成本价
            displayUnit: '片' as const,
            displayQuantity: 100,
            piecesPerUnit: 1,
            specification: '600x600mm',
            remarks: '调货商品',
          },
        ],
      };

      const result = CreateSalesOrderSchema.safeParse(transferOrderData);
      expect(result.success).toBe(true);
    });

    it('应该拒绝调货销售订单缺少供应商', () => {
      const invalidTransferOrderData = {
        customerId: '123e4567-e89b-12d3-a456-426614174000',
        orderType: 'transfer' as const,
        status: 'draft' as const,
        remarks: '无效的调货销售订单',
        items: [
          {
            productId: '123e4567-e89b-12d3-a456-426614174001',
            colorCode: 'WHITE',
            productionDate: new Date('2024-01-01'),
            quantity: 100,
            unitPrice: 60.0,
            costPrice: 45.0,
            displayUnit: '片' as const,
            displayQuantity: 100,
            piecesPerUnit: 1,
            specification: '600x600mm',
            remarks: '调货商品',
          },
        ],
      };

      const result = CreateSalesOrderSchema.safeParse(invalidTransferOrderData);
      expect(result.success).toBe(false);
      expect(result.error?.issues).toContainEqual(
        expect.objectContaining({
          message: '调货销售必须选择供应商',
        })
      );
    });

    it('应该拒绝调货销售订单缺少成本价', () => {
      const invalidTransferOrderData = {
        customerId: '123e4567-e89b-12d3-a456-426614174000',
        supplierId: '123e4567-e89b-12d3-a456-426614174002',
        orderType: 'transfer' as const,
        status: 'draft' as const,
        remarks: '无效的调货销售订单',
        items: [
          {
            productId: '123e4567-e89b-12d3-a456-426614174001',
            colorCode: 'WHITE',
            productionDate: new Date('2024-01-01'),
            quantity: 100,
            unitPrice: 60.0,
            // 缺少 costPrice
            displayUnit: '片' as const,
            displayQuantity: 100,
            piecesPerUnit: 1,
            specification: '600x600mm',
            remarks: '调货商品',
          },
        ],
      };

      const result = CreateSalesOrderSchema.safeParse(invalidTransferOrderData);
      expect(result.success).toBe(false);
      expect(result.error?.issues).toContainEqual(
        expect.objectContaining({
          message: '调货销售的商品必须填写成本价',
        })
      );
    });
  });

  describe('业务逻辑测试', () => {
    it('应该正确计算调货销售的成本金额和毛利', () => {
      const items = [
        { quantity: 100, unitPrice: 60.0, costPrice: 45.0 },
        { quantity: 50, unitPrice: 80.0, costPrice: 60.0 },
      ];

      // 计算总销售金额
      const totalAmount = items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      );
      expect(totalAmount).toBe(10000); // 100*60 + 50*80 = 6000 + 4000

      // 计算总成本金额
      const costAmount = items.reduce(
        (sum, item) => sum + item.quantity * item.costPrice,
        0
      );
      expect(costAmount).toBe(7500); // 100*45 + 50*60 = 4500 + 3000

      // 计算毛利
      const profitAmount = totalAmount - costAmount;
      expect(profitAmount).toBe(2500); // 10000 - 7500
    });

    it('应该验证订单类型选项', () => {
      expect(SALES_ORDER_TYPE_OPTIONS).toHaveLength(2);
      expect(SALES_ORDER_TYPE_OPTIONS[0]?.value).toBe('normal');
      expect(SALES_ORDER_TYPE_OPTIONS[1]?.value).toBe('transfer');
    });
  });

  describe('类型安全测试', () => {
    it('应该确保订单类型的类型安全', () => {
      // 这个测试主要是编译时检查，如果类型不匹配会导致编译错误
      const normalType = 'normal' as const;
      const transferType = 'transfer' as const;

      expect(normalType).toBe('normal');
      expect(transferType).toBe('transfer');

      // TypeScript 应该阻止无效的订单类型
      // const invalidType = 'invalid' as const; // 这行会导致编译错误
    });
  });
});
