// 库存趋势数据API
// 提供库存变化趋势分析数据

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  inventoryTrendQuerySchema,
  apiResponseSchema,
} from '@/lib/validations/dashboard';

// 获取库存趋势数据
export async function GET(request: NextRequest) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const validationResult = inventoryTrendQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '请求参数格式不正确',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { timeRange, productCategory, warehouseId } = validationResult.data;

    // 计算时间范围
    const now = new Date();
    const startDate = new Date();

    switch (timeRange) {
      case '1d':
        startDate.setDate(now.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    // 构建库存查询条件
    const inventoryWhereConditions: any = {};

    if (productCategory) {
      inventoryWhereConditions.product = {
        category: {
          name: productCategory,
        },
      };
    }

    if (warehouseId) {
      inventoryWhereConditions.warehouseId = warehouseId;
    }

    // 获取当前库存数据
    const currentInventory = await prisma.inventory.findMany({
      where: inventoryWhereConditions,
      include: {
        product: {
          include: {
            category: true,
          },
        },
      },
    });

    // 获取入库记录
    const inboundRecords = await prisma.inboundRecord.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: now,
        },
        ...(productCategory && {
          product: {
            category: {
              name: productCategory,
            },
          },
        }),
      },
      include: {
        product: {
          include: {
            category: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // 获取销售出库记录（通过销售订单项）
    const salesOrderItems = await prisma.salesOrderItem.findMany({
      where: {
        salesOrder: {
          createdAt: {
            gte: startDate,
            lte: now,
          },
          status: {
            in: ['confirmed', 'shipped', 'delivered'],
          },
        },
        ...(productCategory && {
          product: {
            category: {
              name: productCategory,
            },
          },
        }),
      },
      include: {
        product: {
          include: {
            category: true,
          },
        },
        salesOrder: true,
      },
      orderBy: {
        salesOrder: {
          createdAt: 'asc',
        },
      },
    });

    // 生成库存趋势数据
    const generateInventoryTrendData = (interval: 'hour' | 'day' | 'week' | 'month') => {
      const dataMap = new Map<string, { 
        inbound: number; 
        outbound: number; 
        net: number;
        products: Set<string>;
      }>();

      // 处理入库数据
      inboundRecords.forEach(record => {
        let dateKey: string;
        const recordDate = new Date(record.createdAt);

        switch (interval) {
          case 'hour':
            dateKey = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}-${String(recordDate.getDate()).padStart(2, '0')} ${String(recordDate.getHours()).padStart(2, '0')}:00`;
            break;
          case 'day':
            dateKey = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}-${String(recordDate.getDate()).padStart(2, '0')}`;
            break;
          case 'week':
            const weekStart = new Date(recordDate);
            weekStart.setDate(recordDate.getDate() - recordDate.getDay());
            dateKey = `${weekStart.getFullYear()}-W${String(Math.ceil((weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))).padStart(2, '0')}`;
            break;
          case 'month':
            dateKey = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}`;
            break;
        }

        const existing = dataMap.get(dateKey) || { 
          inbound: 0, 
          outbound: 0, 
          net: 0,
          products: new Set<string>(),
        };
        existing.inbound += record.quantity;
        existing.net += record.quantity;
        existing.products.add(record.productId);
        dataMap.set(dateKey, existing);
      });

      // 处理出库数据（销售订单项）
      salesOrderItems.forEach(item => {
        let dateKey: string;
        const orderDate = new Date(item.salesOrder.createdAt);

        switch (interval) {
          case 'hour':
            dateKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')} ${String(orderDate.getHours()).padStart(2, '0')}:00`;
            break;
          case 'day':
            dateKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')}`;
            break;
          case 'week':
            const weekStart = new Date(orderDate);
            weekStart.setDate(orderDate.getDate() - orderDate.getDay());
            dateKey = `${weekStart.getFullYear()}-W${String(Math.ceil((weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))).padStart(2, '0')}`;
            break;
          case 'month':
            dateKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
            break;
        }

        const existing = dataMap.get(dateKey) || { 
          inbound: 0, 
          outbound: 0, 
          net: 0,
          products: new Set<string>(),
        };
        existing.outbound += item.quantity;
        existing.net -= item.quantity;
        existing.products.add(item.productId);
        dataMap.set(dateKey, existing);
      });

      return Array.from(dataMap.entries())
        .map(([date, data]) => ({
          date,
          inbound: data.inbound,
          outbound: data.outbound,
          net: data.net,
          productsCount: data.products.size,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    };

    // 根据时间范围选择合适的间隔
    let interval: 'hour' | 'day' | 'week' | 'month';
    switch (timeRange) {
      case '1d':
        interval = 'hour';
        break;
      case '7d':
        interval = 'day';
        break;
      case '30d':
        interval = 'day';
        break;
      case '90d':
        interval = 'week';
        break;
      case '1y':
        interval = 'month';
        break;
      default:
        interval = 'day';
    }

    // 生成趋势数据
    const trendData = generateInventoryTrendData(interval);

    // 计算汇总统计
    const totalInbound = inboundRecords.reduce((sum, record) => sum + record.quantity, 0);
    const totalOutbound = salesOrderItems.reduce((sum, item) => sum + item.quantity, 0);
    const netChange = totalInbound - totalOutbound;

    // 计算当前库存总量
    const currentTotalStock = currentInventory.reduce((sum, inv) => sum + inv.quantity, 0);
    const currentTotalValue = currentInventory.reduce((sum, inv) => 
      sum + (inv.quantity * (inv.product.price || 0)), 0
    );

    // 计算库存周转率（简化计算）
    const averageInventory = currentTotalStock;
    const inventoryTurnover = averageInventory > 0 ? totalOutbound / averageInventory : 0;

    // 获取低库存产品数量
    const lowStockProducts = currentInventory.filter(inv => 
      inv.quantity <= (inv.safetyStock || 10)
    ).length;

    // 构建响应数据
    const responseData = {
      timeRange,
      interval,
      data: trendData,
      summary: {
        totalInbound,
        totalOutbound,
        netChange,
        currentTotalStock,
        currentTotalValue,
        inventoryTurnover,
        lowStockProducts,
        totalProducts: currentInventory.length,
      },
      period: {
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
      },
      filters: {
        productCategory,
        warehouseId,
      },
    };

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('获取库存趋势数据失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取库存趋势数据失败',
      },
      { status: 500 }
    );
  }
}

// 获取库存预警统计
export async function POST(request: NextRequest) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const validationResult = inventoryTrendQuerySchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '请求参数格式不正确',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { productCategory, warehouseId } = validationResult.data;

    // 构建查询条件
    const whereConditions: any = {};

    if (productCategory) {
      whereConditions.product = {
        category: {
          name: productCategory,
        },
      };
    }

    if (warehouseId) {
      whereConditions.warehouseId = warehouseId;
    }

    // 获取库存数据
    const inventory = await prisma.inventory.findMany({
      where: whereConditions,
      include: {
        product: {
          include: {
            category: true,
          },
        },
      },
    });

    // 分析库存状态
    const analysis = {
      total: inventory.length,
      inStock: 0,
      lowStock: 0,
      outOfStock: 0,
      overStock: 0,
      categories: new Map<string, number>(),
    };

    inventory.forEach(inv => {
      const safetyStock = inv.safetyStock || 10;
      const maxStock = safetyStock * 3; // 假设最大库存为安全库存的3倍

      if (inv.quantity === 0) {
        analysis.outOfStock++;
      } else if (inv.quantity <= safetyStock) {
        analysis.lowStock++;
      } else if (inv.quantity > maxStock) {
        analysis.overStock++;
      } else {
        analysis.inStock++;
      }

      // 统计分类
      const categoryName = inv.product.category?.name || '未分类';
      analysis.categories.set(categoryName, (analysis.categories.get(categoryName) || 0) + 1);
    });

    const responseData = {
      total: analysis.total,
      inStock: analysis.inStock,
      lowStock: analysis.lowStock,
      outOfStock: analysis.outOfStock,
      overStock: analysis.overStock,
      categories: Array.from(analysis.categories.entries()).map(([name, count]) => ({
        name,
        count,
        percentage: analysis.total > 0 ? (count / analysis.total) * 100 : 0,
      })),
      filters: {
        productCategory,
        warehouseId,
      },
    };

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('获取库存预警统计失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取库存预警统计失败',
      },
      { status: 500 }
    );
  }
}
