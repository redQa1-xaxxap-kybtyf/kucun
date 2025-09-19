"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Calendar, MapPin, Phone, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { AddressDisplay } from "@/components/ui/address-display"
import { customerQueryKeys, getCustomer } from "@/lib/api/customers"
import type { Customer } from "@/lib/types/customer"

interface CustomerDetailDialogProps {
  customerId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * 客户详情对话框组件
 * 显示客户的完整信息和统计数据
 */
export function CustomerDetailDialog({
  customerId,
  open,
  onOpenChange,
}: CustomerDetailDialogProps) {
  const { data: customer, isLoading, error } = useQuery({
    queryKey: customerQueryKeys.detail(customerId!),
    queryFn: () => getCustomer(customerId!),
    enabled: !!customerId && open,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>客户详情</DialogTitle>
          <DialogDescription>
            查看客户的详细信息和业务统计数据
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-6">
            <div className="space-y-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">加载客户信息失败</p>
            <p className="text-sm text-red-500 mt-2">{error.message}</p>
          </div>
        ) : customer ? (
          <div className="space-y-6">
            {/* 基本信息 */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold text-lg">{customer.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    创建于 {new Date(customer.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="grid gap-3">
                {customer.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{customer.phone}</span>
                  </div>
                )}
                
                <AddressDisplay 
                  address={customer.address} 
                  maxWidth="max-w-full"
                  className="items-start"
                />
              </div>
            </div>

            {/* 统计数据 */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {customer.transactionCount || 0}
                </div>
                <div className="text-sm text-muted-foreground">交易次数</div>
              </div>
              
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {customer.cooperationDays !== undefined 
                    ? customer.cooperationDays 
                    : '-'
                  }
                </div>
                <div className="text-sm text-muted-foreground">
                  {customer.cooperationDays !== undefined ? '合作天数' : '未下单'}
                </div>
              </div>
              
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {customer.returnOrderCount || 0}
                </div>
                <div className="text-sm text-muted-foreground">退货次数</div>
              </div>
            </div>

            {/* 扩展信息 */}
            {customer.extendedInfo && (
              <div className="space-y-3">
                <h4 className="font-medium">扩展信息</h4>
                <div className="bg-muted/30 p-3 rounded-lg">
                  <pre className="text-sm whitespace-pre-wrap">
                    {JSON.stringify(customer.extendedInfo, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
