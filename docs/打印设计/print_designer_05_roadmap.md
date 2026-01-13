# 05 - 打印设计器细粒度实施路线

> 本文档将开发计划拆解为可执行的每日任务，明确依赖关系和验收标准。

---

## 总体规划

| 阶段 | 工作日 | 里程碑 |
|---|---|---|
| Phase 0: 基础设施 | 2 天 | Schema 定义完成，数据库迁移成功 |
| Phase 1: 纯净渲染器 | 3 天 | 能根据 JSON 渲染静态发货单 |
| Phase 2: 设计器核心 | 5 天 | 拖拽、选中、属性编辑可用 |
| Phase 3: 数据绑定 | 2 天 | 支持变量解析与预览 |
| Phase 4: 后端集成 | 2 天 | 模板 CRUD API 完成 |
| Phase 5: 打磨优化 | 2-3 天 | 辅助线、快捷键、批量打印 |

**总计**: 约 **16-17 工作日** (3-4 周)

---

## Phase 0: 基础设施 (Day 1-2)

### Day 1: Schema 定义
| 任务 | 预估 (h) | 输出物 | 验收标准 |
|---|---|---|---|
| 创建 `lib/print-designer/schemas/` 目录结构 | 0.5 | 目录 | 目录存在 |
| 实现 `base.ts` (Position, Size, BaseElement) | 1 | 代码 | TS 编译通过 |
| 实现 `text-element.ts` | 1 | 代码 | Zod parse 成功 |
| 实现 `placeholder-element.ts` | 1 | 代码 | Zod parse 成功 |
| 实现 `table-element.ts` | 1.5 | 代码 | 含列定义和样式 |
| 实现 `visual-elements.ts` (Image, Barcode) | 1 | 代码 | Zod parse 成功 |
| 实现 `template.ts` (顶层模板) | 1 | 代码 | 完整模板可 parse |
| 编写单元测试 | 1 | 测试 | 所有用例通过 |

### Day 2: 数据库模型
| 任务 | 预估 (h) | 输出物 | 验收标准 |
|---|---|---|---|
| 在 `schema.prisma` 添加 PrintTemplate 模型 | 0.5 | Prisma Schema | 无语法错误 |
| 扩展 User 模型关系 | 0.5 | Prisma Schema | 无语法错误 |
| 运行 `npx prisma migrate dev` | 0.5 | 迁移文件 | 迁移成功 |
| 验证数据库表结构 | 0.5 | 手动测试 | 表存在且字段正确 |
| 创建 seed 测试数据 (2个默认模板) | 1 | Seed 脚本 | 运行成功 |

**Phase 0 验收**: 执行 `npm run test:schema` 全部通过，数据库迁移成功。

---

## Phase 1: 纯净渲染器 (Day 3-5)

### Day 3: 渲染器骨架
| 任务 | 预估 (h) | 依赖 | 输出物 |
|---|---|---|---|
| 创建 `components/print-designer/renderer/` 目录 | 0.5 | P0 完成 | 目录 |
| 实现 `unit-converter.ts` (mm ↔ px) | 1 | - | 工具函数 |
| 实现 `PrintCanvas.tsx` 基础版 | 2 | Schema | 组件 |
| 实现 `ElementRenderer.tsx` 分发器 | 1.5 | PrintCanvas | 组件 |
| 创建 Storybook story 验证 | 1 | ElementRenderer | Story |

### Day 4: 元素渲染器 (上)
| 任务 | 预估 (h) | 依赖 | 输出物 |
|---|---|---|---|
| 实现 `TextRenderer.tsx` | 2 | ElementRenderer | 组件 |
| 实现 `PlaceholderRenderer.tsx` | 2 | ElementRenderer | 组件 |
| 实现 `data-binder.ts` (getNestedValue) | 1 | - | 工具函数 |
| 实现 `formatters.ts` (日期、货币、大写) | 2 | - | 工具函数 |

