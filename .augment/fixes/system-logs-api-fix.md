# 系统日志 API 500 错误修复

## 问题描述

设置日志页面调用 `/api/settings/logs` 接口时返回 500 错误。

**错误原因**：
- Prisma schema 中 `SystemLog` 模型缺少与 `User` 模型的关系定义
- API 代码尝试使用 `include: { user: ... }` 查询用户信息，但关系不存在
- 导致 Prisma 查询失败，返回 500 错误

## 修复内容

### 1. 修改 Prisma Schema

**文件**：`prisma/schema.prisma`

#### 在 User 模型中添加关系（第 34 行）：
```prisma
model User {
  // ... 其他字段
  
  // 关系定义
  factoryShipmentOrders        FactoryShipmentOrder[] @relation("FactoryShipmentOrders")
  salesOrders                  SalesOrder[]           @relation("UserSalesOrders")
  // ... 其他关系
  systemLogs                   SystemLog[]            @relation("UserSystemLogs")  // ← 新增
}
```

#### 在 SystemLog 模型中添加关系（第 877 行）：
```prisma
model SystemLog {
  id          String   @id @default(uuid()) @db.Char(36)
  type        String   @db.VarChar(64)
  level       String   @db.VarChar(32)
  action      String   @db.VarChar(100)
  description String   @db.VarChar(255)
  userId      String?  @map("user_id") @db.Char(36)
  // ... 其他字段
  
  // 关系定义  ← 新增
  user User? @relation("UserSystemLogs", fields: [userId], references: [id], onDelete: SetNull)
  
  @@index([type])
  @@index([level])
  @@index([action])
  @@index([userId], map: "idx_system_logs_user")
  @@map("system_logs")
}
```

### 2. 重新生成 Prisma Client

**重要**：需要重启开发服务器以应用更改

```bash
# 1. 停止开发服务器（Ctrl+C）

# 2. 格式化 Prisma schema（已完成）
npx prisma format

# 3. 生成 Prisma Client
npx prisma generate

# 4. 重启开发服务器
npm run dev
```

## 技术说明

### 为什么不需要数据库迁移？

- 我们只是在 Prisma schema 中添加了**关系定义**
- 关系定义是 Prisma ORM 层面的概念，用于类型安全的查询
- 数据库表结构没有变化（`userId` 字段已经存在）
- 因此不需要运行 `prisma migrate`

### 关系定义说明

```prisma
// SystemLog 模型中的关系定义
user User? @relation("UserSystemLogs", fields: [userId], references: [id], onDelete: SetNull)
```

- `user User?`：定义一个可选的 User 关系字段
- `@relation("UserSystemLogs")`：关系名称，与 User 模型中的对应
- `fields: [userId]`：本模型中的外键字段
- `references: [id]`：引用 User 模型的主键
- `onDelete: SetNull`：当用户被删除时，将 userId 设置为 null（保留日志记录）

## 验证修复

### 1. 检查 Prisma Client 生成

```bash
npx prisma generate
```

应该看到：
```
✔ Generated Prisma Client (v5.x.x) to ./node_modules/@prisma/client
```

### 2. 测试 API 端点

访问：`http://localhost:3000/settings/logs`

应该能够正常加载系统日志列表，不再出现 500 错误。

### 3. 检查日志查询

API 现在可以正确执行以下查询：

```typescript
const logs = await prisma.systemLog.findMany({
  where,
  include: {
    user: {
      select: {
        id: true,
        name: true,
        username: true,
      },
    },
  },
  orderBy: {
    createdAt: 'desc',
  },
  skip,
  take: validatedRequest.limit,
});
```

## 相关文件

- `prisma/schema.prisma` - Prisma 数据模型定义
- `app/api/settings/logs/route.ts` - 系统日志 API 路由
- `app/(dashboard)/settings/logs/page.tsx` - 系统日志页面

## 注意事项

1. **Windows 文件锁定问题**：
   - 如果 `npx prisma generate` 报错 `EPERM: operation not permitted`
   - 需要先停止开发服务器，再运行命令

2. **开发环境绕过认证**：
   - API 代码中有开发环境绕过认证的逻辑
   - 生产环境会正常验证管理员权限

3. **类型安全**：
   - 添加关系后，TypeScript 会自动推导 `user` 字段的类型
   - 不需要手动定义类型

## 后续优化建议

1. **添加更多关系**：
   - 考虑为其他日志相关的模型添加类似的关系定义
   - 例如：SettingChangeLog 也可以添加 user 关系

2. **性能优化**：
   - 如果日志量很大，考虑添加分页优化
   - 可以使用游标分页代替偏移分页

3. **错误处理**：
   - API 已经有基本的错误处理
   - 可以考虑添加更详细的错误日志记录

---

**修复完成时间**：2025-11-02  
**修复人员**：AI Assistant  
**影响范围**：系统日志查询功能

