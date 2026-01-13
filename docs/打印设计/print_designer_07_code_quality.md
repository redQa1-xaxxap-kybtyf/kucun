# 07 - 代码规范与质量要求

> 本文档定义打印设计器开发过程中必须遵循的代码规范，与项目全局规范保持一致。

---

## 1. 核心原则

### 1.1 设计原则速查
| 原则 | 要求 | 示例 |
|---|---|---|
| **KISS** | 保持简单，能用 3 行代码解决的不要写 30 行 | 避免过度抽象 |
| **YAGNI** | 只实现当前需要的功能，不预设未来需求 | 不提前写"可能用到"的配置 |
| **DRY** | 相同逻辑只写一次 | 提取 `formatCurrency` 工具函数 |
| **SRP** | 一个函数/组件只做一件事 | `TextRenderer` 只渲染文本 |
| **OCP** | 对扩展开放，对修改关闭 | 用 `switch` 分发元素类型 |

### 1.2 反模式警示
```typescript
// ❌ 过度设计 - 违反 KISS/YAGNI
interface ElementConfig<T extends BaseElement = BaseElement> {
  factory: ElementFactory<T>;
  validator: Validator<T>;
  serializer: Serializer<T>;
  // ... 20 个可能用不到的扩展点
}

// ✅ 简单直接
interface ElementConfig {
  type: string;
  render: (el: DesignElement) => ReactNode;
}
```

---

## 2. TypeScript 规范

### 2.1 严格模式
项目已启用严格模式，以下规则**必须遵守**：
- `noImplicitAny`: 禁止隐式 any
- `strictNullChecks`: 严格空值检查
- `strictFunctionTypes`: 严格函数类型

### 2.2 类型定义要求
```typescript
// ✅ 显式声明返回类型
function formatValue(value: unknown, format: string): string {
  // ...
}

// ✅ 使用 Zod infer 派生类型
type PrintTemplate = z.infer<typeof PrintTemplateSchema>;

// ❌ 禁止使用 any
function handleData(data: any) {} // 不允许

// ✅ 使用 unknown + 类型守卫
function handleData(data: unknown) {
  if (isValidTemplate(data)) {
    // data 被收窄为 PrintTemplate
  }
}
```

### 2.3 类型守卫模式
```typescript
// 标准类型守卫
function isTextElement(el: DesignElement): el is TextElement {
  return el.type === 'text';
}

// 在组件中使用
if (isTextElement(element)) {
  return <TextRenderer element={element} />;
}
```

---

## 3. 组件规范

### 3.1 文件命名
```
components/print-designer/
├── PrintCanvas.tsx           # PascalCase 组件文件
├── use-designer-store.ts     # kebab-case hooks
├── types.ts                  # 类型定义
└── utils/
    ├── format.ts             # 工具函数
    └── unit-converter.ts
```

### 3.2 组件结构模板
```typescript
// 1. 类型定义在顶部
interface Props {
  element: TextElement;
  scale: number;
}

// 2. 组件导出
export function TextRenderer({ element, scale }: Props) {
  // 3. hooks 最先调用
  const store = useDesignerStore();
  
  // 4. 派生状态用 useMemo
  const style = useMemo(() => computeStyle(element, scale), [element, scale]);
  
  // 5. 事件处理用 useCallback
  const handleClick = useCallback(() => {
    store.selectElement(element.id);
  }, [element.id]);
  
  // 6. 提前返回处理边界情况
  if (!element.visible) return null;
  
  // 7. 主渲染
  return <div style={style} onClick={handleClick}>{element.content}</div>;
}
```

### 3.3 Props 设计原则
```typescript
// ✅ 最小化 Props，只传必要数据
interface Props {
  element: TextElement;
  scale: number;
}

// ❌ 避免 Props 透传过多层
interface Props {
  element: TextElement;
  scale: number;
  onSelect: () => void;
  onUpdate: () => void;
  onDelete: () => void;
  // ... 10 个回调
}

// ✅ 使用 Zustand Store 替代深层 Props 传递
```

---

## 4. 状态管理规范

### 4.1 Zustand Store 结构
```typescript
// ✅ 按功能分组
interface DesignerState {
  // 数据
  template: PrintTemplate | null;
  
  // UI 状态
  selectedElementId: string | null;
  zoom: number;
  
  // Actions (动词开头)
  setTemplate: (t: PrintTemplate) => void;
  selectElement: (id: string | null) => void;
  updateElement: (id: string, updates: Partial<DesignElement>) => void;
}
```

### 4.2 Immer 使用
```typescript
// ✅ 使用 immer 简化不可变更新
updateElement: (id, updates) => set((state) => {
  const el = state.template?.elements.find(e => e.id === id);
  if (el) Object.assign(el, updates);
}),

// ❌ 避免手动展开
updateElement: (id, updates) => set((state) => ({
  template: {
    ...state.template,
    elements: state.template.elements.map(e => 
      e.id === id ? { ...e, ...updates } : e
    ),
  },
})),
```

---

## 5. 代码审查检查清单

每次 PR 前自查：

- [ ] **类型安全**: 无 `any`，无 `@ts-ignore`
- [ ] **空值处理**: 所有可空值都有处理 (`??`, `?.`, 提前返回)
- [ ] **命名清晰**: 变量名能表达意图
- [ ] **单一职责**: 函数不超过 50 行，组件不超过 200 行
- [ ] **无重复**: 相似逻辑已提取为工具函数
- [ ] **边界情况**: 空数组、空对象、极端值都有处理
- [ ] **注释适度**: 只在"为什么"处注释，不解释"是什么"

---

## 6. ESLint 规则 (项目已配置)

关键规则：
- `@typescript-eslint/no-explicit-any`: error
- `@typescript-eslint/explicit-function-return-type`: warn
- `react-hooks/exhaustive-deps`: warn
- `max-lines-per-function`: warn (默认 150)

**例外**: 如需禁用规则，必须附带注释说明原因：
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 第三方库类型定义不完整
const result = externalLib.call(data as any);
```
