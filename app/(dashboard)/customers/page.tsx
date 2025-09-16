import { Metadata } from 'next'

export const metadata: Metadata = {
  title: '客户管理',
  description: '管理客户信息和关系',
}

/**
 * 客户管理页面
 * 使用新的认证布局系统
 */
export default function CustomersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">客户管理</h1>
        <p className="text-muted-foreground">
          管理客户信息、联系方式和业务关系
        </p>
      </div>
      
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          客户管理功能正在开发中...
        </p>
      </div>
    </div>
  )
}
