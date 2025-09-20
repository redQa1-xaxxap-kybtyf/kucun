"use client"

import { Check, Copy, RefreshCw, Loader2, AlertCircle } from "lucide-react"
import * as React from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

interface OrderNumberGeneratorProps {
  value?: string
  onChange: (orderNumber: string) => void
  disabled?: boolean
  className?: string
}

/**
 * 订单号生成器组件
 * 支持自动生成和手动输入订单号
 */
export function OrderNumberGenerator({
  value = "",
  onChange,
  disabled = false,
  className,
}: OrderNumberGeneratorProps) {
  const { toast } = useToast()
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [isValidating, setIsValidating] = React.useState(false)
  const [validationResult, setValidationResult] = React.useState<{
    valid: boolean
    available: boolean
    message: string
  } | null>(null)
  const [copied, setCopied] = React.useState(false)

  // 生成新订单号
  const generateOrderNumber = async () => {
    if (disabled) return

    setIsGenerating(true)
    try {
      const response = await fetch('/api/sales-orders/generate-order-number?action=generate')
      const data = await response.json()

      if (data.success) {
        onChange(data.data.orderNumber)
        setValidationResult({
          valid: true,
          available: true,
          message: '订单号生成成功',
        })
        toast({
          title: "订单号生成成功",
          description: `新订单号：${data.data.orderNumber}`,
        })
      } else {
        throw new Error(data.error || '生成失败')
      }
    } catch (error) {
      toast({
        title: "生成失败",
        description: error instanceof Error ? error.message : '生成订单号失败',
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  // 验证订单号
  const validateOrderNumber = async (orderNumber: string) => {
    if (!orderNumber.trim()) {
      setValidationResult(null)
      return
    }

    setIsValidating(true)
    try {
      const response = await fetch('/api/sales-orders/generate-order-number', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderNumber }),
      })
      const data = await response.json()

      if (data.success) {
        setValidationResult({
          valid: data.data.valid,
          available: data.data.available,
          message: data.data.message,
        })
      } else {
        setValidationResult({
          valid: false,
          available: false,
          message: data.error || '验证失败',
        })
      }
    } catch (error) {
      setValidationResult({
        valid: false,
        available: false,
        message: '验证失败，请检查网络连接',
      })
    } finally {
      setIsValidating(false)
    }
  }

  // 复制订单号
  const copyOrderNumber = async () => {
    if (!value) return

    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast({
        title: "复制成功",
        description: "订单号已复制到剪贴板",
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast({
        title: "复制失败",
        description: "无法复制到剪贴板",
        variant: "destructive",
      })
    }
  }

  // 处理输入变化
  const handleInputChange = (newValue: string) => {
    onChange(newValue)
    
    // 防抖验证
    const timeoutId = setTimeout(() => {
      validateOrderNumber(newValue)
    }, 500)

    return () => clearTimeout(timeoutId)
  }

  // 获取状态指示器
  const getStatusIndicator = () => {
    if (isValidating) {
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    }

    if (!validationResult) {
      return null
    }

    if (!validationResult.valid) {
      return <AlertCircle className="h-4 w-4 text-destructive" />
    }

    if (!validationResult.available) {
      return <AlertCircle className="h-4 w-4 text-orange-500" />
    }

    return <Check className="h-4 w-4 text-green-600" />
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-2">
        <Label htmlFor="orderNumber">订单号</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="orderNumber"
              placeholder="自动生成或手动输入订单号"
              value={value}
              onChange={(e) => handleInputChange(e.target.value)}
              disabled={disabled}
              className={cn(
                "pr-10",
                validationResult && !validationResult.valid && "border-destructive",
                validationResult && validationResult.valid && !validationResult.available && "border-orange-500",
                validationResult && validationResult.valid && validationResult.available && "border-green-500"
              )}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {getStatusIndicator()}
            </div>
          </div>
          
          <Button
            type="button"
            variant="outline"
            onClick={generateOrderNumber}
            disabled={disabled || isGenerating}
            className="shrink-0"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>

          {value && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={copyOrderNumber}
              disabled={disabled}
              className="shrink-0"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* 验证结果显示 */}
      {validationResult && (
        <div className="space-y-2">
          {!validationResult.valid && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationResult.message}</AlertDescription>
            </Alert>
          )}

          {validationResult.valid && !validationResult.available && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationResult.message}</AlertDescription>
            </Alert>
          )}

          {validationResult.valid && validationResult.available && (
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-800">
                <Check className="mr-1 h-3 w-3" />
                {validationResult.message}
              </Badge>
            </div>
          )}
        </div>
      )}

      {/* 订单号格式说明 */}
      <div className="text-xs text-muted-foreground">
        <div className="font-medium mb-1">订单号格式说明：</div>
        <div>• 格式：SO + 8位日期 + 4位序号</div>
        <div>• 示例：SO202501190001</div>
        <div>• 点击刷新按钮自动生成唯一订单号</div>
      </div>
    </div>
  )
}

/**
 * 简化的订单号输入组件
 */
interface SimpleOrderNumberInputProps {
  value?: string
  onChange: (value: string) => void
  disabled?: boolean
  error?: string
}

export function SimpleOrderNumberInput({
  value = "",
  onChange,
  disabled = false,
  error,
}: SimpleOrderNumberInputProps) {
  const [isGenerating, setIsGenerating] = React.useState(false)
  const { toast } = useToast()

  const generateOrderNumber = async () => {
    setIsGenerating(true)
    try {
      const response = await fetch('/api/sales-orders/generate-order-number?action=generate')
      const data = await response.json()

      if (data.success) {
        onChange(data.data.orderNumber)
      } else {
        throw new Error(data.error || '生成失败')
      }
    } catch (error) {
      toast({
        title: "生成失败",
        description: error instanceof Error ? error.message : '生成订单号失败',
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex gap-2">
      <Input
        placeholder="订单号（可自动生成）"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={error ? "border-destructive" : ""}
      />
      <Button
        type="button"
        variant="outline"
        onClick={generateOrderNumber}
        disabled={disabled || isGenerating}
        className="shrink-0"
      >
        {isGenerating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "生成"
        )}
      </Button>
    </div>
  )
}
