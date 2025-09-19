---
type: 'always_apply'
---

# ESLint规范遵循指南

> 确保代码提交时不出错的完整指南

## 🚨 当前主要问题

根据ESLint检查结果，项目存在以下主要问题：

### 1. TypeScript类型问题

```typescript
// ❌ 错误：使用any类型
function process(data: any) {}

// ✅ 正确：明确类型定义
function process(data: UserData) {}
function process<T>(data: T): T {}
```

### 2. 非空断言问题

```typescript
// ❌ 错误：使用非空断言
const user = getUser()!;
const name = user.name!;

// ✅ 正确：安全的空值检查
const user = getUser();
if (user) {
  const name = user.name || '默认名称';
}
```

### 3. 导入顺序问题

```typescript
// ❌ 错误：导入顺序混乱
import { Button } from '@/components/ui/button';
import React from 'react';
import { useQuery } from '@tanstack/react-query';

// ✅ 正确：按规定顺序导入
import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
```

### 4. 文件长度问题

```typescript
// ❌ 错误：文件超过300行
// 函数超过50行

// ✅ 正确：拆分为多个文件/函数
// 每个文件不超过300行
// 每个函数不超过50行
```

## 🔧 修复策略

### 立即修复（Error级别）

#### 1. 替换any类型

```bash
# 搜索所有any类型使用
grep -r ": any" --include="*.ts" --include="*.tsx" .

# 常见替换方案：
any → unknown          # 未知类型
any → object          # 对象类型
any → Record<string, unknown>  # 键值对对象
```

#### 2. 移除非空断言

```typescript
// 替换模式
obj.prop!           → obj.prop ?? defaultValue
arr[0]!            → arr[0] ?? defaultValue
func()!.method     → func()?.method
```

#### 3. 修复导入顺序

```typescript
// 使用ESLint自动修复
npm run lint:fix

// 手动调整顺序：
// 1. React相关
// 2. 第三方库
// 3. Next.js相关
// 4. @/开头的绝对路径
// 5. 相对路径
```

#### 4. 修复重复导入

```typescript
// ❌ 错误
import { A } from 'module';
import { B } from 'module';

// ✅ 正确
import { A, B } from 'module';
```

### 渐进修复（Warning级别）

#### 1. 拆分长文件

```typescript
// 策略：按功能模块拆分
UserPage.tsx (726行) →
  ├── UserList.tsx
  ├── UserForm.tsx
  ├── UserActions.tsx
  └── UserFilters.tsx
```

#### 2. 拆分长函数

```typescript
// 策略：提取子函数
function longFunction() {
  // 587行代码
}

// 拆分为：
function longFunction() {
  const data = prepareData();
  const result = processData(data);
  return formatResult(result);
}

function prepareData() {
  /* ... */
}
function processData(data) {
  /* ... */
}
function formatResult(result) {
  /* ... */
}
```

#### 3. 移除未使用变量

```typescript
// ❌ 错误：未使用的导入
import { Calendar, TrendingUp } from 'lucide-react';

// ✅ 正确：只导入使用的
import { Calendar } from 'lucide-react';

// 或者使用下划线前缀
const _unusedVar = getValue(); // 临时保留
```

## 🛠️ 自动化修复

### 1. 运行自动修复

```bash
# 自动修复可修复的问题
npm run lint:fix

# 检查修复结果
npm run lint
```

### 2. 分批修复

```bash
# 只检查特定目录
npx eslint app/api --fix
npx eslint components --fix
npx eslint lib --fix
```

### 3. 忽略特定规则（临时）

```typescript
// 文件级别忽略
/* eslint-disable @typescript-eslint/no-explicit-any */

// 行级别忽略（需要注释原因）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data: any = legacyApiResponse; // 第三方API返回格式不确定
```

## 📋 提交前检查清单

### 必须通过的检查

- [ ] `npm run lint` 无Error级别错误
- [ ] `npm run type-check` TypeScript编译通过
- [ ] `npm run format` Prettier格式化完成

### 推荐完成的检查

- [ ] Warning级别错误数量减少
- [ ] 新增代码遵循规范
- [ ] 函数长度控制在50行内
- [ ] 文件长度控制在300行内

## 🎯 优先修复顺序

### 第一优先级（阻止提交）

1. **any类型** - 影响类型安全
2. **非空断言** - 可能导致运行时错误
3. **重复导入** - 代码质量问题
4. **导入顺序** - 影响可读性

### 第二优先级（逐步改进）

1. **文件长度** - 影响维护性
2. **函数长度** - 影响可读性
3. **未使用变量** - 代码清洁度
4. **console语句** - 生产环境清理

## 🔄 持续改进

### 1. 设置编辑器

```json
// .vscode/settings.json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "editor.formatOnSave": true
}
```

### 2. Git钩子

```bash
# 提交前自动检查
git add .
git commit -m "feat: 新功能"
# 自动运行 lint-staged 检查
```

### 3. 团队规范

- 新代码必须通过所有ESLint检查
- 修改现有代码时顺便修复相关ESLint问题
- 定期进行代码质量清理

## 📊 修复进度跟踪

### 当前状态

- **Error级别**: ~200个错误需要修复
- **Warning级别**: ~100个警告需要改进
- **主要问题**: any类型、非空断言、文件过长

### 目标状态

- **Error级别**: 0个错误
- **Warning级别**: <20个警告
- **代码质量**: 所有新代码符合规范

---

**记住**: ESLint规范不是限制，而是保证代码质量和团队协作的工具！
