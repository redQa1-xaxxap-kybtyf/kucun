/**
 * 库存管理验证规则 - 统一导出入口
 * 遵循唯一真理源原则，实际验证规则已按功能模块拆分到不同文件中
 */

// 基础验证规则
export { baseValidations } from './inventory-base';
export {
  calculateTotalCost,
  validateColorCode,
  validateInventoryQuantity,
  validateProductionDate,
} from './inventory-base';

// 库存操作验证规则
export {
  batchOperationSchema,
  inventoryAdjustDefaults,
  inventoryAdjustSchema,
  inventoryCountSchema,
  outboundCreateDefaults,
  outboundCreateSchema,
} from './inventory-operations';

export type {
  BatchOperationFormData,
  InventoryAdjustFormData,
  InventoryCountFormData,
  OutboundCreateFormData,
} from './inventory-operations';

// 库存查询验证规则
export {
  inboundRecordSearchDefaults,
  inboundRecordSearchSchema,
  inventoryQuerySchema,
  inventorySearchDefaults,
  inventorySearchSchema,
  outboundRecordSearchDefaults,
  outboundRecordSearchSchema,
} from './inventory-queries';

export type {
  InboundRecordSearchFormData,
  InventorySearchFormData,
  OutboundRecordSearchFormData,
} from './inventory-queries';

// 入库操作验证 - 已迁移到 lib/validations/inbound.ts
// 遵循唯一真理源原则，删除冗余Schema定义
// 如需复杂入库验证，请使用 lib/validations/inbound.ts 中的 createInboundSchema

// 表单数据类型推导 - 向后兼容
// 删除对已迁移Schema的引用
// export type InboundCreateFormData = z.infer<typeof createInboundSchema>; // 从 inbound.ts 导入
