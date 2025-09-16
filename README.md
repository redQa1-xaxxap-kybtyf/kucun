# 库存管理工具

专为瓷砖行业设计的库存管理工具，支持销售、入库、客户管理等核心功能，提供移动端友好的操作体验。

## 技术栈

- **全栈框架**: Next.js 15.4 (App Router) + TypeScript 5.2
- **数据库**: MySQL 8.0+
- **数据库驱动**: Prisma
- **身份认证**: Next-Auth.js
- **状态管理**: TanStack Query v5.79.0
- **UI组件库**: Tailwind CSS v3.4.0 + shadcn/ui 2025.1.2
- **表单处理**: React Hook Form 7.54.1
- **数据验证**: Zod 3.22.0
- **文件上传**: multer
- **图片处理**: sharp
- **代码质量工具**: ESLint 8 + Prettier + Husky

## 开发环境要求

- Node.js >= 18.0.0
- npm >= 8.0.0
- MySQL 8.0+

## 快速开始

1. 克隆项目

```bash
git clone <repository-url>
cd kucun
```

2. 安装依赖

```bash
npm install
```

3. 配置环境变量

```bash
cp .env.example .env.local
# 编辑 .env.local 文件，配置数据库连接等信息
```

4. 启动开发服务器

```bash
npm run dev
```

5. 打开浏览器访问 [http://localhost:3000](http://localhost:3000)

## 可用脚本

- `npm run dev` - 启动开发服务器
- `npm run build` - 构建生产版本
- `npm run start` - 启动生产服务器
- `npm run lint` - 运行 ESLint 检查
- `npm run lint:fix` - 运行 ESLint 并自动修复
- `npm run type-check` - 运行 TypeScript 类型检查
- `npm run format` - 运行 Prettier 格式化
- `npm run format:check` - 检查代码格式

## 项目结构

```
├── app/                    # Next.js App Router 页面
│   ├── api/               # API 路由
│   ├── (auth)/            # 认证相关页面
│   ├── dashboard/         # 仪表盘
│   ├── sales/             # 销售管理
│   ├── inventory/         # 库存管理
│   ├── customers/         # 客户管理
│   ├── globals.css        # 全局样式
│   ├── layout.tsx         # 根布局
│   └── page.tsx           # 首页
├── components/            # 组件
│   ├── ui/                # shadcn/ui 基础组件
│   └── common/            # 业务组件
├── lib/                   # 工具库
│   ├── env.ts             # 环境变量配置
│   └── utils.ts           # 工具函数
├── types/                 # 类型定义
└── public/                # 静态资源
```

## 开发规范

本项目严格遵循以下开发规范：

1. **全栈类型安全**: 使用 TypeScript + Prisma + Zod 确保端到端类型安全
2. **组件复用**: 严格使用 shadcn/ui 组件库，禁止重复开发
3. **代码质量**: 通过 ESLint + Prettier + Husky 确保代码质量
4. **命名规范**:
   - 数据库: snake_case
   - API响应: camelCase
   - 前端: camelCase
   - 环境变量: UPPER_SNAKE_CASE

## 许可证

MIT License