### Day 5: 元素渲染器 (下)
| 任务 | 预估 (h) | 依赖 | 输出物 |
|---|---|---|---|
| 实现 `TableRenderer.tsx` | 3 | data-binder | 组件 |
| 实现 `ImageRenderer.tsx` | 1 | ElementRenderer | 组件 |
| 实现 `BarcodeRenderer.tsx` (集成 JsBarcode) | 2 | ElementRenderer | 组件 |
| 集成测试：渲染完整销售单 | 1 | 全部渲染器 | 测试页面 |

**Phase 1 验收**: 访问 `/dev/print-preview`，能看到渲染出的静态发货单 (含表格、大写金额)。

---

## Phase 2: 设计器核心 (Day 6-10)

### Day 6: 布局与状态
| 任务 | 预估 (h) | 依赖 | 输出物 |
|---|---|---|---|
| 创建 `components/print-designer/editor/` 目录 | 0.5 | - | 目录 |
| 实现 `useDesignerStore.ts` (Zustand) | 2 | Schema | Store |
| 实现 `PrintDesignerPage.tsx` 三栏布局骨架 | 2 | - | 页面 |
| 实现 `DesignerHeader.tsx` (保存/预览按钮) | 1 | Store | 组件 |

### Day 7: 组件工具栏
| 任务 | 预估 (h) | 依赖 | 输出物 |
|---|---|---|---|
| 实现 `ComponentToolbar.tsx` 容器 | 1 | 布局 | 组件 |
| 实现 `DraggableItem.tsx` (useDraggable) | 2 | @dnd-kit | 组件 |
| 配置 @dnd-kit DndContext | 1 | dnd-kit 安装 | 配置 |
| 实现 `FieldItem.tsx` (字段拖拽) | 2 | DraggableItem | 组件 |

### Day 8: 画布容器
| 任务 | 预估 (h) | 依赖 | 输出物 |
|---|---|---|---|
| 实现 `CanvasContainer.tsx` (useDroppable) | 2 | DndContext | 组件 |
| 实现 `ZoomableCanvas.tsx` (缩放平移) | 2 | react-zoom-pan-pinch | 组件 |
| 实现 `Ruler.tsx` (mm 标尺) | 2 | - | 组件 |
| 连接拖拽放置逻辑 (onDragEnd -> addElement) | 1.5 | Store | 逻辑 |

### Day 9: 元素交互
| 任务 | 预估 (h) | 依赖 | 输出物 |
|---|---|---|---|
| 实现 `DesignElement.tsx` 包装器 | 1 | CanvasContainer | 组件 |
| 集成 react-moveable (resize/rotate) | 3 | DesignElement | 交互 |
| 实现 `SelectionBorder.tsx` 选中态 | 1 | - | 组件 |
| 实现点击选中逻辑 | 1 | Store | 逻辑 |

### Day 10: 属性面板
| 任务 | 预估 (h) | 依赖 | 输出物 |
|---|---|---|---|
| 实现 `PropertiesPanel.tsx` 容器 | 1 | 布局 | 组件 |
| 实现 `GeometrySection.tsx` (X/Y/W/H) | 1.5 | - | 组件 |
| 实现 `TypographySection.tsx` (字体/字号) | 2 | - | 组件 |
| 实现 `PageSettingsPanel.tsx` (纸张设置) | 1.5 | - | 组件 |
| 连接属性变更到 Store | 1 | Store | 逻辑 |

**Phase 2 验收**: 可拖拽添加元素，选中后能调整大小和属性，实时更新预览。

---

## Phase 3: 数据绑定 (Day 11-12)

### Day 11: 变量系统
| 任务 | 预估 (h) | 依赖 | 输出物 |
|---|---|---|---|
| 实现 `DataBindingSection.tsx` 属性面板 | 2 | PropertiesPanel | 组件 |
| 创建可绑定字段注册表 (fieldRegistry) | 2 | - | 配置 |
| 实现 `FieldPicker.tsx` (下拉 + 搜索) | 2 | fieldRegistry | 组件 |
| 变量 Tag 可视化 (蓝色胶囊) | 1 | DesignElement | 样式 |

