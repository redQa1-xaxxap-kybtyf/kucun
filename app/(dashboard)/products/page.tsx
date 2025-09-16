import { Metadata } from 'next'

export const metadata: Metadata = {
  title: '产品管理',
  description: '管理产品信息和规格',
}

/**
 * 产品管理页面
 * 使用新的认证布局系统
 */
export default function ProductsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">产品管理</h1>
        <p className="text-muted-foreground">
          管理所有产品的基本信息和规格
        </p>
      </div>
      
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          产品管理功能正在开发中...
        </p>
      </div>
    </div>
  )
}
