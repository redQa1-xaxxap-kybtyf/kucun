# 项目概览

## 项目名称

kucun - 瓷砖行业库存管理工具

## 项目目的

专为瓷砖行业设计的库存管理工具，支持销售、入库、客户管理等核心功能，提供移动端友好的操作体验。

## 技术栈

- **全栈框架**: Next.js 15.4 (App Router)
- **数据库**: MySQL 8.0+
- **ORM**: Prisma 5.22.0
- **身份认证**: NextAuth.js 4.24.11
- **状态管理**: TanStack Query v5.79.0
- **UI组件库**: Tailwind CSS v4.1.14 + shadcn/ui
- **表单处理**: React Hook Form 7.63.0
- **数据验证**: Zod 4.1.11
- **WebSocket**: ws 8.18.3
- **缓存**: Redis (ioredis 5.8.0)
- **TypeScript**: 5.9.3
- **代码质量**: ESLint 9 + Prettier + Husky

## 环境要求

- Node.js >= 18.0.0
- npm >= 8.0.0
- MySQL 8.0+
- Redis (可选，用于缓存和实时通知)

## 项目结构

```
├── app/                    # Next.js App Router
│   ├── api/               # API路由
│   ├── (auth)/            # 认证相关页面
│   ├── (dashboard)/       # 主应用页面
├── components/            # React组件
│   ├── ui/                # shadcn/ui基础组件
│   ├── common/            # 通用业务组件
│   ├── inventory/         # 库存相关组件
│   ├── sales-orders/      # 销售订单组件
│   ├── products/          # 产品管理组件
├── lib/                   # 工具库和业务逻辑
│   ├── api/               # API处理器
│   ├── types/             # TypeScript类型定义
│   ├── validations/       # Zod验证schemas
│   ├── services/          # 业务服务层
│   ├── cache/             # 缓存相关
│   ├── utils/             # 工具函数
├── hooks/                 # React自定义hooks
├── prisma/                # Prisma schema和migrations
└── public/                # 静态资源
```