### Day 12: 预览与格式化
| 任务 | 预估 (h) | 依赖 | 输出物 |
|---|---|---|---|
| 实现 `PreviewDialog.tsx` 模态框 | 2 | PrintCanvas | 组件 |
| 加载真实销售订单数据预览 | 2 | API | 功能 |
| 格式化选项 UI (下拉选择) | 1.5 | DataBindingSection | 组件 |
| 端到端测试：绑定字段并预览 | 1 | 全部 | 测试 |

**Phase 3 验收**: 能绑定 `{{customer.name}}`，预览时显示真实客户名称。

---

## Phase 4: 后端集成 (Day 13-14)

### Day 13: Server Actions
| 任务 | 预估 (h) | 依赖 | 输出物 |
|---|---|---|---|
| 实现 `saveTemplate` action | 2 | Schema, Prisma | Action |
| 实现 `getTemplates` action | 1 | Prisma | Action |
| 实现 `getTemplate` action | 0.5 | Prisma | Action |
| 实现 `deleteTemplate` action | 1 | Prisma | Action |
| 实现 `setDefaultTemplate` action | 1 | Prisma | Action |
| 权限检查中间件 | 1 | Auth | 中间件 |

### Day 14: 集成与测试
| 任务 | 预估 (h) | 依赖 | 输出物 |
|---|---|---|---|
| 模板列表页 `/settings/print-templates` | 2 | getTemplates | 页面 |
| 编辑器保存功能对接 | 1 | saveTemplate | 功能 |
| 加载已保存模板 | 1 | getTemplate | 功能 |
| 设置默认模板 UI | 1 | setDefaultTemplate | 功能 |
| E2E 测试：创建-保存-加载-打印 | 2 | 全部 | 测试 |

**Phase 4 验收**: 可保存模板到数据库，刷新后能加载，可设置默认模板。

---

## Phase 5: 打磨优化 (Day 15-17)

### Day 15: 辅助交互
| 任务 | 预估 (h) | 依赖 | 输出物 |
|---|---|---|---|
| 实现 `AlignmentGuides.tsx` | 3 | Canvas | 组件 |
| 实现吸附逻辑 (snap to guides) | 2 | AlignmentGuides | 逻辑 |
| 键盘快捷键 (Ctrl+S, Delete, Arrows) | 2 | Store | 功能 |

### Day 16: 历史记录
| 任务 | 预估 (h) | 依赖 | 输出物 |
|---|---|---|---|
| 集成 zundo (撤销/重做) | 2 | Store | 功能 |
| Ctrl+Z / Ctrl+Shift+Z 绑定 | 1 | zundo | 快捷键 |
| 右键菜单 (复制/删除/层级) | 2 | - | 组件 |
| 复制粘贴功能 | 2 | Store | 功能 |

### Day 17: 性能与发布
| 任务 | 预估 (h) | 依赖 | 输出物 |
|---|---|---|---|
| 批量打印优化 (分批渲染) | 2 | PrintCanvas | 功能 |
| 性能测试 (100 元素 / 100 订单) | 2 | - | 报告 |
| 文档更新与 README | 1 | - | 文档 |
| 代码审查与合并 | 2 | - | PR |

**Phase 5 验收**: 辅助线工作正常，撤销重做可用，批量打印不卡顿。

---

## 风险与缓冲

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| react-moveable 与 @dnd-kit 冲突 | +1 天 | 提前 spike 验证，必要时切换库 |
| 针式打印机样式兼容 | +1 天 | 提供"黑白模式"预设 |
| 大写金额算法边缘情况 | +0.5 天 | 补充单元测试覆盖 |

**建议缓冲**: 预留 **2-3 天** 应对未知问题。

---

## 每日站会检查点

- [ ] Day 1-2: Schema 和数据库就绪
- [ ] Day 5: 渲染器能输出静态页面
- [ ] Day 10: 编辑器交互流程跑通
- [ ] Day 12: 数据绑定端到端可用
- [ ] Day 14: 后端集成完成，可保存
- [ ] Day 17: 功能完整，准备发布
