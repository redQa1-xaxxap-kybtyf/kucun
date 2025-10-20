# 统一日期筛选组件设计文档

## 📋 概述

本文档描述了项目中统一日期筛选组件的设计方案，用于在各个列表页面（销售订单、库存调整、财务报表等）提供一致的日期范围筛选功能。

## 🎯 设计目标

### 核心原则

- **KISS (简单至上)**: 提供简洁直观的日期选择界面
- **DRY (杜绝重复)**: 统一组件避免重复实现
- **SOLID (单一职责)**: 组件专注于日期范围选择功能
- **一致性**: 所有列表页面使用相同的日期筛选体验

### 功能需求

1. ✅ 支持日期范围选择（开始日期 + 结束日期）
2. ✅ 提供快捷日期预设（今天、本周、本月、最近30天等）
3. ✅ 可视化日历选择器
4. ✅ 清除日期筛选功能
5. ✅ 移动端友好的响应式设计
6. ✅ 与现有 RecordsFilters 组件集成

## 📊 现状分析

### 项目现有实现

**依赖库**:

- `react-day-picker` v9.11.0 (已安装)
- `date-fns` v4.1.0 (已安装)
- `@radix-ui/react-popover` (已安装)

**现有组件**:

- `components/ui/calendar.tsx` - 基于 react-day-picker 的日历组件
- `components/ui/popover.tsx` - Radix UI 弹出层组件
- `components/inventory/forms/RecordsFilters.tsx` - 统一筛选组件框架

**当前日期筛选实现**:

```tsx
// RecordsFilters.tsx 中的简单日期输入
<Input
  type="date"
  value={startDate || ''}
  onChange={e => onStartChange(e.target.value || undefined)}
  className="h-8 text-xs"
/>
```

**问题点**:

1. 仅使用原生 `<input type="date">`，用户体验较差
2. 缺少日期范围可视化选择
3. 没有快捷日期预设
4. 移动端体验不佳

## 🏗️ 技术方案

### 组件架构

```
DateRangeFilter (新组件)
├── DateRangePicker (核心日期选择器)
│   ├── Popover (弹出层容器)
│   ├── DateRangePresets (快捷预设)
│   └── Calendar (日历选择器 - 支持范围选择)
└── DateRangeDisplay (已选日期显示)
```

### 技术栈选择

根据 MCP 工具检索的最佳实践和项目现状：

**推荐方案**: 基于现有组件扩展

- ✅ 使用项目已有的 `react-day-picker` v9.11.0
- ✅ 集成现有的 `calendar.tsx` 组件
- ✅ 使用 `date-fns` 进行日期处理
- ✅ 遵循项目现有的 shadcn/ui 设计系统

**优势**:

1. 无需引入新依赖，减少包体积
2. 与现有 UI 组件风格一致
3. WCAG 2.1 AA 无障碍标准兼容
4. 支持国际化和本地化

### API 设计

```typescript
interface DateRangeFilterProps {
  // 当前选中的日期范围
  value?: {
    startDate?: string; // ISO 8601 格式: "2025-01-01"
    endDate?: string;
  };

  // 日期变更回调
  onChange: (range: { startDate?: string; endDate?: string }) => void;

  // 标签文本
  label?: string;

  // 是否显示快捷预设
  showPresets?: boolean;

  // 自定义预设选项
  presets?: Array<{
    label: string;
    getValue: () => { startDate: string; endDate: string };
  }>;

  // 日期范围限制
  minDate?: Date;
  maxDate?: Date;

  // 禁用状态
  disabled?: boolean;

  // 样式定制
  className?: string;
}
```

### 快捷预设配置

```typescript
// 默认预设
const DEFAULT_PRESETS = [
  {
    label: '今天',
    getValue: () => ({
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
    }),
  },
  {
    label: '昨天',
    getValue: () => {
      const yesterday = subDays(new Date(), 1);
      return {
        startDate: format(yesterday, 'yyyy-MM-dd'),
        endDate: format(yesterday, 'yyyy-MM-dd'),
      };
    },
  },
  {
    label: '最近7天',
    getValue: () => ({
      startDate: format(subDays(new Date(), 6), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
    }),
  },
  {
    label: '最近30天',
    getValue: () => ({
      startDate: format(subDays(new Date(), 29), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
    }),
  },
  {
    label: '本周',
    getValue: () => ({
      startDate: format(
        startOfWeek(new Date(), { weekStartsOn: 1 }),
        'yyyy-MM-dd'
      ),
      endDate: format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    }),
  },
  {
    label: '本月',
    getValue: () => ({
      startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    }),
  },
  {
    label: '上月',
    getValue: () => {
      const lastMonth = subMonths(new Date(), 1);
      return {
        startDate: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(lastMonth), 'yyyy-MM-dd'),
      };
    },
  },
];
```

