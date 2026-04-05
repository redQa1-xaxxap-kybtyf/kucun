# 运行仓库进货端到端测试

> 快速运行指南 - 5分钟完成测试

## 🚀 快速开始

### 1. 启动开发服务器

```bash
# 在第一个终端窗口运行
npm run dev
```

等待服务器启动完成，确保看到：
```
✓ Ready in 3.5s
○ Local:   http://localhost:3001
```

### 2. 运行测试

```bash
# 在第二个终端窗口运行
npm run test:e2e -- warehouse-purchase.spec.ts
```

## 📊 预期结果

测试应该按以下顺序执行：

```
✓ 步骤1：准备测试数据（供应商和产品）
  ✅ 创建测试供应商: E2E测试供应商-1735977600000
  ✅ 创建测试产品1: E2E测试产品1
  ✅ 创建测试产品2: E2E测试产品2
  ✅ 创建测试产品3: E2E测试产品3

✓ 步骤2：创建采购订单
  ✅ 创建采购订单: PO-20250104-0001

✓ 步骤3：审核采购订单（状态流转）
  ✅ 订单状态: 草稿 → 已下单
  ✅ 订单状态: 已下单 → 已发货
  ✅ 订单状态: 已发货 → 运输中
  ✅ 订单状态: 运输中 → 已到货

✓ 步骤4：生成入库单并确认入库
  📦 订单包含 2 个产品明细
  ✅ 创建入库记录 1/2: IN20250104123456789001
  ✅ 创建入库记录 2/2: IN20250104123456789002

✓ 步骤5：验证库存更新
  ✅ 产品 E2E测试产品1 库存验证: 预期=100, 实际=100
  ✅ 产品 E2E测试产品1 成本验证: 预期=50, 实际=50
  ✅ 产品 E2E测试产品2 库存验证: 预期=200, 实际=200
  ✅ 产品 E2E测试产品2 成本验证: 预期=60, 实际=60

✓ 步骤6：验证应付款记录生成
  📊 查询到 1 条应付款记录
  ✅ 找到相关应付款记录: PAY-20250104-0001
  ✅ 应付款金额验证: 预期=17000, 实际=17000

✓ 异常场景：重复入库检测
  ✅ 幂等性保护验证: 通过

✓ 异常场景：库存不足验证
  ✅ 库存不足检测: 库存不足，当前可用库存：100

9 passed (45s)
```

## 🎯 测试覆盖的功能

- ✅ 供应商创建
- ✅ 产品创建
- ✅ 采购订单创建
- ✅ 采购订单状态流转（5个状态）
- ✅ 入库单生成
- ✅ 库存数量更新
- ✅ 库存成本计算
- ✅ 应付款记录生成
- ✅ 幂等性保护
- ✅ 库存可用性检查

## 🐛 常见问题

### 问题1：测试失败 - 无法连接到服务器

**错误信息**:
```
Error: page.goto: net::ERR_CONNECTION_REFUSED
```

**解决方案**:
```bash
# 确保开发服务器正在运行
npm run dev

# 检查端口3001是否被占用
netstat -ano | findstr :3001
```

### 问题2：测试失败 - 登录失败

**错误信息**:
```
Error: Timeout 10000ms exceeded waiting for URL
```

**解决方案**:
```bash
# 确保有admin账户
npm run db:seed

# 或手动创建管理员
npm run db:verify-admin
```

### 问题3：测试失败 - 数据库错误

**错误信息**:
```
PrismaClientKnownRequestError: Invalid prisma.xxx.create()
```

**解决方案**:
```bash
# 重新生成Prisma Client
npm run db:generate

# 推送数据库schema
npm run db:push
```

### 问题4：测试数据未清理

**解决方案**:
```bash
# 手动清理测试数据
npm run db:clear

# 或清理所有数据（谨慎使用）
npm run db:clear-all
```

## 🔍 调试技巧

### 1. 使用 UI 模式（推荐）

```bash
npm run test:e2e:ui
```

这会打开一个交互式界面，可以：
- 查看每个测试步骤
- 查看截图和视频
- 重新运行失败的测试
- 查看网络请求

### 2. 使用调试模式

```bash
npm run test:e2e:debug -- warehouse-purchase.spec.ts
```

这会：
- 打开浏览器窗口
- 暂停在每个步骤
- 允许你手动检查页面

### 3. 查看详细日志

```bash
npm run test:e2e -- warehouse-purchase.spec.ts --reporter=list
```

### 4. 保存失败截图

```bash
npm run test:e2e -- warehouse-purchase.spec.ts --screenshot=on
```

截图会保存在 `test-results/` 目录。

### 5. 录制视频

```bash
npm run test:e2e -- warehouse-purchase.spec.ts --video=on
```

视频会保存在 `test-results/` 目录。

## 📈 查看测试报告

```bash
# 生成HTML报告
npm run test:e2e:report
```

报告会在浏览器中打开，包含：
- 测试执行时间
- 成功/失败统计
- 截图和视频
- 详细的错误信息

## 🔄 持续集成

### GitHub Actions 配置示例

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Setup database
        run: |
          npm run db:generate
          npm run db:push
          npm run db:seed
      
      - name: Run E2E tests
        run: npm run test:e2e -- warehouse-purchase.spec.ts
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## 📝 测试数据说明

### 自动生成的数据

测试会自动创建以下数据（使用时间戳确保唯一性）：

1. **供应商**
   - ID: 自动生成UUID
   - 名称: `E2E测试供应商-{timestamp}`
   - 状态: active

2. **产品**（3个）
   - 产品1: 数量100，单价50，总价5000
   - 产品2: 数量200，单价60，总价12000
   - 产品3: 备用（未使用）

3. **采购订单**
   - 订单号: `PO-{YYYYMMDD}-{序号}`
   - 总金额: 17000
   - 状态: 从草稿到已到货

4. **入库记录**（2条）
   - 记录号: `IN{YYYYMMDD}{HHMMSS}{毫秒}{序号}`
   - 数量: 与采购订单一致
   - 成本: 与采购单价一致

### 数据清理

测试完成后会自动清理：
- ✅ 采购订单
- ✅ 产品
- ✅ 供应商
- ✅ 入库记录（级联删除）
- ✅ 库存记录（级联删除）

## 🎓 扩展测试

### 添加新的测试场景

```typescript
test('新场景：部分入库', async ({ page }) => {
  // 1. 获取采购订单
  // 2. 只入库部分数量
  // 3. 验证库存和订单状态
});
```

### 添加性能测试

```typescript
test('性能测试：批量入库', async ({ page }) => {
  const startTime = Date.now();
  
  // 执行批量入库
  for (let i = 0; i < 100; i++) {
    await createInbound(page, productId, 10);
  }
  
  const duration = Date.now() - startTime;
  expect(duration).toBeLessThan(30000); // 30秒内完成
});
```

## 📚 相关文档

- [完整测试指南](./WAREHOUSE_PURCHASE_TEST_GUIDE.md)
- [Playwright 官方文档](https://playwright.dev/)
- [项目测试规范](../../docs/quality/testing-guide.md)

---

**最后更新**: 2025-01-04  
**维护者**: AI Assistant


