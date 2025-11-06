# 入库记录"新增入库"按钮诊断总结

> 🎯 **问题**: Admin 账号登录后,在 `/inventory/inbound` 页面看不到"新增入库"按钮

## 🚀 快速开始 (3 分钟诊断)

### 方法 1: 使用页面内调试工具 (推荐)

1. **访问入库记录页面**:

   ```
   http://localhost:3000/inventory/inbound
   ```

2. **点击右下角的"🐛 调试 Session"按钮**
   - 黄色浮动按钮会出现在页面右下角
   - 点击后展开调试面板

3. **查看调试信息**:
   - ✅ Session 状态应该是 "authenticated"
   - ✅ 角色应该是 "admin" (紫色加粗)
   - ✅ inventory:inbound 权限应该显示 "✅ 有权限"

### 方法 2: 使用独立调试页面

1. **访问调试工具**:

   ```
   http://localhost:3000/test-session-debug.html
   ```

2. **点击"检查 Session"按钮**
   - 查看 Session 数据
   - 自动运行诊断

3. **点击"测试权限检查"按钮**
   - 验证权限系统是否正常

### 方法 3: 使用命令行检查

```bash
# 检查数据库中的 admin 用户
npx tsx scripts/check-admin-user.ts
```

## 📋 已添加的调试工具

### 1. 页面内调试组件

**文件**: `components/debug/session-debug.tsx`

**功能**:

- 实时显示 Session 状态
- 显示用户信息和角色
- 检查 inventory:inbound 权限
- 列出所有权限
- 提供诊断建议

**使用位置**: 已添加到 `app/(dashboard)/inventory/inbound/page-client.tsx`

### 2. 浏览器控制台日志

**文件**: `components/inventory/forms/inbound-records-toolbar.tsx`

**日志内容**:

```javascript
🐛 [InboundRecordsToolbar] Session 数据: {
  hasSession: true/false,
  hasUser: true/false,
  userId: "xxx",
  username: "admin",
  role: "admin",
  fullSession: {...}
}

🐛 [InboundRecordsToolbar] 权限检查: {
  hasInboundPermission: true/false,
  userRole: "admin",
  expectedRoles: ["admin", "warehouse"]
}
```

**查看方式**:

1. 打开浏览器开发者工具 (F12)
2. 切换到 Console 标签
3. 查找 "🐛 [InboundRecordsToolbar]" 开头的日志

### 3. 独立调试页面

**文件**: `public/test-session-debug.html`

**访问地址**: `http://localhost:3000/test-session-debug.html`

**功能**:

- Session 检查
- 权限测试
- 自动诊断
- 提供修复建议

### 4. 数据库检查脚本

**文件**: `scripts/check-admin-user.ts`

**运行命令**: `npx tsx scripts/check-admin-user.ts`

**功能**:

- 列出所有 admin 用户
- 显示用户状态
- 统计角色分布
- 提供修复建议

## 🔍 诊断流程图

```
开始
  ↓
访问 /inventory/inbound
  ↓
点击"🐛 调试 Session"按钮
  ↓
检查 Session 状态
  ├─ ❌ unauthenticated → 重新登录
  ├─ ⏳ loading → 等待或刷新页面
  └─ ✅ authenticated → 继续
      ↓
检查用户角色
  ├─ ❌ 不是 admin → 切换账号或修改数据库
  └─ ✅ 是 admin → 继续
      ↓
检查 inventory:inbound 权限
  ├─ ❌ 无权限 → 检查权限配置
  └─ ✅ 有权限 → 继续
      ↓
检查浏览器控制台日志
  ├─ hasInboundPermission: false → 权限检查逻辑有问题
  └─ hasInboundPermission: true → 继续
      ↓
检查 DOM 元素
  ├─ 找不到"新增入库"文本 → 组件未渲染
  └─ 找到但不可见 → CSS 问题
      ↓
问题解决 ✅
```

## 🛠️ 常见问题和解决方案

### 问题 1: Session 状态一直是 "loading"

**可能原因**:

- NextAuth 配置问题
- 网络请求失败
- 环境变量未配置

**解决方案**:

```bash
# 1. 检查环境变量
cat .env | grep NEXTAUTH

# 2. 重启开发服务器
npm run dev

# 3. 清除浏览器缓存
# Chrome: Ctrl+Shift+Delete
```

### 问题 2: 角色不是 "admin"

**检查数据库**:

```sql
SELECT id, username, email, role, status
FROM User
WHERE username = 'admin';
```

**修复数据库**:

```sql
UPDATE User
SET role = 'admin', status = 'active'
WHERE username = 'admin';
```

**或使用脚本**:

```bash
npx tsx scripts/check-admin-user.ts
```

### 问题 3: Session 中没有 role 字段

**原因**: JWT token 中没有 role 信息

**解决方案**:

