import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { inventoryValidations, paginationValidations } from '@/lib/validations/database'
import { prisma } from '@/lib/db'

// 获取库存列表
export async function GET(request: NextRequest) {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const queryParams = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      search: searchParams.get('search') || undefined,
      sortBy: searchParams.get('sortBy') || 'updatedAt',
      sortOrder: (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc',
      productId: searchParams.get('productId') || undefined,
      colorCode: searchParams.get('colorCode') || undefined,
      lowStock: searchParams.get('lowStock') === 'true',
    }

    // 验证查询参数
    const validationResult = paginationValidations.query.safeParse(queryParams)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '查询参数格式不正确',
          details: validationResult.error.errors,
        },
        { status: 400 }
      )
    }

    const { page, limit, search, sortBy, sortOrder } = validationResult.data
    const { productId, colorCode, lowStock } = queryParams

    // 构建查询条件
    const where: any = {}
    
    if (search) {
      where.OR = [
        { product: { code: { contains: search } } },
        { product: { name: { contains: search } } },
        { colorCode: { contains: search } },
      ]
    }

    if (productId) {
      where.productId = productId
    }

    if (colorCode) {
      where.colorCode = colorCode
    }

    if (lowStock) {
      // 低库存：可用库存 <= 10
      where.quantity = { lte: 10 }
    }

    // 查询库存列表
    const [inventoryRecords, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        select: {
          id: true,
          productId: true,
          colorCode: true,
          productionDate: true,
          quantity: true,
          reservedQuantity: true,
          updatedAt: true,
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              specification: true,
              unit: true,
              piecesPerUnit: true,
              status: true,
            },
          },
        },
        orderBy: { [sortBy as string]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.inventory.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)

    // 转换数据格式（snake_case -> camelCase）
    const formattedInventory = inventoryRecords.map(record => ({
      id: record.id,
      productId: record.productId,
      colorCode: record.colorCode,
      productionDate: record.productionDate,
      quantity: record.quantity,
      reservedQuantity: record.reservedQuantity,
      availableQuantity: record.quantity - record.reservedQuantity,
      product: record.product,
      updatedAt: record.updatedAt,
    }))

    return NextResponse.json({
      success: true,
      data: formattedInventory,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    console.error('获取库存列表错误:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取库存列表失败',
      },
      { status: 500 }
    )
  }
}

// 库存调整
export async function POST(request: NextRequest) {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // 验证输入数据
    const validationResult = inventoryValidations.adjust.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '输入数据格式不正确',
          details: validationResult.error.errors,
        },
        { status: 400 }
      )
    }

    const { 
      productId, 
      colorCode, 
      productionDate, 
      adjustmentType, 
      quantity, 
      reason 
    } = validationResult.data

    // 验证产品是否存在
    const product = await prisma.product.findUnique({
      where: { id: productId },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: '指定的产品不存在' },
        { status: 400 }
      )
    }

    // 查找或创建库存记录
    let inventory = await prisma.inventory.findFirst({
      where: {
        productId,
        colorCode,
        productionDate: productionDate ? new Date(productionDate) : null,
      },
    })

    if (!inventory) {
      // 如果是减少库存但记录不存在，报错
      if (adjustmentType === 'decrease') {
        return NextResponse.json(
          { success: false, error: '库存记录不存在，无法减少库存' },
          { status: 400 }
        )
      }

      // 创建新的库存记录
      inventory = await prisma.inventory.create({
        data: {
          productId,
          colorCode,
          productionDate: productionDate ? new Date(productionDate) : null,
          quantity: adjustmentType === 'increase' ? quantity : 0,
          reservedQuantity: 0,
        },
      })
    } else {
      // 更新现有库存记录
      const newQuantity = adjustmentType === 'increase' 
        ? inventory.quantity + quantity 
        : inventory.quantity - quantity

      // 检查库存不能为负数
      if (newQuantity < 0) {
        return NextResponse.json(
          { success: false, error: '库存不足，无法减少指定数量' },
          { status: 400 }
        )
      }

      // 检查可用库存（减少时不能低于预留库存）
      if (adjustmentType === 'decrease' && newQuantity < inventory.reservedQuantity) {
        return NextResponse.json(
          { 
            success: false, 
            error: `可用库存不足，当前预留库存为 ${inventory.reservedQuantity}` 
          },
          { status: 400 }
        )
      }

      inventory = await prisma.inventory.update({
        where: { id: inventory.id },
        data: {
          quantity: newQuantity,
        },
      })
    }

    // 记录库存调整日志（可选，这里简化处理）
    console.log(`库存调整: 产品${productId}, 色号${colorCode}, ${adjustmentType} ${quantity}, 原因: ${reason}`)

    // 获取更新后的库存信息
    const updatedInventory = await prisma.inventory.findUnique({
      where: { id: inventory.id },
      select: {
        id: true,
        productId: true,
        colorCode: true,
        productionDate: true,
        quantity: true,
        reservedQuantity: true,
        updatedAt: true,
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            specification: true,
            unit: true,
            piecesPerUnit: true,
          },
        },
      },
    })

    // 转换数据格式
    const formattedInventory = {
      id: updatedInventory!.id,
      productId: updatedInventory!.productId,
      colorCode: updatedInventory!.colorCode,
      productionDate: updatedInventory!.productionDate,
      quantity: updatedInventory!.quantity,
      reservedQuantity: updatedInventory!.reservedQuantity,
      availableQuantity: updatedInventory!.quantity - updatedInventory!.reservedQuantity,
      product: updatedInventory!.product,
      updatedAt: updatedInventory!.updatedAt,
    }

    return NextResponse.json({
      success: true,
      data: formattedInventory,
      message: `库存${adjustmentType === 'increase' ? '增加' : '减少'}成功`,
    })
  } catch (error) {
    console.error('库存调整错误:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '库存调整失败',
      },
      { status: 500 }
    )
  }
}