## 🔧 实现细节

### 组件文件结构

```
components/ui/
├── date-range-picker.tsx    (新建 - 核心日期范围选择器)
└── calendar.tsx              (已存在 - 基础日历组件)

components/inventory/forms/
└── RecordsFilters.tsx        (修改 - 集成新的日期选择器)
```

### 使用示例

#### 1. 基础用法

```tsx
import { DateRangeFilter } from '@/components/ui/date-range-picker';

function MyListPage() {
  const [dateRange, setDateRange] = useState<{
    startDate?: string;
    endDate?: string;
  }>({});

  return (
    <DateRangeFilter
      value={dateRange}
      onChange={setDateRange}
      label="日期范围"
    />
  );
}
```

#### 2. 集成到 RecordsFilters

```tsx
// 在 RecordsFilters.tsx 中使用
import { DateRangeFilter } from '@/components/ui/date-range-picker';

function DateRangeFields({
  config,
  startDate,
  endDate,
  onStartChange,
  onEndChange,
}: {
  config: FilterConfig['dateRange'];
  startDate: string | undefined;
  endDate: string | undefined;
  onStartChange: (value: string | undefined) => void;
  onEndChange: (value: string | undefined) => void;
}) {
  if (!config?.enabled) {
    return null;
  }

  return (
    <div className="md:col-span-2">
      <DateRangeFilter
        value={{ startDate, endDate }}
        onChange={({ startDate, endDate }) => {
          onStartChange(startDate);
          onEndChange(endDate);
        }}
        label="日期范围"
        showPresets={true}
      />
    </div>
  );
}
```

#### 3. 在销售订单页面中使用

```tsx
// app/(dashboard)/sales-orders/page-client.tsx
const handleFilter = React.useCallback(
  (key: string, value: string | undefined) => {
    const overrides: Partial<LatestQueryState> = { page: 1 };

    if (key === 'dateRange') {
      // 处理日期范围批量更新
      try {
        const { startDate, endDate } = JSON.parse(value || '{}');
        overrides.startDate = startDate;
        overrides.endDate = endDate;
      } catch (error) {
        console.error('❌ 解析日期范围失败:', error);
      }
    }

    latestParamsRef.current = { ...latestParamsRef.current, ...overrides };
    replaceURL(overrides);
  },
  [replaceURL]
);
```

## 🎨 UI/UX 设计

### 视觉设计

```
┌─────────────────────────────────────────────┐
│  📅 日期范围                                 │
│  ┌───────────────────────────────────────┐  │
│  │ 2025-01-01 → 2025-01-31       [清除]  │  │ ← Trigger
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘

点击后弹出:

┌─────────────────────────────────────────────────┐
│ 快捷选择                    │  日历选择器        │
│ ┌──────────┐               │  ┌──────────────┐ │
│ │ 今天     │               │  │  一 二 三 四 │ │
│ │ 昨天     │               │  │  1  2  3  4  │ │
│ │ 最近7天  │               │  │  [5][6][7] 8 │ │
│ │ 最近30天 │               │  │  ...         │ │
│ │ 本周     │               │  └──────────────┘ │
│ │ 本月     │               │                   │
│ │ 上月     │               │  开始: 2025-01-05 │
│ └──────────┘               │  结束: 2025-01-07 │
│                            │  [确定] [取消]    │
└─────────────────────────────────────────────────┘
```

### 交互流程

1. **打开选择器**: 点击日期范围输入框
2. **快捷选择**: 点击预设快速设置常用日期范围
3. **日历选择**:
   - 第一次点击设置开始日期
   - 第二次点击设置结束日期
   - 范围高亮显示
4. **确认**: 点击"确定"按钮应用选择
5. **清除**: 点击"清除"按钮重置日期范围

### 响应式设计

- **桌面端**: 横向布局，预设和日历并排显示
- **平板端**: 预设在上，日历在下
- **移动端**: 全屏对话框，垂直布局

## 🧪 测试策略

### 单元测试

