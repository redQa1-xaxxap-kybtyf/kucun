# 库存搜索框输入丢失问题修复

## 🐛 问题描述

**严重 Bug**：在库存总览页面的搜索框中连续输入字符时，只能显示第一个字符，后续输入的字符全部丢失。

**复现步骤**：

1. 打开库存总览页面 `/inventory`
2. 在搜索框中快速连续输入 "00000"（5个0）
3. **预期**：搜索框显示 "00000"
4. **实际**：搜索框只显示 "0"（第一个字符）

## 🔍 问题分析

### 根本原因

**状态不同步**：父组件传递给子组件的 `queryParams` 使用的是 `initialParams`（初始参数），而不是当前的搜索状态。

### 数据流分析

```typescript
// ❌ 问题代码流程
1. 用户输入 "0"
   ↓
2. handleSearch("0") 被调用
   ↓
3. setSearch("0") - 更新本地状态
   ↓
4. 组件重渲染
   ↓
5. 传递给子组件: queryParams={initialParams}
   ↓
6. 子组件读取: searchValue={queryParams.search || ''}
   ↓
7. queryParams.search 仍然是 undefined（初始值）
   ↓
8. 搜索框显示空字符串 ""
   ↓
9. 用户输入第二个 "0"
   ↓
10. 重复步骤 2-8，搜索框又被重置为 ""
```

### 问题代码定位

**文件**：`app/(dashboard)/inventory/page-client.tsx`

```typescript
// ❌ 错误：传递初始参数
<ERPInventoryList
  queryParams={initialParams}  // 这个值永远不会更新！
  onSearch={handleSearch}
  // ...
/>
```

**文件**：`components/inventory/InventorySearchToolbar.tsx`

```typescript
// 子组件使用 queryParams.search
<UnifiedSearchBar
  searchValue={queryParams.search || ''}  // 读取的是初始值
  onSearchChange={onSearch}
  // ...
/>
```

### 为什么只显示一个字符？

1. **第一次输入**：
   - 用户输入 "0"
   - `setSearch("0")` 更新本地状态
   - 组件重渲染，但传递的仍是 `initialParams`
   - 搜索框被重置为空

2. **第二次输入**：
   - 用户输入第二个 "0"
   - 由于搜索框已被重置，输入框的值是 ""
   - 用户输入后，值变成 "0"（只有一个字符）
   - 又被重置...

3. **循环往复**：
   - 每次输入都会触发重置
   - 所以永远只能看到一个字符

## ✅ 修复方案

### 解决方案：传递当前状态

创建一个包含当前本地状态的 `currentQueryParams` 对象，并传递给子组件。

```typescript
// ✅ 修复后的代码
const currentQueryParams: InventoryQueryParams = React.useMemo(
  () => ({
    search,        // ✅ 使用当前本地状态
    categoryId,    // ✅ 使用当前本地状态
    lowStock,      // ✅ 使用当前本地状态
    hasStock,      // ✅ 使用当前本地状态
    sortBy,        // ✅ 使用当前本地状态
    sortOrder,     // ✅ 使用当前本地状态
    page: initialParams.page,    // URL 参数
    limit: initialParams.limit,  // URL 参数
  }),
  [search, categoryId, lowStock, hasStock, sortBy, sortOrder, initialParams]
);

// ✅ 传递当前状态
<ERPInventoryList
  queryParams={currentQueryParams}  // 包含最新的搜索值
  onSearch={handleSearch}
  // ...
/>
```

### 为什么使用 useMemo？

```typescript
// ✅ 使用 useMemo 避免每次渲染都创建新对象
const currentQueryParams = React.useMemo(
  () => ({ search, categoryId, ... }),
  [search, categoryId, ...]
);
```

**优势**：

- 只在依赖项变化时才创建新对象
- 避免子组件不必要的重渲染（React.memo 可以正确工作）
- 提升性能

## 🎯 修复效果

### 修复前

```
用户输入: 0 0 0 0 0
显示结果: 0
```

### 修复后

```
用户输入: 0 0 0 0 0
显示结果: 00000 ✅
```

## 📊 技术细节

### 状态管理架构

```
┌─────────────────────────────────────┐
│  InventoryPageClient (父组件)       │
│                                     │
│  本地状态:                          │
│  - search (即时更新)                │
│  - categoryId                       │
│  - lowStock                         │
│  - hasStock                         │
│  - sortBy                           │
│  - sortOrder                        │
│                                     │
│  URL 状态:                          │
│  - initialParams (来自 URL)         │
│                                     │
│  合并状态:                          │
│  - currentQueryParams ✅            │
│    = 本地状态 + URL 参数            │
└─────────────────────────────────────┘
           ↓ 传递 currentQueryParams
┌─────────────────────────────────────┐
│  ERPInventoryList (子组件)          │
│                                     │
│  接收: queryParams                  │
└─────────────────────────────────────┘
           ↓ 传递 queryParams
┌─────────────────────────────────────┐
│  InventorySearchToolbar             │
│                                     │
│  使用: queryParams.search ✅        │
└─────────────────────────────────────┘
           ↓ 传递给
┌─────────────────────────────────────┐
│  UnifiedSearchBar                   │
│                                     │
│  显示: searchValue ✅               │
└─────────────────────────────────────┘
```

### 数据流向

```
用户输入
  ↓
handleSearch(value)
  ↓
setSearch(value) - 更新本地状态
  ↓
组件重渲染
  ↓
currentQueryParams 更新（useMemo）
  ↓
传递给子组件
  ↓
搜索框显示最新值 ✅
```

## 🔧 相关修改

### 修改的文件

- `app/(dashboard)/inventory/page-client.tsx`

### 修改内容

1. 添加 `currentQueryParams` 计算属性
2. 使用 `React.useMemo` 优化性能
3. 将 `currentQueryParams` 传递给子组件

## 🧪 测试验证

### 测试用例

1. **连续输入测试**
   - 输入：快速输入 "00000"
   - 预期：显示 "00000" ✅

2. **删除测试**
   - 输入："hello"，然后删除到 "hel"
   - 预期：正确显示 "hel" ✅

3. **中文输入测试**
   - 输入：中文 "测试"
   - 预期：正确显示 "测试" ✅

4. **特殊字符测试**
   - 输入："@#$%"
   - 预期：正确显示 "@#$%" ✅

5. **快速输入测试**
   - 输入：快速输入 20 个字符
   - 预期：所有字符都正确显示 ✅

## 💡 经验教训

### 1. 状态同步问题

**问题**：父组件的本地状态和传递给子组件的 props 不一致

**教训**：

- 确保传递给子组件的 props 包含最新的状态
- 不要直接传递初始参数，而是传递当前状态

### 2. 受控组件的正确使用

**问题**：受控组件的 value 来源不正确

**教训**：

- 受控组件的 value 必须来自当前状态
- 不能使用过时的或初始的值

### 3. 性能优化

**问题**：每次渲染都创建新对象导致子组件重渲染

**教训**：

- 使用 `useMemo` 缓存计算结果
- 避免在 render 中创建新对象

## 📚 参考资料

- [React 受控组件](https://react.dev/reference/react-dom/components/input#controlling-an-input-with-a-state-variable)
- [useMemo 优化](https://react.dev/reference/react/useMemo)
- [React.memo 性能优化](https://react.dev/reference/react/memo)

## ✅ 修复确认

- [x] 连续输入字符正常显示
- [x] 删除字符正常工作
- [x] 中文输入正常
- [x] 特殊字符输入正常
- [x] 快速输入无丢失
- [x] 性能优化（useMemo）
- [x] 代码质量检查通过
