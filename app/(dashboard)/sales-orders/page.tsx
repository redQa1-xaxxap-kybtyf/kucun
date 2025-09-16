import { Metadata } from 'next'

export const metadata: Metadata = {
  title: '销售订单',
  description: '管理销售订单和客户订单',
}

/**
 * 销售订单页面
 * 使用新的认证布局系统
 */
export default function SalesOrdersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">销售订单</h1>
        <p className="text-muted-foreground">
          管理所有销售订单和客户订单信息
        </p>
      </div>
      
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          销售订单功能正在开发中...
        </p>
      </div>
    </div>
  )
}
