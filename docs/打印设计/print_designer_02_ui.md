# 02 - UI 组件与交互设计详细规范

> 本文档定义打印设计器的 UI 组件结构、状态管理及交互行为。

---

## 1. 组件树结构

```
<PrintDesignerPage>
├── <DesignerHeader />           # 顶部操作栏
│   ├── 模板名称 (可编辑)
│   ├── 保存按钮
│   ├── 预览按钮
│   └── 更多操作 (导出 JSON, 导入)
│
├── <DesignerBody>               # 三栏主体
│   ├── <ComponentToolbar />     # 左侧组件库
│   │   ├── <ToolbarSection title="基础">
│   │   │   ├── <DraggableItem type="text" />
│   │   │   ├── <DraggableItem type="image" />
│   │   │   └── <DraggableItem type="line" />
│   │   ├── <ToolbarSection title="数据字段">
│   │   │   ├── <FieldItem field="order.orderNumber" />
│   │   │   ├── <FieldItem field="customer.name" />
│   │   │   └── ...
│   │   └── <ToolbarSection title="容器">
│   │       └── <DraggableItem type="table" />
│   │
│   ├── <CanvasContainer />      # 中间画布
│   │   ├── <Ruler direction="horizontal" />
│   │   ├── <Ruler direction="vertical" />
│   │   ├── <ZoomableCanvas>
│   │   │   ├── <PaperBackground />
│   │   │   ├── <GridOverlay />
│   │   │   └── {elements.map(el => <DesignElement />)}
│   │   │       ├── <ElementRenderer element={el} />
│   │   │       ├── <SelectionBorder />
│   │   │       └── <ResizeHandles />
│   │   └── <AlignmentGuides />
│   │
│   └── <PropertiesPanel />      # 右侧属性
│       ├── <PageSettings />     # 未选中时显示
│       └── <ElementProperties /> # 选中时显示
│           ├── <GeometrySection />
│           ├── <TypographySection />
│           ├── <DataBindingSection />
│           └── <AdvancedSection />
│
└── <DesignerFooter />           # (可选) 状态栏
    ├── 缩放比例
    └── 选中元素信息
```

---

## 2. 状态管理 (Zustand Store)

### 2.1 Store 定义

```typescript
// stores/designer-store.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  PrintTemplate,
  DesignElement,
} from '@/lib/print-designer/schemas';

interface DesignerState {
  // 模板数据
  template: PrintTemplate | null;

  // UI 状态
  selectedElementId: string | null;
  zoom: number; // 0.25 - 4
  isDragging: boolean;

  // Actions
  setTemplate: (template: PrintTemplate) => void;
  selectElement: (id: string | null) => void;
  updateElement: (id: string, updates: Partial<DesignElement>) => void;
  addElement: (element: DesignElement) => void;
  removeElement: (id: string) => void;
  setZoom: (zoom: number) => void;
}

export const useDesignerStore = create<DesignerState>()(
  immer(set => ({
    template: null,
    selectedElementId: null,
    zoom: 1,
    isDragging: false,

    setTemplate: template => set({ template }),

    selectElement: id => set({ selectedElementId: id }),

    updateElement: (id, updates) =>
      set(state => {
        if (!state.template) return;
        const idx = state.template.elements.findIndex(el => el.id === id);
        if (idx !== -1) {
          Object.assign(state.template.elements[idx], updates);
        }
      }),

    addElement: element =>
      set(state => {
        state.template?.elements.push(element);
      }),

    removeElement: id =>
      set(state => {
        if (!state.template) return;
        state.template.elements = state.template.elements.filter(
          el => el.id !== id
        );
        if (state.selectedElementId === id) {
          state.selectedElementId = null;
        }
      }),

    setZoom: zoom => set({ zoom: Math.max(0.25, Math.min(4, zoom)) }),
  }))
);
```

### 2.2 历史记录 (撤销/重做)

```typescript
// stores/history-store.ts
import { temporal } from 'zundo';
import { useDesignerStore } from './designer-store';

// 包装 temporal 中间件
export const useTemporalStore = create(
  temporal(useDesignerStore, {
    partialize: state => ({ template: state.template }),
    limit: 50,
  })
);

// 使用
const { undo, redo, pastStates, futureStates } =
  useTemporalStore.temporal.getState();
```

---

