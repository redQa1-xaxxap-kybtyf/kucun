import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { productValidations } from '@/lib/validations/database'
import { prisma } from '@/lib/db'

// 获取单个产品信息
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      )
    }

    const product = await prisma.product.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        code: true,
        name: true,
        specification: true,
        specifications: true,
        unit: true,
        piecesPerUnit: true,
        weight: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        inventory: {
          select: {
            id: true,
            colorCode: true,
            productionDate: true,
            quantity: true,
            reservedQuantity: true,
            updatedAt: true,
          },
          orderBy: [
            { colorCode: 'asc' },
            { productionDate: 'desc' },
          ],
        },
        salesOrderItems: {
          select: {
            id: true,
            colorCode: true,
            productionDate: true,
            quantity: true,
            unitPrice: true,
            subtotal: true,
            salesOrder: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                createdAt: true,
                customer: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: {
            salesOrder: {
              createdAt: 'desc',
            },
          },
          take: 10, // 最近10个销售记录
        },
        inboundRecords: {
          select: {
            id: true,
            recordNumber: true,
            type: true,
            colorCode: true,
            productionDate: true,
            quantity: true,
            remarks: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 10, // 最近10个入库记录
        },
        _count: {
          select: {
            inventory: true,
            salesOrderItems: true,
            inboundRecords: true,
          },
        },
      },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: '产品不存在' },
        { status: 404 }
      )
    }

    // 计算库存汇总
    const inventorySummary = product.inventory.reduce(
      (acc, inv) => {
        acc.totalQuantity += inv.quantity
        acc.reservedQuantity += inv.reservedQuantity
        acc.availableQuantity += inv.quantity - inv.reservedQuantity
        return acc
      },
      { totalQuantity: 0, reservedQuantity: 0, availableQuantity: 0 }
    )

    // 按色号分组库存
    const inventoryByColor = product.inventory.reduce((acc, inv) => {
      const colorKey = inv.colorCode || '无色号'
      if (!acc[colorKey]) {
        acc[colorKey] = {
          colorCode: inv.colorCode,
          totalQuantity: 0,
          reservedQuantity: 0,
          availableQuantity: 0,
          records: [],
        }
      }
      acc[colorKey].totalQuantity += inv.quantity
      acc[colorKey].reservedQuantity += inv.reservedQuantity
      acc[colorKey].availableQuantity += inv.quantity - inv.reservedQuantity
      acc[colorKey].records.push({
        id: inv.id,
        productionDate: inv.productionDate,
        quantity: inv.quantity,
        reservedQuantity: inv.reservedQuantity,
        availableQuantity: inv.quantity - inv.reservedQuantity,
        updatedAt: inv.updatedAt,
      })
      return acc
    }, {} as Record<string, any>)

    // 转换数据格式
    const formattedProduct = {
      id: product.id,
      code: product.code,
      name: product.name,
      specification: product.specification,
      specifications: product.specifications ? JSON.parse(product.specifications as string) : null,
      unit: product.unit,
      piecesPerUnit: product.piecesPerUnit,
      weight: product.weight,
      status: product.status,
      inventorySummary,
      inventoryByColor: Object.values(inventoryByColor),
      recentSalesOrderItems: product.salesOrderItems.map(item => ({
        id: item.id,
        colorCode: item.colorCode,
        productionDate: item.productionDate,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        salesOrder: {
          id: item.salesOrder.id,
          orderNumber: item.salesOrder.orderNumber,
          status: item.salesOrder.status,
          createdAt: item.salesOrder.createdAt,
          customer: item.salesOrder.customer,
        },
      })),
      recentInboundRecords: product.inboundRecords.map(record => ({
        id: record.id,
        recordNumber: record.recordNumber,
        type: record.type,
        colorCode: record.colorCode,
        productionDate: record.productionDate,
        quantity: record.quantity,
        remarks: record.remarks,
        createdAt: record.createdAt,
        user: record.user,
      })),
      statistics: {
        inventoryRecordsCount: product._count.inventory,
        salesOrderItemsCount: product._count.salesOrderItems,
        inboundRecordsCount: product._count.inboundRecords,
      },
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    }

    return NextResponse.json({
      success: true,
      data: formattedProduct,
    })
  } catch (error) {
    console.error('获取产品信息错误:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取产品信息失败',
      },
      { status: 500 }
    )
  }
}

