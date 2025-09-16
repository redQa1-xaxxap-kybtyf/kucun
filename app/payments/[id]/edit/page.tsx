// 编辑收款记录页面
// 用于编辑现有的收款记录

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, DollarSign, AlertCircle } from 'lucide-react'

import { PaymentForm } from '@/components/payments/payment-form'
import { 
  usePaymentRecord, 
  useUpdatePaymentRecord 
} from '@/lib/api/payments'
import type { UpdatePaymentRecordInput } from '@/lib/validations/payment'

interface EditPaymentPageProps {
  params: {
    id: string
  }
}

export default function EditPaymentPage({ params }: EditPaymentPageProps) {
  const router = useRouter()
  const { toast } = useToast()
  
  // 获取收款记录详情
  const { 
    data: payment, 
    isLoading, 
    error 
  } = usePaymentRecord(params.id)
  
  // 更新收款记录mutation
  const updatePaymentMutation = useUpdatePaymentRecord()

  // 处理表单提交
  const handleSubmit = async (data: UpdatePaymentRecordInput) => {
    try {
      const result = await updatePaymentMutation.mutateAsync({
        id: params.id,
        data
      })
      
      toast({
        title: '更新成功',
        description: `收款记录 ${result.paymentNumber} 已更新`,
      })
      
      // 跳转到收款记录详情页
      router.push(`/payments/${result.id}`)
    } catch (error) {
      toast({
        title: '更新失败',
        description: error instanceof Error ? error.message : '更新收款记录时发生错误',
        variant: 'destructive',
      })
    }
  }

  // 处理取消
  const handleCancel = () => {
    router.back()
  }

  // 加载状态
  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-9 w-16" />
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
        </div>
        
        <div className="max-w-4xl">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-6 w-32" />
              </div>
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-20 w-full" />
                </div>
                <div className="flex justify-end space-x-4 pt-6 border-t">
                  <Skeleton className="h-10 w-16" />
                  <Skeleton className="h-10 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // 错误状态
  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            加载收款记录失败: {error instanceof Error ? error.message : '未知错误'}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // 收款记录不存在
  if (!payment) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            收款记录不存在或已被删除
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // 检查是否可以编辑
  if (payment.status === 'confirmed') {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center space-x-2">
              <DollarSign className="h-8 w-8" />
              <span>编辑收款记录</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              收款记录 {payment.paymentNumber}
            </p>
          </div>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            已确认的收款记录不能编辑。如需修改，请先取消确认状态。
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题和导航 */}
      <div className="flex items-center space-x-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回
        </Button>
        
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center space-x-2">
            <DollarSign className="h-8 w-8" />
            <span>编辑收款记录</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            收款记录 {payment.paymentNumber}
          </p>
        </div>
      </div>

      {/* 编辑提示 */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          编辑收款记录将更新相关的收款信息。请确保信息准确无误。
        </AlertDescription>
      </Alert>

      {/* 收款记录表单 */}
      <div className="max-w-4xl">
        <PaymentForm
          initialData={payment}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={updatePaymentMutation.isPending}
        />
      </div>
    </div>
  )
}
