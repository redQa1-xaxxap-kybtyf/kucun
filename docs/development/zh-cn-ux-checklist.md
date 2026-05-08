# 中国 ERP 高频场景 UX Checklist

> **适用范围**：日常作业页（销售订单、库存、入库、出库、退货、财务流水等供销售员/仓管员/会计高频使用的页面）。
>
> **不适用**：仪表盘 / 经营分析 / 报表导出——这些走 `v3-pro-ui-standard.md`。
>
> **使用方法**：新增或修改作业页前，逐条对照本表；通不过的项必须在 PR 描述里说明豁免理由。

---

## 1. 表单录入

- [ ] **数字字段** 使用 `<Input type="number">`（项目基础组件已自动加 `inputMode="decimal"`）。不要自己写 `<input type="number">` 绕过基础组件。
- [ ] **电话字段** 使用 `<Input type="tel">`，自动 `inputMode="tel"`。
- [ ] **金额字段** 在表格里右对齐，类名带 `text-right`（基础 Table 已加 `tabular-nums`，会自动对齐千分位）。
- [ ] **粘贴清洗**：客户电话、身份证、银行卡号在保存前清洗 `+86`、空格、横线、括号、全角数字。Excel 导入侧使用 `lib/validations/sales-order-import.ts` 的 `optionalExcelPhone`。
- [ ] **日期字段** 兼容 `YYYY-MM-DD` / `YYYY/M/D` / `M/D`（当年）/ `YY.M.D` / `今天/昨天/前天`。导入侧用 `normalizeExcelDateText`。
- [ ] **金额"万"识别**：导入金额接受 `3万 / 1万5 / 3w / 3W`。导入侧用 `normalizeExcelNumberText`。

## 2. 数字 / 金额展示

- [ ] **金额** 用 `formatCurrency`（标准）或 `formatCurrencyCompact`（≥1 万自动切"X.X万 / X.X亿"，鼠标悬停显示完整）。列表页/卡片建议用 compact 版本。
- [ ] **数字列** 加 `text-right` 类，自动启用 `tabular-nums` 千分位对齐。
- [ ] **金额大写** 用 `numberToChinese`（`lib/utils/print-helpers.ts`），仅打印模板使用。

## 3. 状态徽章

- [ ] 使用业务侧的 `*_STATUS_VARIANTS`（销售订单 / 退货 / 工厂发货 / 财务等），不要在组件里手写 `className`。
- [ ] 新增业务状态时，在 `lib/types/<entity>.ts` 的 `_STATUS_VARIANTS` 里映射到 `STATUS_PALETTE`（`lib/config/status-palette.ts`），不要直接写 `'info'/'warning'`。
- [ ] 语义对应：草稿=draft、待操作/待结款=pending、已确认/进行中=active、物流/审批流转=inTransit、完成=done、失败/取消=failed、归档=archived。

## 4. 移动端

- [ ] 列表页搜索/筛选条 `sticky top-0 z-20`，滚动时不消失。
- [ ] 卡片底部操作按钮：主操作大尺寸 `h-9 px-3` 易点；次要操作收进 `<DropdownMenu>` 的 `MoreHorizontal`。不要并排三个 `h-7 px-2 text-xs` 小按钮。
- [ ] 卡片本身可点击进详情时，删除冗余的"查看"按钮。
- [ ] 长列表分页器在移动端要适配（最少 44px 触摸高度）。

## 5. 1024 屏（笔记本 / 政企机房）

- [ ] 核心作业表格 `min-w` 不要超过 920px（含侧边栏后剩 ~800px）。
- [ ] `lg → xl` 区间隐藏次要列（如订单的"日期"列），把信息合并到主列下方小字。
- [ ] 工具栏 grid 在 `lg:` 下应能四列横排，不要只在 `xl:` 才横排。

## 6. 客户 / 商品识别

- [ ] **客户名展示** 加电话尾 4 位：`张总 (8866)`，`title` 显示完整电话。中国销售员靠尾号区分同名客户。
- [ ] **批次号** 用 `font-mono`，末 4 位 bold（`<CopyableText displayContent>` 已支持）。
- [ ] **拼音搜索**：客户/产品搜索覆盖名称、编码、拼音首字母。`lib/utils/pinyin-loader.ts` 已实现。

## 7. 业务术语

- [ ] 用户可见文案禁止 `Dashboard / Stock / Sales Order / Statement / Ledger` 等英文词。详见 `v3-pro-ui-standard.md` 8.7 节标准术语词典。
- [ ] 同一功能全站术语统一（"编辑"或"修改"二选一，不混用）。

## 8. 打印 / 导出

- [ ] 销售单 / 出库单的合计金额必须有"中文大写"字段。
- [ ] 销售小票考虑 80mm 热敏 / A5 针打模板。
- [ ] Excel 导出列名用中文，金额列右对齐、数字列保留 2 位小数。

---

## 审查触发点

以下情形必须对照本表逐条复核：

1. 新增日常作业页（销售单录入、入库登记等）。
2. 现有作业页大改（重构搜索、列表、卡片、表单）。
3. AI 辅助生成 UI 代码：必须把本文件链接告知 AI，让其执行前自检。

## 维护

- 发现新的"中国 ERP 习惯不符"问题时，先解决，再把规则补到本表对应章节。
- 不在本表的规则不强制；本表只收录"已在多个场景验证过的高频规则"。