// 更新产品信息
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const validationResult = productValidations.update.safeParse({
      id: params.id,
      ...body,
    })
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
      code, 
      name, 
      specification, 
      specifications, 
      unit, 
      piecesPerUnit, 
      weight, 
      status 
    } = validationResult.data

    // 检查产品是否存在
    const existingProduct = await prisma.product.findUnique({
      where: { id: params.id },
    })

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: '产品不存在' },
        { status: 404 }
      )
    }

    // 如果更新产品编码，检查是否与其他产品冲突
    if (code && code !== existingProduct.code) {
      const codeConflict = await prisma.product.findUnique({
        where: { code },
      })

      if (codeConflict) {
        return NextResponse.json(
          { success: false, error: '产品编码已存在' },
          { status: 400 }
        )
      }
    }

    // 更新产品信息
    const updatedProduct = await prisma.product.update({
      where: { id: params.id },
      data: {
        ...(code && { code }),
        ...(name && { name }),
        ...(specification !== undefined && { specification }),
        ...(specifications !== undefined && { 
          specifications: specifications ? JSON.stringify(specifications) : null 
        }),
        ...(unit && { unit }),
        ...(piecesPerUnit !== undefined && { piecesPerUnit }),
        ...(weight !== undefined && { weight }),
        ...(status && { status }),
      },
      select: {
        id: true,
        code: true,
        name: true,
        specification: true,
        specifications: true,
        unit: true,
        piecesPerUnit: true,
        weight: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // 转换数据格式
    const formattedProduct = {
      id: updatedProduct.id,
      code: updatedProduct.code,
      name: updatedProduct.name,
      specification: updatedProduct.specification,
      specifications: updatedProduct.specifications ? JSON.parse(updatedProduct.specifications as string) : null,
      unit: updatedProduct.unit,
      piecesPerUnit: updatedProduct.piecesPerUnit,
      weight: updatedProduct.weight,
      status: updatedProduct.status,
      createdAt: updatedProduct.createdAt,
      updatedAt: updatedProduct.updatedAt,
    }

    return NextResponse.json({
      success: true,
      data: formattedProduct,
      message: '产品信息更新成功',
    })
  } catch (error) {
    console.error('更新产品信息错误:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '更新产品信息失败',
      },
      { status: 500 }
    )
  }
}

// 删除产品（检查关联后禁止删除）
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      )
    }

    // 检查产品是否存在
    const existingProduct = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        inventory: true,
        salesOrderItems: true,
        inboundRecords: true,
      },
    })

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: '产品不存在' },
        { status: 404 }
      )
    }

    // 检查是否有关联数据
    if (existingProduct.inventory.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `该产品有 ${existingProduct.inventory.length} 条库存记录，无法删除` 
        },
        { status: 400 }
      )
    }

    if (existingProduct.salesOrderItems.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `该产品有 ${existingProduct.salesOrderItems.length} 条销售记录，无法删除` 
        },
        { status: 400 }
      )
    }

    if (existingProduct.inboundRecords.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `该产品有 ${existingProduct.inboundRecords.length} 条入库记录，无法删除` 
        },
        { status: 400 }
      )
    }

    // 删除产品
    await prisma.product.delete({
      where: { id: params.id },
    })

    return NextResponse.json({
      success: true,
      message: '产品删除成功',
    })
  } catch (error) {
    console.error('删除产品错误:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '删除产品失败',
      },
      { status: 500 }
    )
  }
}
