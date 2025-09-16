import { NextRequest, NextResponse } from 'next/server'
import { createUser } from '@/lib/auth'
import { userValidations } from '@/lib/validations/database'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // 验证输入数据
    const validationResult = userValidations.register.safeParse(body)
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

    const { email, name, password } = validationResult.data

    // 创建用户
    const user = await createUser({
      email,
      name,
      password,
      role: 'sales', // 默认注册为销售员
    })

    // 返回成功响应（不包含敏感信息）
    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      },
      message: '用户注册成功',
    })
  } catch (error) {
    console.error('用户注册错误:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '注册失败',
      },
      { status: 500 }
    )
  }
}
