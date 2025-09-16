import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, updateUserStatus } from '@/lib/auth'
import { userValidations } from '@/lib/validations/database'
import { prisma } from '@/lib/db'

// 获取单个用户信息
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

    // 用户只能查看自己的信息，管理员可以查看所有用户
    if (session.user.role !== 'admin' && session.user.id !== params.id) {
      return NextResponse.json(
        { success: false, error: '权限不足' },
        { status: 403 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: user,
    })
  } catch (error) {
    console.error('获取用户信息错误:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取用户信息失败',
      },
      { status: 500 }
    )
  }
}

// 更新用户信息 (仅管理员)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证管理员权限
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // 验证输入数据
    const validationResult = userValidations.update.safeParse({
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

    const { name, role, status } = validationResult.data

    // 检查用户是否存在
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
    })

    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      )
    }

    // 更新用户信息
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(role && { role }),
        ...(status && { status }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: '用户信息更新成功',
    })
  } catch (error) {
    console.error('更新用户信息错误:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '更新用户信息失败',
      },
      { status: 500 }
    )
  }
}

// 删除用户 (仅管理员，实际上是禁用用户)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证管理员权限
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足' },
        { status: 403 }
      )
    }

    // 检查用户是否存在
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
    })

    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      )
    }

    // 不能删除自己
    if (session.user.id === params.id) {
      return NextResponse.json(
        { success: false, error: '不能删除自己的账户' },
        { status: 400 }
      )
    }

    // 禁用用户而不是真正删除
    await updateUserStatus(params.id, 'inactive')

    return NextResponse.json({
      success: true,
      message: '用户已被禁用',
    })
  } catch (error) {
    console.error('删除用户错误:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '删除用户失败',
      },
      { status: 500 }
    )
  }
}
