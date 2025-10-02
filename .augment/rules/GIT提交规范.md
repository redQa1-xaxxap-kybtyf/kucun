---
type: 'always_apply'
---

# Git 提交规范

> 确保提交信息准确、清晰、可追溯的完整指南

## 🎯 核心原则

### 1. 提交信息必须与实际代码改动完全一致

- ❌ **禁止**: 提交信息描述了大量修改,但实际只改了几行代码
- ✅ **正确**: 提交信息准确反映所有代码改动,不夸大也不遗漏

### 2. 一次提交只做一件事

- ❌ **禁止**: 一次提交包含多个不相关的修改(样式+API+性能优化)
- ✅ **正确**: 每次提交专注于单一目的,便于回滚和追溯

### 3. 提交前必须验证

- ❌ **禁止**: 直接提交未测试的代码
- ✅ **正确**: 提交前运行 ESLint、TypeScript 检查和相关测试

## 📝 提交信息格式

### 基本格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 类型

| 类型       | 说明                 | 示例                                   |
| ---------- | -------------------- | -------------------------------------- |
| `feat`     | 新功能               | `feat(finance): 添加应收款统计图表`    |
| `fix`      | Bug 修复             | `fix(api): 修复分页参数验证错误`       |
| `refactor` | 代码重构(不改变功能) | `refactor(api): 拆分超长函数`          |
| `style`    | 样式修改(UI/CSS)     | `style(finance): 统一卡片样式`         |
| `perf`     | 性能优化             | `perf(cache): 添加 Redis 缓存层`       |
| `test`     | 测试相关             | `test(api): 添加销售订单 API 测试`     |
| `docs`     | 文档修改             | `docs(readme): 更新安装说明`           |
| `chore`    | 构建/工具/依赖       | `chore(deps): 升级 Next.js 到 15.4`    |
| `revert`   | 回滚提交             | `revert: 回滚 feat(finance): 添加图表` |

### Scope 范围

常用范围:

- `api` - API 接口
- `ui` - 用户界面
- `finance` - 财务模块
- `inventory` - 库存模块
- `sales` - 销售模块
- `customer` - 客户管理
- `supplier` - 供应商管理
- `product` - 产品管理
- `cache` - 缓存系统
- `database` - 数据库
- `auth` - 认证授权

### Subject 主题

- 使用中文描述
- 不超过 50 个字符
- 使用祈使句,不要过去式
- 首字母小写
- 结尾不加句号

✅ 正确示例:

```
feat(finance): 添加应收款导出功能
fix(api): 修复分页参数验证错误
refactor(inventory): 拆分库存查询函数
```

❌ 错误示例:

```
添加了导出功能。  # 缺少 type 和 scope
Fix bug  # 使用英文且不具体
修复了一些问题  # 不具体
```

### Body 正文(可选)

详细说明:

- 为什么做这个修改
- 修改了什么
- 如何修改的
- 影响范围

示例:

```
feat(finance): 添加应收款批量导出功能

## 修改内容
- 添加导出按钮和下拉菜单
- 实现 Excel 导出逻辑
- 支持筛选条件导出
- 添加导出进度提示

## 技术实现
- 使用 xlsx 库生成 Excel 文件
- 后端分页查询避免内存溢出
- 前端使用 Blob 下载文件

## 影响范围
- 新增 /api/finance/receivables/export 接口
- 修改应收款列表页面
```

### Footer 页脚(可选)

用于:

- 关联 Issue: `Closes #123`
- 破坏性变更: `BREAKING CHANGE: API 参数格式变更`
- 相关提交: `Related to #456`

## ✅ 提交前检查清单

### 必须完成的检查

```bash
# 1. 查看实际修改的文件
git status

# 2. 查看具体改动内容
git diff

# 3. 运行 ESLint 检查
npm run lint

# 4. 运行 TypeScript 检查
npm run type-check

# 5. 格式化代码
npm run format

# 6. 确认暂存的文件
git diff --cached
```

### 提交信息检查

- [ ] Type 类型正确
- [ ] Scope 范围准确
- [ ] Subject 描述清晰具体
- [ ] 提交信息与实际改动一致
- [ ] 没有包含无关的文件修改
- [ ] 没有提交调试代码或 console.log
- [ ] 没有提交敏感信息(密码、密钥等)

