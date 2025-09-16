import { Metadata } from 'next'

export const metadata: Metadata = {
  title: '库存管理',
  description: '查看和管理产品库存信息',
}

/**
 * 库存管理页面
 * 使用新的认证布局系统
 */
export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">库存管理</h1>
        <p className="text-muted-foreground">
          查看和管理所有产品的库存信息
        </p>
      </div>
      
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          库存管理功能正在开发中...
        </p>
      </div>
    </div>
  )
}
