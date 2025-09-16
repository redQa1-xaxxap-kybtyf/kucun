/**
 * 支付管理页面
 * 严格遵循全栈项目统一约定规范
 */

import { Metadata } from 'next'

export const metadata: Metadata = {
  title: '支付管理 - 库存管理系统',
  description: '管理客户支付记录和应收账款',
}

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">支付管理</h1>
        <p className="text-muted-foreground">
          管理客户支付记录和应收账款
        </p>
      </div>
      
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
        <p className="text-center text-muted-foreground">
          支付管理功能正在开发中...
        </p>
      </div>
    </div>
  )
}
