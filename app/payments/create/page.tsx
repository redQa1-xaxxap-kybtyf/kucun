// 创建收款记录页面
// 用于创建新的收款记录

'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, DollarSign, AlertCircle } from 'lucide-react'

import { PaymentForm } from '@/components/payments/payment-form'
import { useCreatePaymentRecord } from '@/lib/api/payments'
import type { CreatePaymentRecordInput } from '@/lib/validations/payment'

export default function CreatePaymentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  
  // 从URL参数获取预填充数据
  const salesOrderId = searchParams.get('salesOrderId')
  const customerId = searchParams.get('customerId')
  
  // 创建收款记录mutation
  const createPaymentMutation = useCreatePaymentRecord()

  // 处理表单提交
  const handleSubmit = async (data: CreatePaymentRecordInput) => {
    try {
      const result = await createPaymentMutation.mutateAsync(data)
      
      toast({
        title: '创建成功',
        description: `收款记录 ${result.paymentNumber} 已创建`,
      })
      
      // 跳转到收款记录详情页
      router.push(`/payments/${result.id}`)
    } catch (error) {
      toast({
        title: '创建失败',
        description: error instanceof Error ? error.message : '创建收款记录时发生错误',
        variant: 'destructive',
      })
    }
  }

  // 处理取消
  const handleCancel = () => {
    router.back()
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
            <span>创建收款记录</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            填写收款记录的详细信息
          </p>
        </div>
      </div>

      {/* 预填充信息提示 */}
      {(salesOrderId || customerId) && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {salesOrderId && '已自动选择销售订单。'}
            {customerId && '已自动选择客户。'}
            请完善其他收款信息。
          </AlertDescription>
        </Alert>
      )}

      {/* 收款记录表单 */}
      <div className="max-w-4xl">
        <PaymentForm
          salesOrderId={salesOrderId || undefined}
          customerId={customerId || undefined}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={createPaymentMutation.isPending}
        />
      </div>
    </div>
  )
}
