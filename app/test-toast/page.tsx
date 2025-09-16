'use client'

import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, AlertCircle, Info } from 'lucide-react'

export default function TestToastPage() {
  const { toast } = useToast()

  const showSuccessToast = () => {
    toast({
      title: '登录成功！',
      description: '欢迎回来，张三（管理员）',
      variant: 'success',
    })
  }

  const showErrorToast = () => {
    toast({
      title: '登录失败',
      description: '用户名或密码错误',
      variant: 'destructive',
    })
  }

  const showDefaultToast = () => {
    toast({
      title: '提示信息',
      description: '这是一个默认的提示消息',
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Toast 组件测试</CardTitle>
          <CardDescription>
            测试不同类型的 Toast 通知
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={showSuccessToast}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            显示成功 Toast
          </Button>

          <Button 
            onClick={showErrorToast}
            variant="destructive"
            className="w-full"
          >
            <AlertCircle className="mr-2 h-4 w-4" />
            显示错误 Toast
          </Button>

          <Button 
            onClick={showDefaultToast}
            variant="outline"
            className="w-full"
          >
            <Info className="mr-2 h-4 w-4" />
            显示默认 Toast
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
