# 端到端测试文档

本目录包含项目的端到端（E2E）测试，使用 Playwright 测试框架。

## 📋 目录结构

```
tests/e2e/
├── pages/                      # Page Object Model 页面对象
│   └── sales-orders-page.ts   # 销售订单页面对象
├── sales-orders/               # 销售订单相关测试
│   └── confirm-shipment.spec.ts # 确认发货功能测试
├── purchase-orders.spec.ts     # 采购订单测试
├── warehouse-inbound-api.spec.ts # 仓库入库 API 测试
├── warehouse-purchase.spec.ts  # 仓库进货测试
└── README.md                   # 本文档
```

## 🚀 快速开始

### 前置条件

1. **安装依赖**
   ```bash
   npm install
   ```

2. **安装 Playwright 浏览器**
   ```bash
   npx playwright install
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```
   确保服务器运行在 `http://localhost:3000`

4. **准备测试数据**
   - 确保数据库中有测试用户（用户名: `admin`, 密码: `admin123`）
   - 确保有足够的测试数据（订单、产品等）

### 运行测试

#### 运行所有测试
```bash
npm run test:e2e
```

#### 运行特定测试文件
```bash
# 运行销售订单确认发货测试
npx playwright test tests/e2e/sales-orders/confirm-shipment.spec.ts

# 运行仓库进货测试
npx playwright test tests/e2e/warehouse-purchase.spec.ts
```

#### 运行特定测试用例
```bash
# 运行单个测试
npx playwright test -g "应该能够确认单个订单发货"
```

#### 调试模式运行
```bash
# 使用 UI 模式（推荐）
npx playwright test --ui

# 使用调试模式
npx playwright test --debug

# 使用 headed 模式（显示浏览器）
npx playwright test --headed
```

#### 查看测试报告
```bash
# 生成并打开 HTML 报告
npx playwright show-report
```

## 📝 测试说明

### 销售订单确认发货测试

**文件**: `tests/e2e/sales-orders/confirm-shipment.spec.ts`

**测试目标**: 验证修复后的缓存刷新策略（使用 `refetchQueries` 替代 `invalidateQueries`）能够正确工作。

**测试场景**:

1. **单个订单确认发货测试**
   - 验证点击"确认发货"后，订单状态立即更新
   - 验证订单从"待发货"列表中消失
   - 验证订单出现在"已发货"列表中

2. **多个连续确认测试**
   - 验证连续确认多个订单时，每个订单状态都正确更新
   - 验证其他未操作的订单状态保持不变

3. **快速点击幂等性测试**
   - 验证快速连续点击"确认发货"按钮时，只发送一次 API 请求
   - 验证订单状态正确更新，没有错误提示

4. **页面刷新验证测试**
   - 验证确认发货后刷新页面，订单状态保持正确
   - 验证数据持久化正确

5. **回归测试**
   - 验证之前发现的 bug（多个订单时状态不刷新）已被修复
   - 这是最重要的测试，确保修复有效

**运行方法**:
```bash
# 运行所有销售订单测试
npx playwright test tests/e2e/sales-orders/

# 运行特定测试
npx playwright test tests/e2e/sales-orders/confirm-shipment.spec.ts

# 使用 UI 模式调试
npx playwright test tests/e2e/sales-orders/confirm-shipment.spec.ts --ui
```

**测试数据要求**:
- 至少需要 3 个"待发货"状态的销售订单
- 如果订单不足，测试会自动跳过并提示

**准备测试数据**:
```bash
# 方法 1: 通过 UI 创建订单
# 1. 登录系统
# 2. 创建销售订单
# 3. 将订单状态设置为"待发货"

# 方法 2: 使用数据库脚本（如果有）
# npm run seed:test-data
```

### 仓库进货测试

**文件**: `tests/e2e/warehouse-purchase.spec.ts`

**测试范围**:
- 采购订单创建流程
- 入库单生成
- 库存更新验证
- 财务记录验证

详见文件内的注释说明。

## 🛠️ Page Object Model

本项目使用 Page Object Model (POM) 设计模式来组织测试代码。

### 什么是 Page Object Model？

Page Object Model 是一种设计模式，将页面的元素定位和操作封装到独立的类中，使测试代码更易维护。

### 示例：销售订单页面对象