## 3. 核心交互实现

### 3.1 拖拽添加元素 (HTML5 Drag and Drop)

```typescript
// components/print-designer/editor/components/ComponentToolbar.tsx
function DraggableItem({ type }: { type: string }) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('elementType', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return <div draggable onDragStart={handleDragStart}>...</div>;
}
```

### 3.2 画布放置区

```typescript
// components/print-designer/editor/components/DesignerCanvas.tsx
<div onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
  {/* elements... */}
</div>
```

### 3.3 智能对齐辅助线

```typescript
// hooks/useAlignmentGuides.ts
interface Guide {
  type: 'horizontal' | 'vertical';
  position: number; // mm
}

function useAlignmentGuides(
  draggingElement: DesignElement | null,
  allElements: DesignElement[]
): Guide[] {
  if (!draggingElement) return [];

  const guides: Guide[] = [];
  const threshold = 2; // mm

  allElements.forEach(el => {
    if (el.id === draggingElement.id) return;

    // 左边对齐
    if (Math.abs(el.position.x - draggingElement.position.x) < threshold) {
      guides.push({ type: 'vertical', position: el.position.x });
    }
    // 右边对齐
    const elRight = el.position.x + el.size.width;
    const dragRight = draggingElement.position.x + draggingElement.size.width;
    if (Math.abs(elRight - dragRight) < threshold) {
      guides.push({ type: 'vertical', position: elRight });
    }
    // 中心对齐
    const elCenterX = el.position.x + el.size.width / 2;
    const dragCenterX =
      draggingElement.position.x + draggingElement.size.width / 2;
    if (Math.abs(elCenterX - dragCenterX) < threshold) {
      guides.push({ type: 'vertical', position: elCenterX });
    }
    // 类似处理 Y 轴...
  });

  return guides;
}
```

### 3.4 画布元素缩放 (Resize Handles)

- 选中元素后，显示 4 个角上的缩放控制点（拖拽即可调整宽高）
- 目的：避免必须去右侧属性面板调整 `W/H` 数字
- 实现参考：`components/print-designer/editor/components/DesignerCanvas.tsx`

---

## 4. 属性面板配置

### 4.1 面板结构

| 选中类型 | 显示面板                         |
| -------- | -------------------------------- |
| 无选中   | 页面设置 (纸张大小、边距、方向)  |
| 文本     | 位置尺寸、字体排版、颜色         |
| 占位符   | 位置尺寸、数据绑定、格式化、字体 |
| 表格     | 位置尺寸、列管理、样式、合计行   |
| 图片     | 位置尺寸、图片源、适应方式       |

### 4.2 列管理器 (表格专用)

```typescript
// components/print-designer/editor/components/TableColumnManager.tsx
// 采用 HTML5 Drag and Drop：从“拖拽手柄(Grip)”开始拖拽，在列表中放置完成排序
<div onDragOver={(e) => e.preventDefault()} onDrop={() => onChange(reordered)}>
  <div draggable onDragStart={() => setData(fromIndex)} />
</div>
```

- 绑定字段支持可搜索下拉选择：`<FieldPicker scope="table" ... />`（同时保留手动输入）
- 支持「从字段添加」：选择一个字段后直接新增一列（更适合小白快速搭表）

### 4.3 画布内表格列宽调整 (可视化)

- 表格元素在画布内按真实样式渲染（表头/行高/边框），可直接看到列宽效果
- 选中表格后，在表头分割线位置显示拖拽手柄：拖动可调整相邻两列宽度（支持 `%` 与 `mm`）
- 实现参考：`components/print-designer/editor/components/TableElementPreview.tsx`

---

## 5. 键盘快捷键

| 快捷键                 | 功能         |
| ---------------------- | ------------ |
| `Ctrl + S`             | 保存         |
| `Ctrl + Z`             | 撤销         |
| `Ctrl + Shift + Z`     | 重做         |
| `Delete` / `Backspace` | 删除选中元素 |
| `Ctrl + C`             | 复制         |
| `Ctrl + V`             | 粘贴         |
| `Ctrl + D`             | 原位复制     |
| `Arrow Keys`           | 微移 1px     |
| `Shift + Arrow`        | 微移 10px    |
| `Ctrl + =` / `-`       | 缩放画布     |
| `Escape`               | 取消选中     |
