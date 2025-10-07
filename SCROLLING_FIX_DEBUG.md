# 库存页面滚动修复 - 调试指南

## 修改的文件

### 1. `components/common/DashboardLayoutClient.tsx`

**关键修改：** 主内容区域从 `overflow-auto` 改为 `overflow-hidden`

```tsx
{
  /* 主要内容区域 - 使用 flex 布局，子组件控制滚动 */
}
<div
  className={cn(
    'flex flex-1 flex-col overflow-hidden', // ✅ overflow-hidden
    isMobile ? 'p-4' : 'p-6'
  )}
>
  {children}
</div>;
```

### 2. `app/(dashboard)/inventory/page.tsx`

**关键修改：** 移除外层容器的 padding

```tsx
return (
  <HydrationBoundary state={dehydrate(queryClient)}>
    <InventoryPageClient // ✅ 直接渲染，没有额外容器
      initialParams={queryParams}
      categoryOptions={categoryOptions}
    />
  </HydrationBoundary>
);
```

### 3. `app/(dashboard)/inventory/page-client.tsx`

**关键修改：** 添加 flex 容器

```tsx
return (
  <div className="flex h-full flex-col">  // ✅ h-full 占满高度
    <Suspense fallback={<InventoryListSkeleton />}>
      <ERPInventoryList ... />
    </Suspense>
  </div>
);
```

### 4. `components/inventory/erp-inventory-list.tsx`

**关键修改：** 使用 ScrollableTableContainer，所有固定元素放在 header

```tsx
return (
  <ScrollableTableContainer  // ✅ h-full 默认
    header={
      <div className="space-y-4">
        <InventoryListToolbar ... />  // 固定
        <InventorySearchToolbar ... />  // 固定
      </div>
    }
    footer={
      <Pagination ... />  // 固定
    }
  >
    <div className="...">
      <InventoryTable ... />  // ✅ 只有这里滚动
    </div>
  </ScrollableTableContainer>
);
```

## 预期的 DOM 结构

```
html, body { height: 100vh }
  └── #__next { height: 100% }
      └── div.min-h-screen { display: flex, flex-direction: column }
          └── div.flex.flex-1 { flex: 1 }
              └── main.flex.flex-1.flex-col.overflow-hidden { flex: 1, overflow: hidden }
                  ├── div.flex-shrink-0 (面包屑) { flex-shrink: 0 }
                  └── div.flex.flex-1.flex-col.overflow-hidden.p-6 { flex: 1, overflow: hidden, padding: 24px }
                      └── div.flex.h-full.flex-col { height: 100%, display: flex, flex-direction: column }
                          └── ScrollableTableContainer { height: 100%, display: flex, flex-direction: column }
                              ├── div.flex-shrink-0 (header) { flex-shrink: 0 }
                              ├── div.flex-1.overflow-auto { flex: 1, overflow: auto } ← 滚动区域
                              └── div.flex-shrink-0 (footer) { flex-shrink: 0 }
```

## 浏览器调试步骤

### 1. 打开开发者工具

按 `F12` 打开浏览器开发者工具

### 2. 检查元素

1. 找到 `main` 元素（应该有 `overflow-hidden` 类）
2. 确认 `main` 的子元素有 `flex flex-1 flex-col overflow-hidden p-6`
3. 找到 `ScrollableTableContainer` 的渲染结果（应该是一个 `div` 有 `flex flex-col h-full`）
4. 检查表格容器的父元素是否有 `flex-1 overflow-auto`

### 3. 运行控制台命令检查

```javascript
// 检查 main 元素
const main = document.querySelector('main');
console.log('main classes:', main.className);
console.log('main overflow:', window.getComputedStyle(main).overflow);

// 检查主内容区域
const content = main.querySelector('div.flex-1.overflow-hidden');
console.log('content classes:', content?.className);
console.log('content overflow:', window.getComputedStyle(content).overflow);

// 查找可滚动区域
const scrollable = document.querySelector('.overflow-auto');
console.log('scrollable element:', scrollable);
console.log('scrollable classes:', scrollable?.className);
```

### 4. 查找问题

如果整个页面还在滚动，可能的原因：

**原因 A：** `main` 元素没有 `overflow-hidden`

- 检查 `DashboardLayoutClient.tsx` 第257行
- 应该有 `overflow-hidden` 类

**原因 B：** 内容区域没有 `overflow-hidden`

- 检查 `DashboardLayoutClient.tsx` 第283行
- 应该有 `flex flex-1 flex-col overflow-hidden`

**原因 C：** 高度没有正确传递

- 确认每个容器都有正确的高度设置
- `page-client.tsx` 应该有 `h-full`
- `ScrollableTableContainer` 默认使用 `h-full`

**原因 D：** CSS 冲突

- 检查是否有全局样式覆盖了 `overflow-hidden`
- 使用开发者工具的 Computed 标签查看最终的 overflow 值

## 快速修复测试

如果想快速测试滚动是否工作，可以在浏览器控制台运行：

```javascript
// 强制设置 main 元素不滚动
const main = document.querySelector('main');
main.style.overflow = 'hidden';

// 找到可滚动区域并添加边框（方便识别）
const scrollable = document.querySelector('.overflow-auto');
if (scrollable) {
  scrollable.style.border = '2px solid red';
  console.log('已标记可滚动区域为红色边框');
}
```

## 如果问题依然存在

请运行以下命令并将结果发给我：

```javascript
function debugLayout() {
  const main = document.querySelector('main');
  const content = main?.querySelector('div');
  const scrollable = document.querySelector('.overflow-auto');

  return {
    main: {
      classes: main?.className,
      overflow: window.getComputedStyle(main).overflow,
      height: window.getComputedStyle(main).height,
    },
    content: {
      classes: content?.className,
      overflow: content ? window.getComputedStyle(content).overflow : 'N/A',
      height: content ? window.getComputedStyle(content).height : 'N/A',
    },
    scrollable: {
      found: !!scrollable,
      classes: scrollable?.className,
      overflow: scrollable
        ? window.getComputedStyle(scrollable).overflow
        : 'N/A',
    },
  };
}

console.table(debugLayout());
```
