# 全局约定规范

> 本文档解决现有规范文档中的冲突和空白，确立项目的最终决策标准。

全栈框架：Next.js 15.4 (App Router)

- 数据库：MySQL 8.0+
- 数据库驱动：Prisma
- 身份认证：Next-Auth.js
- 状态管理：TanStack Query v5.79.0
- UI组件库：Tailwind CSS v4.1.12 + shadcn/ui 2025.1.2
- 服务器管理：宝塔面板
- 文件上传：multer
- 环境管理：.env.local 文件
- 类型定义：TypeScript 5.2
- 代码质量工具：ESLint 9 + Prettier + Husky
- 表单处理：React Hook Form7.54.1
- 图片处理：sharp
- 数据验证：Zod 4.0

## 🎯 规范优先级

当多个规范文档存在冲突时，按以下优先级执行：

1. **本文档（全局约定规范）** - 最高优先级
2. `.augment/rules/` 目录下的规则文件
3. `docs/` 目录下的具体规范文档
4. 工具默认配置

## 🔧 关键决策点

### 组件定义方式（最终决定）

```typescript
// UI基础组件：使用 React.forwardRef
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, children, ...props }, ref) => (
    <button ref={ref} {...props}>{children}</button>
  )
);

// 业务组件：使用箭头函数
const UserProfile = ({ user }: UserProfileProps) => {
  return <div>{user.name}</div>;
};

// 复杂页面组件：使用命名函数（便于调试）
function UserDashboard({ userId }: UserDashboardProps) {
  // 复杂逻辑...
  return <div>...</div>;
}
```

### 文件命名最终规则

```
✅ 组件文件：PascalCase（优先级最高）
   Header.tsx, UserProfile.tsx, ProductForm.tsx

✅ 工具/库文件：kebab-case
   user-utils.ts, api-client.ts, data-validation.ts

✅ 页面文件：kebab-case（Next.js约定）
   app/user-profile/page.tsx

✅ 配置文件：按工具约定
   next.config.js, tailwind.config.js
```

### interface vs type 使用规则

```typescript
// 对象结构定义：使用 interface
interface UserProps {
  user: User;
  onEdit?: (user: User) => void;
}

// 联合类型、基础类型别名：使用 type
type Status = 'loading' | 'success' | 'error';
type UserRole = 'admin' | 'sales';
type EventHandler = (event: Event) => void;

// 组件Props：统一使用 interface
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive';
}
```

### 导入语句顺序（严格执行）

```typescript
// 1. React相关（如果需要）
import React from 'react';
import { useState, useEffect } from 'react';

// 2. 第三方库
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

// 3. Next.js相关
import { useRouter } from 'next/navigation';
import Image from 'next/image';

// 4. 绝对路径导入（@/开头）
import { Button } from '@/components/ui/button';
import { createUser } from '@/lib/api/users';
import type { User } from '@/lib/types/user';

// 5. 相对路径导入
import { validateForm } from '../utils/validation';
import './styles.css';
```

## 🚫 禁止事项（零容忍）

### 绝对禁止

```typescript
// ❌ 使用 any 类型
function process(data: any) { }

// ❌ 直接使用 process.env
const dbUrl = process.env.DATABASE_URL;

// ❌ 创建自定义CSS文件
// custom.css

// ❌ 使用内联样式
<div style={{ padding: '16px' }}>

// ❌ 直接使用原生HTML元素（当有shadcn/ui组件时）
<button>点击</button> // 应使用 <Button>

// ❌ 手动修改shadcn/ui组件源码
// components/ui/button.tsx 中添加自定义逻辑
```

### 严格限制

```typescript
// ⚠️ 非空断言：仅在绝对确定时使用
const user = getUser()!; // 需要注释说明原因

// ⚠️ 忽略ESLint：必须说明原因
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data: any = legacyApiResponse; // 原因：第三方API返回格式不确定
```

## 🔄 状态管理决策矩阵

| 状态类型       | 使用工具          | 示例                 |
| -------------- | ----------------- | -------------------- |
| 本地UI状态     | `useState`        | 模态框开关、表单输入 |
| 本地复杂状态   | `useReducer`      | 多步骤表单、复杂交互 |
| 服务器状态     | `TanStack Query`  | API数据、缓存        |
| 全局客户端状态 | `Zustand`         | 用户偏好、主题设置   |
| 表单状态       | `React Hook Form` | 所有表单处理         |

## 📊 数据流转换规则

### 数据库 → API → 前端

```typescript
// 数据库字段（snake_case）
(user_id, created_at, is_active);

// API响应（camelCase）
(userId, createdAt, isActive);

// 转换函数（必须）
function transformUser(dbUser: DbUser): ApiUser {
  return {
    userId: dbUser.user_id,
    createdAt: dbUser.created_at.toISOString(),
    isActive: dbUser.is_active,
  };
}
```

## 🔐 安全检查清单

### API路由必须包含

```typescript
export async function POST(request: Request) {
  // 1. 身份验证（必须）
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  // 2. 输入验证（必须）
  const body = await request.json();
  const validatedData = schema.parse(body);

  // 3. 权限检查（如需要）
  if (!hasPermission(session.user, 'create:user')) {
    return forbidden();
  }

  // 4. 业务逻辑
  // 5. 错误处理
}
```

## 📝 提交信息规范

### 格式要求

```bash
<类型>(<范围>): <描述>

# 类型（必须）
feat     # 新功能
fix      # 修复
docs     # 文档
style    # 格式
refactor # 重构
test     # 测试
chore    # 构建/工具

# 范围（推荐）
产品, 用户, 认证, 数据库, UI, API

# 示例
feat(产品): 添加批量删除功能
fix(认证): 修复登录状态检查
docs(API): 更新用户接口文档
```

## 🛠️ 开发流程检查点

### 代码提交前

- [ ] TypeScript编译无错误
- [ ] ESLint检查通过
- [ ] Prettier格式化完成
- [ ] 相关测试通过
- [ ] 提交信息符合规范

### 功能开发完成

- [ ] API文档更新
- [ ] 类型定义完整
- [ ] 错误处理覆盖
- [ ] 权限验证到位
- [ ] 用户体验测试

## 🎯 最终原则

1. **一致性胜过个人偏好** - 遵循团队约定
2. **自动化胜过手动检查** - 依赖工具而非记忆
3. **明确胜过灵活** - 清晰的规则胜过模糊的自由
4. **安全胜过便利** - 类型安全和数据验证不可妥协

---

_本规范为最终决策文档，如有冲突以此为准。_
