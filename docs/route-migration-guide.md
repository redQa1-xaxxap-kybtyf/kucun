# 路由迁移指南

## 概述

本文档描述了从旧路由结构到新的App Router路由组结构的迁移过程。

## 路由结构变化

### 旧结构 → 新结构

```
旧结构:                          新结构:
app/                            app/
├── dashboard/                  ├── (dashboard)/
│   └── page.tsx               │   ├── layout.tsx          # 新增：统一布局
├── inventory/                  │   ├── dashboard/
│   └── page.tsx               │   │   └── page.tsx        # 迁移
├── products/                   │   ├── inventory/
│   └── page.tsx               │   │   └── page.tsx        # 迁移
├── sales-orders/               │   ├── products/
│   └── page.tsx               │   │   └── page.tsx        # 迁移
├── customers/                  │   ├── sales-orders/
│   └── page.tsx               │   │   └── page.tsx        # 迁移
└── ...                        │   ├── customers/
                               │   │   └── page.tsx        # 迁移
                               │   └── ...
                               ├── auth/                   # 保持不变
                               └── api/                    # 保持不变
```

## 迁移优势

### 1. 统一认证布局
- 所有仪表盘页面自动应用认证检查
- 统一的布局系统（侧边栏、顶部导航栏）
- 权限控制集成

### 2. 更好的代码组织
- 路由组 `(dashboard)` 提供逻辑分组
- 共享布局和元数据
- 更清晰的文件结构

### 3. 性能优化
- 布局组件复用
- 更好的代码分割
- 优化的加载策略

## URL 映射

路由组不会影响URL结构，用户访问的URL保持不变：

```
用户访问URL:                    实际文件路径:
/dashboard                     app/(dashboard)/dashboard/page.tsx
/inventory                     app/(dashboard)/inventory/page.tsx
/products                      app/(dashboard)/products/page.tsx
/sales-orders                  app/(dashboard)/sales-orders/page.tsx
/customers                     app/(dashboard)/customers/page.tsx
```

## 新增功能

### 1. 认证布局 (AuthLayout)
- 自动认证检查
- 权限控制
- 加载状态处理
- 错误页面处理

### 2. 统一布局 (DashboardLayout)
- 响应式侧边栏
- 顶部导航栏
- 移动端抽屉菜单
- 手势支持

### 3. 全局功能
- 全局搜索 (Ctrl+K)
- 面包屑导航
- 主题切换
- 通知系统

## 页面组件更新

### 元数据定义
每个页面现在都应该导出元数据：

```typescript
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: '页面标题',
  description: '页面描述',
}
```

### 页面组件简化
由于布局已经在路由组级别处理，页面组件可以专注于内容：

```typescript
export default function PageComponent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">页面标题</h1>
        <p className="text-muted-foreground">页面描述</p>
      </div>
      
      {/* 页面内容 */}
    </div>
  )
}
```

## 迁移检查清单

### ✅ 已完成
- [x] 创建路由组布局 `app/(dashboard)/layout.tsx`
- [x] 迁移仪表盘页面 `app/(dashboard)/dashboard/page.tsx`
- [x] 创建新的页面模板
- [x] 更新根页面重定向逻辑

### 🔄 进行中
- [ ] 迁移所有现有页面到新结构
- [ ] 更新页面间的导航链接
- [ ] 测试所有路由功能

### ⏳ 待完成
- [ ] 更新API路由（如需要）
- [ ] 更新中间件配置（如需要）
- [ ] 完整的功能测试

## 注意事项

1. **URL保持不变**: 路由组不会改变用户访问的URL
2. **渐进式迁移**: 可以逐步迁移页面，新旧结构可以共存
3. **布局继承**: 所有在路由组内的页面都会自动继承布局
4. **权限控制**: 新布局系统自动处理权限检查

## 测试建议

1. **功能测试**: 确保所有页面正常加载和显示
2. **认证测试**: 验证未认证用户被正确重定向
3. **权限测试**: 验证不同角色用户看到正确的内容
4. **响应式测试**: 确保移动端和桌面端都正常工作
5. **导航测试**: 验证所有导航链接正确工作

## 回滚计划

如果需要回滚到旧结构：
1. 保留原有页面文件作为备份
2. 更新根页面重定向逻辑
3. 临时禁用新布局系统
4. 逐步恢复原有路由结构