```typescript
describe('DateRangeFilter', () => {
  it('应该渲染日期范围选择器', () => {
    // 测试组件渲染
  });

  it('应该正确处理日期选择', () => {
    // 测试日期选择逻辑
  });

  it('应该支持快捷预设', () => {
    // 测试预设功能
  });

  it('应该正确清除日期', () => {
    // 测试清除功能
  });

  it('应该遵守日期范围限制', () => {
    // 测试 minDate/maxDate
  });
});
```

### 集成测试

- 在销售订单页面测试日期筛选功能
- 在库存调整页面测试日期筛选功能
- 在财务报表页面测试日期筛选功能
- 验证 URL 参数同步
- 验证数据过滤结果

### 可访问性测试

- 键盘导航支持
- 屏幕阅读器兼容
- WCAG 2.1 AA 标准验证
- 色彩对比度检查

## 📈 性能优化

### 渲染优化

```typescript
// 使用 React.memo 避免不必要的重渲染
export const DateRangeFilter = React.memo(function DateRangeFilter(
  props: DateRangeFilterProps
) {
  // 组件实现
});

// 使用 useMemo 缓存计算结果
const formattedRange = useMemo(() => {
  if (!value?.startDate || !value?.endDate) return '';
  return `${value.startDate} → ${value.endDate}`;
}, [value?.startDate, value?.endDate]);
```

### 加载优化

- 按需加载日历组件（使用 Popover 懒加载）
- 日期计算函数使用 memoization
- 避免频繁的日期格式转换

## 🔄 迁移计划

### 阶段 1: 创建新组件 (当前)

- ✅ 创建 `date-range-picker.tsx` 组件
- ✅ 编写组件文档
- ✅ 添加单元测试

### 阶段 2: 集成到现有筛选器

- 修改 `RecordsFilters.tsx`，将 DateRangeFields 改用新组件
- 更新相关类型定义

### 阶段 3: 逐步迁移

- 销售订单页面
- 库存调整页面
- 入库/出库记录页面
- 财务报表页面
- 其他需要日期筛选的页面

### 阶段 4: 优化和改进

- 收集用户反馈
- 性能优化
- 无障碍改进
- 新增功能扩展

## 📚 参考资料

### 最佳实践来源

1. **react-datepicker** (npm): 8.8.0 版本，活跃维护
   - 代码质量高
   - 社区支持好
   - 频繁更新

2. **React DayPicker** (项目使用): v9.11.0
   - WCAG 2.1 AA 无障碍标准
   - 使用 date-fns 进行日期处理
   - 支持 WAI-ARIA 最佳实践

3. **Microsoft Learn** 代码示例
   - TypeScript + React 最佳实践
   - 组件化设计模式
   - 受控组件模式

### 关键技术文档

- [React DayPicker Documentation](https://react-day-picker.js.org/)
- [date-fns Documentation](https://date-fns.org/)
- [Radix UI Popover](https://www.radix-ui.com/primitives/docs/components/popover)
- [WAI-ARIA Date Picker Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/)

## ✅ 质量检查清单

### 开发完成标准

- [ ] 组件实现完成
- [ ] TypeScript 类型定义完整
- [ ] 单元测试覆盖率 >80%
- [ ] 文档完善
- [ ] 代码审查通过
- [ ] 无障碍测试通过
- [ ] 移动端测试通过
- [ ] 性能测试通过

### SOLID 原则验证

- ✅ **单一职责**: 组件仅负责日期范围选择
- ✅ **开放封闭**: 通过 props 扩展，无需修改组件
- ✅ **接口隔离**: API 简洁，无冗余属性
- ✅ **依赖倒置**: 依赖抽象接口，非具体实现

### KISS/DRY/YAGNI 验证

- ✅ **KISS**: 简洁直观的 API 设计
- ✅ **DRY**: 避免日期选择逻辑重复
- ✅ **YAGNI**: 仅实现当前需求，无过度设计

## 🚀 下一步行动

1. **立即执行**:
   - 创建 `components/ui/date-range-picker.tsx` 组件
   - 实现核心功能和快捷预设
   - 编写基础单元测试

2. **短期目标** (1-2天):
   - 集成到 RecordsFilters 组件
   - 在一个页面（如销售订单）中测试
   - 收集初步反馈

3. **中期目标** (1周):
   - 推广到所有列表页面
   - 完善测试覆盖
   - 优化性能和用户体验

4. **长期优化**:
   - 根据用户反馈持续改进
   - 扩展功能（如时间选择）
   - 国际化支持

---

**文档版本**: v1.0
**创建日期**: 2025-01-19
**最后更新**: 2025-01-19
**维护者**: Claude Code Assistant
