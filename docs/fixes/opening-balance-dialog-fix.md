# 期初入库确认对话框修复报告

**修复日期**: 2025-11-19  
**问题**: 产品入库功能使用原生 `window.confirm()` 不符合项目技术栈  
**状态**: ✅ 已完成

---

## 📋 问题描述

在产品入库功能中，期初入库提交时使用了浏览器原生的 `window.confirm()` 对话框，存在以下问题：

1. ❌ 样式与项目不一致，无法自定义
2. ❌ 用户体验差，阻塞式弹窗
3. ❌ 移动端显示效果不佳
4. ❌ 可访问性支持有限
5. ❌ 不符合项目 shadcn/ui 技术栈规范

---

## 🔧 修复方案

### 1. 创建新组件

**文件**: `components/inventory/opening-balance-confirm-dialog.tsx`

- 使用 shadcn/ui Dialog 组件
- 受控组件设计，通过 props 控制显示状态
- 提供 `onConfirm` 和 `onCancel` 回调
- 样式与项目其他对话框保持一致

**关键特性**:

- 黄色/橙色警告主题
- 使用 `AlertTriangle` 图标
- 清晰的警告文案
- 响应式设计，移动端友好

### 2. 修改提交逻辑

**文件**: `hooks/use-inbound-form-submit.ts`

**主要改动**:

- 添加 `skipConfirm` 参数，控制是否跳过确认
- 移除原生 `window.confirm()` 调用
- 当需要确认时抛出特殊错误 `ConfirmationRequired`
- 让调用方决定如何处理确认逻辑

**代码逻辑**:

```typescript
// 如果 skipConfirm 为 false 且是期初入库，抛出特殊错误
if (!skipConfirm && data.reason === 'opening_balance') {
  const error = new Error('REQUIRES_OPENING_BALANCE_CONFIRMATION');
  error.name = 'ConfirmationRequired';
  throw error;
}
```

### 3. 更新表单组件

**文件**: `components/inventory/erp-inbound-form.tsx`

**主要改动**:

1. 导入 `OpeningBalanceConfirmDialog` 组件
2. 添加状态管理:
   - `showConfirmDialog`: 控制对话框显示
   - `pendingFormData`: 保存待提交的表单数据
3. 创建两个提交 Hook 实例:
   - `submitInbound`: skipConfirm=false，用于初次提交
   - `submitInboundWithoutConfirm`: skipConfirm=true，用于确认后提交
4. 在表单提交时捕获 `ConfirmationRequired` 错误，显示对话框
5. 用户确认后，使用 `submitInboundWithoutConfirm` 执行实际提交

**流程图**:

```
用户点击提交
    ↓
表单验证
    ↓
调用 submitInbound (skipConfirm=false)
    ↓
检测到期初入库 → 抛出 ConfirmationRequired 错误
    ↓
捕获错误 → 显示确认对话框
    ↓
用户点击"确认入库"
    ↓
调用 submitInboundWithoutConfirm (skipConfirm=true)
    ↓
执行实际提交
```

---

## 🎨 对话框设计

### 视觉效果

- **标题**: "期初入库确认" + 黄色警告图标
- **主要文案**: "您正在录入期初库存数据，请确认数据准确无误。"
- **次要说明**: "期初库存将影响后续所有财务核算，建议录入完成后进行核对。"
- **按钮**:
  - 取消按钮: outline 样式
  - 确认按钮: 黄色主题 (bg-amber-600)

### 技术特性

- ✅ 支持 ESC 键关闭
- ✅ 支持点击遮罩层关闭
- ✅ 响应式设计 (sm:max-w-[425px])
- ✅ 平滑的动画效果
- ✅ 完整的可访问性支持

---

## 🧪 测试步骤

### 测试场景 1: 普通入库（不触发确认）

1. 访问 `/inventory/inbound/create`
2. 选择产品，填写入库信息
3. 入库原因选择"采购入库"或其他非期初类型
4. 点击"提交"
5. **预期**: 直接提交，不显示确认对话框

### 测试场景 2: 期初入库（触发确认）

1. 访问 `/inventory/inbound/create?type=opening_balance`
2. 选择产品，填写入库信息
3. 入库原因自动设置为"期初入库"
4. 点击"提交"
5. **预期**: 显示现代化的确认对话框
6. 点击"取消"
7. **预期**: 对话框关闭，表单数据保留
8. 再次点击"提交"
9. 点击"确认入库"
10. **预期**: 提交成功，跳转到入库记录列表

### 测试场景 3: 键盘操作

1. 触发期初入库确认对话框
2. 按 ESC 键
3. **预期**: 对话框关闭
4. 再次触发对话框
5. 按 Tab 键切换焦点
6. 按 Enter 键
7. **预期**: 执行当前焦点按钮的操作

### 测试场景 4: 移动端

1. 使用移动设备或浏览器开发者工具切换到移动视图
2. 触发期初入库确认对话框
3. **预期**: 对话框适配移动屏幕，显示正常

---

## ✅ 验证清单

- [x] 代码编译无错误
- [x] TypeScript 类型检查通过
- [x] 符合项目 UI 规范
- [x] 与其他对话框样式一致
- [ ] 普通入库功能测试通过
- [ ] 期初入库确认流程测试通过
- [ ] 键盘操作测试通过
- [ ] 移动端显示测试通过

---

## 📝 文件变更清单

1. **新增文件**:
   - `components/inventory/opening-balance-confirm-dialog.tsx` (91 行)

2. **修改文件**:
   - `hooks/use-inbound-form-submit.ts` (+7 行, -9 行)
   - `components/inventory/erp-inbound-form.tsx` (+42 行, -3 行)

3. **总计**: +140 行, -12 行

---

## 🎯 后续建议

1. **代码审查**: 检查项目中是否还有其他使用原生对话框的地方
2. **ESLint 规则**: 添加规则禁止使用 `window.confirm`、`window.alert`、`window.prompt`
3. **文档更新**: 在开发规范中明确要求使用 shadcn/ui Dialog
4. **组件复用**: 考虑将确认对话框抽象为通用组件

---

## 📚 相关资源

- [shadcn/ui Dialog 文档](https://ui.shadcn.com/docs/components/dialog)
- [Radix UI Dialog 文档](https://www.radix-ui.com/docs/primitives/components/dialog)
- 项目中其他对话框示例:
  - `components/factory-shipments/confirm-inbound-dialog.tsx`
  - `components/factory-shipments/supplement-shipping-info-dialog.tsx`
