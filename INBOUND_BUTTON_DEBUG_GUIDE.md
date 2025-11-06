# 入库记录"新增入库"按钮调试指南

> 🎯 **问题**: Admin 账号登录后,在入库记录页面 (`/inventory/inbound`) 看不到"新增入库"按钮

## 📋 快速诊断步骤

### 第一步: 访问页面并打开调试工具

1. **访问入库记录页面**:

   ```
   http://localhost:3000/inventory/inbound
   ```

2. **打开浏览器开发者工具**:
   - Windows/Linux: `F12` 或 `Ctrl+Shift+I`
   - Mac: `Cmd+Option+I`

3. **点击右下角的"🐛 调试 Session"按钮**
   - 这会显示一个黄色的调试面板
   - 面板会显示所有 session 和权限信息

### 第二步: 检查调试面板信息

#### ✅ 正常情况应该显示:

```
Session 状态: authenticated
用户信息:
  - 角色: admin (紫色加粗)
inventory:inbound 权限: ✅ 有权限 - 按钮应该显示
所有权限: 包含 inventory:inbound (绿色加粗)
```

#### ❌ 如果看到以下情况,说明有问题:

**情况 1: Session 状态不是 "authenticated"**

```
Session 状态: loading 或 unauthenticated
```

**解决方案**:

- 等待页面加载完成
- 如果一直是 loading,刷新页面
- 如果是 unauthenticated,重新登录

**情况 2: 角色不是 "admin"**

```
角色: sales 或 warehouse 或 finance
```

**解决方案**:

- 确认你登录的账号确实是 admin
- 检查数据库中该用户的 role 字段
- 尝试重新登录

**情况 3: 权限检查失败**

```
inventory:inbound 权限: ❌ 无权限
```

**解决方案**:

- 检查 `lib/auth/permissions.ts` 中 admin 角色的权限配置
- 查看下方的"权限配置检查"部分

### 第三步: 检查浏览器控制台日志

在开发者工具的 **Console** 标签中,查找以下日志:

```javascript
🐛 [InboundRecordsToolbar] Session 数据: {
  hasSession: true,
  hasUser: true,
  userId: "xxx",
  username: "admin",
  role: "admin",  // ← 这里应该是 "admin"
  fullSession: {...}
}

🐛 [InboundRecordsToolbar] 权限检查: {
  hasInboundPermission: true,  // ← 这里应该是 true
  userRole: "admin",
  expectedRoles: ["admin", "warehouse"]
}
```

#### 如果日志显示异常:

**异常 1: `role` 是 undefined 或 null**

```javascript
role: undefined; // ❌ 问题
```

**原因**: Session 中没有正确设置 role
**解决方案**: 查看"Session 配置检查"部分

**异常 2: `hasInboundPermission` 是 false**

```javascript
hasInboundPermission: false; // ❌ 问题
```

**原因**: 权限检查函数返回 false
**解决方案**: 查看"权限配置检查"部分

### 第四步: 检查 DOM 元素

在开发者工具的 **Elements** 标签中:

1. **搜索按钮文本**:
   - 按 `Ctrl+F` (Mac: `Cmd+F`)
   - 搜索 "新增入库"
   - 如果找到,说明按钮存在但可能被隐藏
   - 如果找不到,说明按钮确实没有渲染

2. **检查按钮是否被 CSS 隐藏**:
   - 如果找到按钮元素,检查其样式
   - 查看是否有 `display: none` 或 `visibility: hidden`
   - 查看是否有 `opacity: 0`

## 🔍 深度诊断

### 权限配置检查

**检查文件**: `lib/auth/permissions.ts`

**验证 admin 角色权限**:

```typescript
// 第 100-170 行
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    // ... 其他权限
    'inventory:inbound', // ← 确认这一行存在
    // ... 其他权限
  ],
  // ...
};
```

**验证权限检查函数**:

```typescript
// 第 284-297 行
export function can(user: AuthUser | null, permission: Permission): boolean {
  if (!user) {
    return false; // ← 如果 user 为 null,返回 false
  }

  const rolePermissions = ROLE_PERMISSIONS[user.role as Role];
  if (!rolePermissions) {
    return false; // ← 如果角色不存在,返回 false
  }

  return rolePermissions.includes(permission); // ← 检查权限列表
}
```

### Session 配置检查

**检查文件**: `lib/auth.ts`

**验证 Session 类型定义** (第 17-28 行):

```typescript
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      username: string;
      name: string;
      role: string; // ← 确认有 role 字段
      status: string;
      avatar?: string;
    };
  }
}
```

**验证 Session 回调** (第 255-264 行):

