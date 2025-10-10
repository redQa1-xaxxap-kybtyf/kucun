# 现代化企业级ERP配色系统设计规范

## 1. 配色系统概述

### 1.1 设计理念和原则

本配色系统基于现代企业级应用的设计需求，参考Ant Design 5.0设计语言，旨在创建一个专业、高效、易用的ERP系统视觉体验。

**核心设计原则：**
- **专业性**：采用沉稳、可信赖的色彩搭配，体现企业级应用的严谨性
- **高效性**：通过合理的色彩对比和层次，提升用户操作效率
- **一致性**：建立统一的色彩语义系统，确保全平台体验一致
- **可访问性**：遵循WCAG 2.1标准，确保色彩对比度满足可访问性要求
- **现代感**：融入当代设计趋势，保持视觉的时代感和科技感

### 1.2 色彩心理学应用

- **蓝色系**：传达专业、可信、稳定的企业形象，适合数据处理和决策支持
- **灰色系**：提供中性背景，减少视觉疲劳，突出重要信息
- **绿色系**：表示成功、安全、正向反馈，用于状态提示
- **橙色系**：传达警告、注意，用于重要提醒
- **红色系**：表示错误、危险、紧急，用于错误状态和删除操作

### 1.3 企业级配色标准

- **对比度要求**：文本与背景对比度不低于4.5:1
- **色彩饱和度**：主色调饱和度适中，避免过于鲜艳影响长时间使用
- **色彩层次**：建立清晰的视觉层次，重要信息突出显示
- **品牌一致性**：配色方案支持企业品牌色彩定制

## 2. 核心色彩定义

### 2.1 主色调系统

**主蓝色 (Primary Blue)**
- `--color-primary`: #1677FF
- `--color-primary-hover`: #4096FF
- `--color-primary-active`: #0958D9
- `--color-primary-light`: #E6F4FF
- `--color-primary-lighter`: #F0F8FF

**应用场景：**
- 主要操作按钮
- 链接文本
- 选中状态
- 品牌标识

### 2.2 辅助色系统

**科技紫色 (Tech Purple)**
- `--color-purple`: #722ED1
- `--color-purple-light`: #F9F0FF
- `--color-purple-hover`: #9254DE

**数据青色 (Data Cyan)**
- `--color-cyan`: #13C2C2
- `--color-cyan-light`: #E6FFFB
- `--color-cyan-hover`: #36CFC9

**温和灰色 (Neutral Gray)**
- `--color-gray-50`: #FAFAFA
- `--color-gray-100`: #F5F5F5
- `--color-gray-200`: #F0F0F0
- `--color-gray-300`: #D9D9D9
- `--color-gray-400`: #BFBFBF
- `--color-gray-500`: #8C8C8C
- `--color-gray-600`: #595959
- `--color-gray-700`: #434343
- `--color-gray-800`: #262626
- `--color-gray-900`: #1F1F1F

### 2.3 状态色系统

**成功绿色 (Success Green)**
- `--color-success`: #52C41A
- `--color-success-light`: #F6FFED
- `--color-success-hover`: #73D13D

**警告橙色 (Warning Orange)**
- `--color-warning`: #FA8C16
- `--color-warning-light`: #FFF7E6
- `--color-warning-hover`: #FFA940

**错误红色 (Error Red)**
- `--color-error`: #FF4D4F
- `--color-error-light`: #FFF2F0
- `--color-error-hover`: #FF7875

**信息青色 (Info Blue)**
- `--color-info`: #1890FF
- `--color-info-light`: #E6F7FF
- `--color-info-hover`: #40A9FF

## 3. 具体应用规范

### 3.1 表格系统配色规则

**表头配色**
```css
.table-header {
  background: var(--color-gray-50);
  color: var(--color-gray-800);
  border-bottom: 2px solid var(--color-gray-200);
}
```

