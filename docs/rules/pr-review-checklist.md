# PR Review Checklist

## 通用

- [ ] 运行 `npm run lint`/`npm run type-check` 并确认无 error。
- [ ] 新增代码通过 `eslint`、`tsconfig` 的严格规则（无忽略）。
- [ ] UI 交互包含必要的 Loading/空态/Error 反馈。

## 表单与校验（新增）

### 验证逻辑结构

- [ ] 使用模块化验证结构：`schemas.ts` + `validators.ts` + `index.ts`
- [ ] `schemas.ts` 只包含字段类型、长度、格式等静态验证
- [ ] `validators.ts` 包含所有业务逻辑验证函数（状态依赖、动态规则）
- [ ] 验证函数命名遵循规范：`validate[Entity][Aspect]` 或 `validate[Aspect]By[Condition]`
- [ ] 在 `index.ts` 中使用 `superRefine` 组合所有验证规则
- [ ] 导出所有验证函数供单元测试使用

### 错误处理

- [ ] 使用 `useFormErrorHandling` 统一处理 `notifyBlur`/toast/focus，未直接暴露 `ZodError`
- [ ] 所有表单控件正确处理 `onBlur` 事件（调用 `notifyBlur`）
- [ ] 验证错误有友好提示和自动聚焦到错误字段
- [ ] 自定义选择器（客户/供应商/智能搜索等）在 `onBlur` 时调用 `notifyBlur`，确保 RHF 的 touched 状态正确

### 数据转换

- [ ] 使用数据转换层处理提交数据（`prepare…ForSubmit`）
- [ ] 使用数据转换层处理 API 响应（`transform…FromAPI`）
- [ ] 避免裸 `JSON.stringify(form.getValues())`
- [ ] 新增字段在转换层有对应的映射逻辑

### 业务验证

- [ ] Factory/Purchase 等业务表单依赖的 helper 已覆盖新增字段和状态分支
- [ ] 状态变更（如运输中）所需字段（集装箱号、船运公司等）均在 validator 中校验
- [ ] 草稿模式和确认模式的验证规则正确区分
- [ ] 手工产品 vs 库存产品的字段验证逻辑正确
- [ ] 所有权类型（客户货物 vs 自有货物）的验证逻辑正确

## 文档与测试

- [ ] 相关 README/最佳实践文档已经更新。
- [ ] 变更附带必要的单元/集成测试，或在 PR 中说明测试方式。
