# 库存管理系统文档

> 📚 系统文档索引，按类别组织

---

## 📖 用户指南

| 文档                                            | 描述         |
| ----------------------------------------------- | ------------ |
| [快速开始](guides/个人库存系统-快速开始指南.md) | 系统入门指南 |
| [打包发布](guides/打包发布指南.md)              | 生产环境部署 |
| [常见问题](guides/常见问题快速修复指南.md)      | 问题排查     |

---

## 🏗️ 架构设计

| 文档                                                    | 描述         |
| ------------------------------------------------------- | ------------ |
| [核算口径](architecture/核算口径合同-库存-销售-财务.md) | 财务核算规则 |
| [菜单结构](architecture/菜单结构更新说明.md)            | 系统菜单配置 |

---

## 🔧 开发规范

| 文档                                                                        | 描述                 |
| --------------------------------------------------------------------------- | -------------------- |
| [日志规范](development/LOGGING_GUIDE.md)                                    | 日志记录规范         |
| [调试指南](development/DEBUG_GUIDE.md)                                      | 本地调试方法         |
| [表单开发](development/form-development-best-practices.md)                  | 表单最佳实践         |
| [代码规范](development/project_rules.md)                                    | 项目编码规范         |
| [颜色系统](development/modern-enterprise-erp-color-system-specification.md) | UI 颜色规范          |
| [v3 PRO UI 标准](development/v3-pro-ui-standard.md)                         | 高清晰专业版设计规范 |

---

## 📦 功能模块

### 销售订单

- [销售订单费用分摊](features/sales-orders/) - 订单成本核算
- [自动定价](features/sales-orders/) - 智能定价功能

### 厂家发货

- [发货管理](features/factory-shipments/) - 厂家发货流程

### 财务模块

- [财务核算](features/finance/) - 财务报表与核算
- [费用类型](features/finance/统一费用类型开发文档.md) - 费用分类配置

### 库存管理

- [批次管理](features/inventory/) - 库存批次追踪

---

## 📂 归档

历史修复报告和评估文档已归档到 [archive/2025-Q4/](archive/2025-Q4/)

---

_最后更新: 2026-01-11_