**表格行配色**
```css
.table-row {
  background: #FFFFFF;
  border-bottom: 1px solid var(--color-gray-100);
}

.table-row:nth-child(even) {
  background: var(--color-gray-50);
}

.table-row:hover {
  background: var(--color-primary-light);
}

.table-row.selected {
  background: var(--color-primary-light);
  border-left: 3px solid var(--color-primary);
}
```

**排序和筛选**
```css
.table-sort-active {
  color: var(--color-primary);
}

.table-filter-active {
  background: var(--color-primary-light);
}
```

### 3.2 导航和菜单配色标准

**顶部导航**
```css
.top-nav {
  background: #FFFFFF;
  border-bottom: 1px solid var(--color-gray-200);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.nav-item {
  color: var(--color-gray-600);
}

.nav-item:hover {
  color: var(--color-primary);
}

.nav-item.active {
  color: var(--color-primary);
  border-bottom: 2px solid var(--color-primary);
}
```

**侧边栏菜单**
```css
.sidebar {
  background: var(--color-gray-50);
  border-right: 1px solid var(--color-gray-200);
}

.menu-item {
  color: var(--color-gray-700);
}

.menu-item:hover {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.menu-item.active {
  background: var(--color-primary);
  color: #FFFFFF;
}
```

### 3.3 表单元素配色指南

**输入框**
```css
.input {
  border: 1px solid var(--color-gray-300);
  background: #FFFFFF;
}

.input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-light);
}

.input.error {
  border-color: var(--color-error);
}

.input.success {
  border-color: var(--color-success);
}
```

**选择器**
```css
.select {
  border: 1px solid var(--color-gray-300);
}

.select-option:hover {
  background: var(--color-primary-light);
}

.select-option.selected {
  background: var(--color-primary);
  color: #FFFFFF;
}
```

### 3.4 按钮和交互元素配色

**主要按钮**
```css
.btn-primary {
  background: var(--color-primary);
  color: #FFFFFF;
  border: 1px solid var(--color-primary);
}

.btn-primary:hover {
  background: var(--color-primary-hover);
}

.btn-primary:active {
  background: var(--color-primary-active);
}
```

**次要按钮**
```css
.btn-secondary {
  background: #FFFFFF;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
}

.btn-secondary:hover {
  background: var(--color-primary-light);
}
```

**危险按钮**
```css
.btn-danger {
  background: var(--color-error);
  color: #FFFFFF;
  border: 1px solid var(--color-error);
}

.btn-danger:hover {
  background: var(--color-error-hover);
}
```

### 3.5 边框和分割线规范

**主要分割线**
```css
.divider {
  border-top: 1px solid var(--color-gray-200);
}

.divider-thick {
  border-top: 2px solid var(--color-gray-300);
}
```

**卡片边框**
```css
.card {
  border: 1px solid var(--color-gray-200);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
```

## 4. 深色模式适配

### 4.1 深色模式配色原则

- **背景层次**：使用不同深度的灰色创建层次感
- **文本对比**：确保文本在深色背景上的可读性
- **色彩调整**：降低饱和度，避免过于刺眼
- **一致性**：保持与浅色模式的语义一致性

### 4.2 深色模式色彩定义

**背景色系**
```css
[data-theme="dark"] {
  --color-bg-primary: #141414;
  --color-bg-secondary: #1F1F1F;
  --color-bg-tertiary: #262626;
  --color-bg-card: #1F1F1F;
}
```

**文本色系**
```css
[data-theme="dark"] {
  --color-text-primary: rgba(255, 255, 255, 0.85);
  --color-text-secondary: rgba(255, 255, 255, 0.65);
  --color-text-tertiary: rgba(255, 255, 255, 0.45);
}
```

**主色调适配**
```css
[data-theme="dark"] {
  --color-primary: #1890FF;
  --color-primary-hover: #40A9FF;
  --color-primary-active: #096DD9;
}
```

### 4.3 对比度和可读性标准

- **主要文本**：对比度不低于7:1
- **次要文本**：对比度不低于4.5:1
- **图标和装饰**：对比度不低于3:1
- **状态指示**：保持足够的色彩区分度