```typescript
import { SalesOrdersPage } from '../pages/sales-orders-page';

test('测试示例', async ({ page }) => {
  const salesOrdersPage = new SalesOrdersPage(page);
  
  // 导航到页面
  await salesOrdersPage.goto();
  
  // 筛选订单
  await salesOrdersPage.filterByStatus('pending_shipment');
  
  // 确认发货
  await salesOrdersPage.confirmShipment('SO202511060001');
  
  // 验证状态
  await salesOrdersPage.verifyOrderExists('SO202511060001', false);
});
```

### 创建新的 Page Object

1. 在 `tests/e2e/pages/` 目录下创建新文件
2. 导出一个类，包含页面的所有操作方法
3. 在测试文件中导入并使用

## 📸 截图和视频

### 截图位置
- 失败时自动截图: `test-results/`
- 手动截图: `tests/screenshots/`

### 视频录制
- 失败时自动录制: `test-results/`
- 配置: `playwright.config.ts` 中的 `video` 选项

## 🐛 调试技巧

### 1. 使用 UI 模式（推荐）
```bash
npx playwright test --ui
```
- 可视化测试执行
- 逐步调试
- 查看元素定位
- 查看网络请求

### 2. 使用 Playwright Inspector
```bash
npx playwright test --debug
```
- 逐步执行测试
- 查看页面状态
- 修改选择器

### 3. 查看浏览器
```bash
npx playwright test --headed
```
- 显示浏览器窗口
- 观察测试执行过程

### 4. 慢速执行
```bash
npx playwright test --headed --slow-mo=1000
```
- 每个操作延迟 1 秒
- 便于观察

### 5. 查看日志
测试文件中使用 `console.log()` 输出的日志会显示在终端中。

## ⚙️ 配置

### Playwright 配置文件
`playwright.config.ts` - 全局配置

主要配置项:
- `testDir`: 测试目录
- `timeout`: 测试超时时间
- `retries`: 重试次数
- `workers`: 并行执行数量
- `use.baseURL`: 基础 URL
- `use.screenshot`: 截图策略
- `use.video`: 视频录制策略

### 环境变量
可以通过环境变量配置测试:
```bash
# 设置基础 URL
BASE_URL=http://localhost:3000 npx playwright test

# CI 环境
CI=true npx playwright test
```

## 📊 测试报告

### HTML 报告
```bash
# 运行测试并生成报告
npx playwright test

# 查看报告
npx playwright show-report
```

### 其他报告格式
在 `playwright.config.ts` 中配置:
```typescript
reporter: [
  ['html'],
  ['json', { outputFile: 'test-results.json' }],
  ['junit', { outputFile: 'test-results.xml' }],
]
```

## 🔧 常见问题

### 1. 测试超时
**问题**: 测试执行超过 60 秒超时

**解决方案**:
- 增加超时时间: `test.setTimeout(120000)`
- 优化等待策略
- 检查网络请求是否卡住

### 2. 元素找不到
**问题**: `Error: Timeout waiting for selector`

**解决方案**:
- 检查选择器是否正确
- 增加等待时间
- 使用 `page.waitForSelector()`
- 使用 Playwright Inspector 调试

### 3. 测试数据不足
**问题**: 测试跳过，提示数据不足

**解决方案**:
- 通过 UI 创建测试数据
- 使用数据库脚本准备数据
- 在测试中动态创建数据

### 4. 登录失败
**问题**: 无法登录系统

**解决方案**:
- 检查测试用户是否存在
- 检查验证码是否正确（测试环境使用固定验证码 `TEST1234`）
- 检查服务器是否运行

## 📚 参考资源

- [Playwright 官方文档](https://playwright.dev/)
- [Playwright 最佳实践](https://playwright.dev/docs/best-practices)
- [Page Object Model](https://playwright.dev/docs/pom)
- [测试选择器](https://playwright.dev/docs/selectors)

## 🤝 贡献指南

### 添加新测试

1. 确定测试范围和场景
2. 创建或使用现有的 Page Object
3. 编写测试用例
4. 运行测试确保通过
5. 更新本文档

### 测试命名规范

- 测试文件: `*.spec.ts`
- Page Object: `*-page.ts`
- 测试描述: 使用中文，清晰描述测试目的

### 代码规范

- 遵循项目 ESLint 规范
- 使用 Page Object Model 模式
- 添加清晰的注释
- 使用有意义的变量名

---

**最后更新**: 2025-11-07
**维护者**: 开发团队