```typescript
async session({ session, token }) {
  if (token) {
    session.user.id = token.id;
    session.user.username = token.username;
    session.user.role = token.role;  // ← 确认 role 被设置
    session.user.status = token.status;
  }
  return session;
}
```

**验证 JWT 回调** (第 245-253 行):

```typescript
async jwt({ token, user }) {
  if (user) {
    token.id = user.id;
    token.username = user.username;
    token.role = user.role;  // ← 确认 role 被设置
    token.status = user.status;
  }
  return token;
}
```

### 数据库检查

**检查用户角色**:

```sql
-- 查询当前登录用户的角色
SELECT id, username, email, role, status
FROM User
WHERE username = 'admin';  -- 替换为你的用户名
```

**预期结果**:

```
role: "admin"
status: "active"
```

**如果角色不是 admin**:

```sql
-- 更新用户角色为 admin
UPDATE User
SET role = 'admin'
WHERE username = 'admin';  -- 替换为你的用户名
```

## 🛠️ 常见问题解决方案

### 问题 1: Session 一直是 loading

**原因**: NextAuth 配置问题或网络问题

**解决方案**:

1. 检查 `.env` 文件中的 `NEXTAUTH_SECRET` 是否配置
2. 检查 `NEXTAUTH_URL` 是否正确
3. 重启开发服务器: `npm run dev`
4. 清除浏览器缓存并重新登录

### 问题 2: Session 中没有 role 字段

**原因**: JWT 或 Session 回调没有正确设置

**解决方案**:

1. 检查 `lib/auth.ts` 中的 callbacks 配置
2. 重新登录(旧的 JWT token 可能没有 role)
3. 清除浏览器的 cookies
4. 重启开发服务器

### 问题 3: 权限检查返回 false

**原因**:

- admin 角色的权限配置中缺少 `inventory:inbound`
- 权限检查函数有 bug
- user.role 的值不匹配

**解决方案**:

1. 检查 `lib/auth/permissions.ts` 第 127 行
2. 确认 `'inventory:inbound'` 在 admin 权限列表中
3. 检查 user.role 的值是否完全匹配 'admin' (注意大小写)

### 问题 4: 按钮存在但不可见

**原因**: CSS 样式问题或父组件隐藏

**解决方案**:

1. 在 Elements 标签中找到按钮元素
2. 检查 Computed 样式
3. 查看是否有父元素设置了 `overflow: hidden`
4. 检查 z-index 是否被其他元素覆盖

### 问题 5: 浏览器缓存问题

**解决方案**:

1. 硬刷新页面: `Ctrl+Shift+R` (Mac: `Cmd+Shift+R`)
2. 清除浏览器缓存:
   - Chrome: `Ctrl+Shift+Delete`
   - 选择"缓存的图片和文件"
   - 点击"清除数据"
3. 重新登录

## 📝 手动测试步骤

### 在浏览器控制台执行以下代码:

```javascript
// 1. 检查 session
const session = await fetch('/api/auth/session').then(r => r.json());
console.log('Session:', session);

// 2. 检查用户角色
console.log('User Role:', session?.user?.role);

// 3. 手动测试权限检查
// (需要先导入 can 函数,或者在组件中测试)
```

### 在 React DevTools 中检查:

1. 安装 React DevTools 浏览器扩展
2. 打开 Components 标签
3. 找到 `InboundRecordsToolbar` 组件
4. 查看 hooks 中的 `session` 值
5. 查看 `hasInboundPermission` 的值

## 🎯 最终验证

如果所有检查都通过,按钮应该显示。如果仍然不显示:

1. **重启开发服务器**:

   ```bash
   # 停止服务器 (Ctrl+C)
   npm run dev
   ```

2. **清除所有缓存**:

   ```bash
   # 清除 Next.js 缓存
   rm -rf .next

   # 重新安装依赖 (如果怀疑依赖问题)
   rm -rf node_modules
   npm install
   ```

3. **重新登录**:
   - 退出登录
   - 清除浏览器 cookies
   - 重新登录

4. **检查环境变量**:
   ```bash
   # 确认 .env 文件存在且配置正确
   cat .env | grep NEXTAUTH
   ```

## 📞 需要进一步帮助?

如果以上步骤都无法解决问题,请提供以下信息:

1. 调试面板的截图
2. 浏览器控制台的完整日志
3. `session` 对象的完整 JSON
4. 数据库中用户记录的截图
5. 是否有任何错误信息

---

**调试工具位置**:

- 调试组件: `components/debug/session-debug.tsx`
- 页面文件: `app/(dashboard)/inventory/inbound/page-client.tsx`
- 工具栏组件: `components/inventory/forms/inbound-records-toolbar.tsx`

**完成调试后,记得移除调试代码!**
