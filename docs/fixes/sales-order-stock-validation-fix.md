# 销售订单库存验证修复

## 背景
销售订单创建页在点击“添加商品”后立即显示“库存不足”提示。即便实际库存充足，`InventoryChecker` 组件仍然根据 `0` 可用库存给出错误结论，导致用户无法正常录入订单。

## 原因
1. 产品列表请求未显式携带 `includeInventory` 标记，返回的数据缺失库存汇总，`availableQuantity` 回退为 `0`。
2. 库存校验组件直接读取 `useFieldArray` 暴露的 `fields`，该集合不会随表单输入实时更新，取到的 `productId` 与 `quantity` 始终是初始化值。
3. `InventoryChecker` 将缺失或无效的库存数据当成 `0` 处理，进一步放大了“库存不足”的误报。

## 修复内容
- 在 `ERPSalesOrderForm` 的产品查询中显式传入 `includeInventory: true`，确保产品数据包含实时库存汇总。
- 引入 `inventoryCheckItems`，改为基于 `form.watch('items')` 的即时值驱动库存校验。
- 调整 `InventoryChecker`：
  - 提前过滤 `productId` 为空或数量无效的行。
  - 缺失库存数据时跳过校验，防止被当作 `0`。
  - 使用数值化后的 `requestedQuantity`/`availableQuantity` 进行比较，保留提示语义。

## 验证
1. 在“新建销售订单”中添加库存充足的商品，默认数量 1 不再触发错误提示。
2. 手动将数量调高至超出库存时，可以看到正确的“库存不足”提示。
3. 添加库存为 0 的商品，`InventoryChecker` 会给出准确的不足提示，其它商品不受影响。
4. 执行 `npm run lint`（当前仓库存在既有 lint 错误，命令会因遗留问题中断，需要后续统一处理）。

## 后续建议
- 统一梳理其它销售订单表单（如 `enhanced` / `invoice` 版本）的库存查询逻辑，避免重复踩坑。
- 为库存数据缺失场景输出显式提示（如“库存数据加载中”），进一步提升可维护性。