1. 检查 `lib/auth.ts` 中的 callbacks 配置
2. 重新登录(清除旧的 JWT token)
3. 清除浏览器 cookies

**验证配置**:

```typescript
// lib/auth.ts 第 245-264 行
callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.role = user.role;  // ← 确认这行存在
    }
    return token;
  },
  async session({ session, token }) {
    if (token) {
      session.user.role = token.role;  // ← 确认这行存在
    }
    return session;
  },
}
```

### 问题 4: 权限检查返回 false

**检查权限配置**:

```typescript
// lib/auth/permissions.ts 第 100-170 行
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    // ... 其他权限
    'inventory:inbound', // ← 确认这行存在
    // ... 其他权限
  ],
};
```

**验证权限检查函数**:

```typescript
// lib/auth/permissions.ts 第 284-297 行
export function can(user: AuthUser | null, permission: Permission): boolean {
  if (!user) return false;
  const rolePermissions = ROLE_PERMISSIONS[user.role as Role];
  if (!rolePermissions) return false;
  return rolePermissions.includes(permission);
}
```

### 问题 5: 按钮存在但不可见

**检查 DOM**:

1. 打开开发者工具 (F12)
2. 切换到 Elements 标签
3. 按 Ctrl+F 搜索 "新增入库"
4. 如果找到,检查元素的样式

**可能的 CSS 问题**:

- `display: none`
- `visibility: hidden`
- `opacity: 0`
- `z-index` 被覆盖
- 父元素 `overflow: hidden`

## 📊 验证清单

使用以下清单逐项检查:

- [ ] Session 状态是 "authenticated"
- [ ] session.user 存在
- [ ] session.user.id 有值
- [ ] session.user.username 有值
- [ ] session.user.role === "admin"
- [ ] session.user.status === "active"
- [ ] 控制台日志显示 hasInboundPermission: true
- [ ] admin 角色在权限配置中包含 'inventory:inbound'
- [ ] can() 函数正常工作
- [ ] DOM 中存在"新增入库"文本
- [ ] 按钮没有被 CSS 隐藏

## 🎯 预期结果

如果一切正常,你应该看到:

### 1. 调试面板显示:

```
Session 状态: authenticated ✅
用户信息:
  - 角色: admin (紫色加粗)
  - 状态: active
inventory:inbound 权限: ✅ 有权限 - 按钮应该显示
所有权限: 包含 inventory:inbound (绿色加粗)
```

### 2. 控制台日志显示:

```javascript
🐛 [InboundRecordsToolbar] Session 数据: {
  hasSession: true,
  hasUser: true,
  userId: "xxx",
  username: "admin",
  role: "admin",
  fullSession: {...}
}

🐛 [InboundRecordsToolbar] 权限检查: {
  hasInboundPermission: true,
  userRole: "admin",
  expectedRoles: ["admin", "warehouse"]
}
```

### 3. 页面上显示:

- 页面标题: "入库记录"
- 左侧按钮: "返回"
- 右侧按钮: "新增入库" (绿色,带 Plus 图标)

## 🧹 完成调试后的清理

调试完成后,记得移除调试代码:

### 1. 移除页面内调试组件

```typescript
// app/(dashboard)/inventory/inbound/page-client.tsx
// 删除以下行:
import { SessionDebug } from '@/components/debug/session-debug';
<SessionDebug />
```

### 2. 移除控制台日志

```typescript
// components/inventory/forms/inbound-records-toolbar.tsx
// 删除所有 console.log 语句
```

### 3. 可选: 保留调试工具供将来使用

如果想保留调试工具:

- `components/debug/session-debug.tsx` - 可以保留
- `public/test-session-debug.html` - 可以保留
- `scripts/check-admin-user.ts` - 可以保留

只需要从页面中移除 `<SessionDebug />` 组件即可。

## 📞 需要进一步帮助?

如果以上所有步骤都无法解决问题,请提供:

1. **调试面板的截图**
2. **浏览器控制台的完整日志**
3. **Session 对象的完整 JSON**
4. **数据库查询结果**:
   ```sql
   SELECT * FROM User WHERE username = 'admin';
   ```
5. **环境变量配置** (隐藏敏感信息):
   ```bash
   cat .env | grep NEXTAUTH
   ```

## 📚 相关文件

- 调试组件: `components/debug/session-debug.tsx`
- 页面文件: `app/(dashboard)/inventory/inbound/page-client.tsx`
- 工具栏组件: `components/inventory/forms/inbound-records-toolbar.tsx`
- 权限配置: `lib/auth/permissions.ts`
- NextAuth 配置: `lib/auth.ts`
- 调试页面: `public/test-session-debug.html`
- 检查脚本: `scripts/check-admin-user.ts`
- 详细指南: `INBOUND_BUTTON_DEBUG_GUIDE.md`

---

**最后更新**: 2025-01-05
**状态**: 已添加完整的调试工具和文档