## 🚫 常见错误示例

### 错误 1: 提交信息与实际不符

```bash
# ❌ 错误
git commit -m "feat(finance): 统一财务管理页面 UI 风格

- 统一页面容器为 space-y-6
- 统一标题样式
- 统一统计卡片结构
- 统一搜索框样式
..."

# 实际只改了 2 行代码:
# - handleSearch -> _handleSearch
# - handleReset -> _handleReset

# ✅ 正确
git commit -m "refactor(finance): 标记未使用的函数为私有

- 将 handleSearch 重命名为 _handleSearch
- 将 handleReset 重命名为 _handleReset
- 修复 ESLint no-unused-vars 警告"
```

### 错误 2: 一次提交做多件事

```bash
# ❌ 错误
git commit -m "修复 bug 并添加新功能和优化性能"

# ✅ 正确 - 拆分为 3 个提交
git commit -m "fix(api): 修复分页参数验证错误"
git commit -m "feat(finance): 添加应收款导出功能"
git commit -m "perf(cache): 添加 Redis 缓存层"
```

### 错误 3: 提交信息不具体

```bash
# ❌ 错误
git commit -m "修复 bug"
git commit -m "更新代码"
git commit -m "优化"

# ✅ 正确
git commit -m "fix(api): 修复销售订单创建时库存检查逻辑错误"
git commit -m "refactor(inventory): 拆分库存查询函数,每个函数不超过50行"
git commit -m "perf(database): 为 sales_orders 表添加 customer_id 索引"
```

### 错误 4: 包含无关文件

```bash
# ❌ 错误 - 包含了数据库文件
git add .
git commit -m "feat(finance): 添加导出功能"
# 实际提交了: page.tsx, prisma/dev.db

# ✅ 正确 - 只提交相关文件
git add app/(dashboard)/finance/receivables/page.tsx
git add app/api/finance/receivables/export/route.ts
git commit -m "feat(finance): 添加应收款导出功能"
```

## 📋 提交流程

### 标准流程

```bash
# 1. 查看修改状态
git status

# 2. 查看具体改动
git diff

# 3. 运行代码检查
npm run lint
npm run type-check

# 4. 添加文件(精确指定)
git add app/(dashboard)/finance/receivables/page.tsx

# 5. 再次确认暂存内容
git diff --cached

# 6. 提交(使用规范格式)
git commit -m "feat(finance): 添加应收款导出功能

- 添加导出按钮和下拉菜单
- 实现 Excel 导出逻辑
- 支持筛选条件导出"

# 7. 推送到远程
git push origin <branch-name>
```

### 修改上一次提交

```bash
# 如果发现上次提交有问题,可以修改
git add <forgotten-file>
git commit --amend

# 注意: 只能修改未推送的提交!
```

## 🔍 提交历史检查

### 查看提交历史

```bash
# 查看最近 10 条提交
git log --oneline -10

# 查看某个文件的提交历史
git log --oneline -- path/to/file.tsx

# 查看某次提交的详细内容
git show <commit-hash>

# 查看某次提交修改的文件
git show <commit-hash> --stat
```

### 验证提交质量

```bash
# 检查提交信息是否符合规范
git log --oneline -10

# 检查每次提交的实际改动
git log -p -10

# 检查是否有大文件提交
git log --all --pretty=format: --name-only --diff-filter=A | sort -u
```

## 🛠️ 工具配置

### Commitlint 配置

项目已配置 Husky + lint-staged,会在提交前自动:

1. 运行 ESLint 检查
2. 运行 Prettier 格式化
3. 验证提交信息格式

如果检查失败,提交会被拒绝。

### 提交模板

可以创建提交模板:

```bash
# .gitmessage
<type>(<scope>): <subject>

# 为什么做这个修改?

# 修改了什么?

# 如何修改的?

# 影响范围?
```

配置使用:

```bash
git config commit.template .gitmessage
```

## 📚 参考资源

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Angular Commit Guidelines](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#commit)
- [Semantic Versioning](https://semver.org/)

---

**记住**: 好的提交信息是给未来的自己和团队成员的礼物!
