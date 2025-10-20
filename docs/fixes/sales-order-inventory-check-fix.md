# 销售订单库存检查修复

## 背景

销售订单创建页面在添加商品后会调用 `InventoryChecker` 组件。该组件根据产品列表上的 `inventory.availableQuantity` 字段判断可用库存。

由于产品列表查询 `getProducts()` 默认不携带库存数据（`productConfig.defaultIncludeInventory = false`），在订单表单中得到的 `product.inventory` 始终为空对象，`availableQuantity` 回退为 0，导致库存检查恒为不足。

## 影响

- 前端始终显示 “X 个商品库存不足，无法完成订单”。
- 无法提交状态为 `confirmed` 的订单，因为库存校验未通过。
- 实际库存充足也会误触发预警，影响业务操作。

## 修复方案

1. 扩展 `productQueryKeys.list` 的参数类型，支持在 Query Key 中携带 `includeInventory` / `includeStatistics` 标记，保证不同查询结果的缓存隔离。
2. 在 `ERPSalesOrderForm` 中请求产品列表时显式传入 `includeInventory: true`，确保产品数据包含实时的库存汇总。

3. 在 `InventoryChecker` 中忽略尚未选择商品或数量为 0 的订单行，避免新建行默认值触发误报。

## 验证建议

1. 打开 “新建销售订单” 页面，选择一个库存充足的商品，填写数量，确认库存提示消失。
2. 再选择一个库存不足的商品，确认依然能触发库存不足提示。
3. 提交草稿 / 确认订单，确保接口正常返回并在数据库中产生正确的预留库存。
4. 运行 `npm run type-check`（当前仓库存在既有的 Inventory 测试类型错误，需要与团队确认后统一处理）。

## 后续优化建议

- 对产品列表接口增加页码或按照选中商品过滤，减少一次性加载所有库存数据的开销。
- 将库存检查组件的提示信息与后台库存预留逻辑统一，避免二次判断差异导致的体验不一致。
- 为产品库存接口增加缓存更新事件，以降低高频刷新带来的数据库压力。