## 5. 技术实现指南

### 5.1 CSS变量命名规范

**语义化命名**
```css
:root {
  /* 主色调 */
  --color-primary: #1677FF;
  --color-primary-hover: #4096FF;
  --color-primary-active: #0958D9;
  
  /* 背景色 */
  --color-bg-primary: #FFFFFF;
  --color-bg-secondary: #FAFAFA;
  --color-bg-tertiary: #F5F5F5;
  
  /* 文本色 */
  --color-text-primary: #262626;
  --color-text-secondary: #595959;
  --color-text-tertiary: #8C8C8C;
  
  /* 边框色 */
  --color-border-primary: #D9D9D9;
  --color-border-secondary: #F0F0F0;
}
```

### 5.2 语义化颜色定义

**功能性颜色**
```css
:root {
  /* 状态色 */
  --color-success: #52C41A;
  --color-warning: #FA8C16;
  --color-error: #FF4D4F;
  --color-info: #1890FF;
  
  /* 交互色 */
  --color-hover: var(--color-primary-light);
  --color-active: var(--color-primary);
  --color-disabled: var(--color-gray-300);
  
  /* 阴影色 */
  --shadow-light: rgba(0, 0, 0, 0.06);
  --shadow-medium: rgba(0, 0, 0, 0.12);
  --shadow-heavy: rgba(0, 0, 0, 0.24);
}
```

### 5.3 响应式配色方案

**媒体查询适配**
```css
@media (max-width: 768px) {
  :root {
    --color-bg-mobile: var(--color-bg-secondary);
    --shadow-mobile: var(--shadow-light);
  }
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg-primary: #141414;
    --color-text-primary: rgba(255, 255, 255, 0.85);
  }
}
```

## 6. 使用示例和最佳实践

### 6.1 常见UI组件配色示例

**数据卡片**
```css
.stats-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-secondary);
  border-radius: 4px;
  padding: 16px;
  box-shadow: var(--shadow-light);
}

.stats-value {
  color: var(--color-primary);
  font-size: 24px;
  font-weight: 600;
}

.stats-label {
  color: var(--color-text-secondary);
  font-size: 14px;
}
```

**进度条**
```css
.progress-bar {
  background: var(--color-gray-200);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  background: linear-gradient(90deg, var(--color-primary), var(--color-primary-hover));
  height: 100%;
  transition: width 0.3s ease;
}
```

### 6.2 配色搭配建议

**高优先级信息**
- 背景：`var(--color-primary-light)`
- 文本：`var(--color-primary)`
- 边框：`var(--color-primary)`

**中优先级信息**
- 背景：`var(--color-bg-secondary)`
- 文本：`var(--color-text-primary)`
- 边框：`var(--color-border-primary)`

**低优先级信息**
- 背景：`var(--color-bg-tertiary)`
- 文本：`var(--color-text-secondary)`
- 边框：`var(--color-border-secondary)`

### 6.3 避免的配色错误

**❌ 错误示例：**
- 使用过多鲜艳色彩，造成视觉疲劳
- 对比度不足，影响可读性
- 状态色语义不一致
- 深色模式下色彩过于刺眼

**✅ 正确做法：**
- 保持色彩的克制和专业
- 确保足够的对比度
- 建立一致的色彩语义
- 深色模式下适当降低饱和度

## 7. 维护和更新指南

### 7.1 版本管理

- 配色系统版本号：v2.0.0
- 更新频率：季度评估，年度更新
- 兼容性：向下兼容至少两个版本

### 7.2 反馈和优化

- 定期收集用户反馈
- 进行可用性测试
- 监控色彩使用数据
- 持续优化配色方案

### 7.3 团队协作

- 设计师负责配色方案制定
- 前端开发负责技术实现
- 产品经理负责用户体验评估
- 定期举行配色规范培训

---

**文档版本：** v2.0.0  
**最后更新：** 2024年1月  
**维护团队：** ERP产品设计团队