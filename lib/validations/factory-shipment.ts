/**
 * 厂家发货订单验证规则 - 统一入口
 *
 * ⚠️ 此文件已重构为模块化结构
 * 实际实现位于 ./factory-shipment/ 目录下
 *
 * 重构原因：
 * - 原文件超过500行，违反 max-lines ESLint规则
 * - 应用SOLID单一职责原则，提高可维护性
 * - 参考销售订单验证的最佳实践
 *
 * 模块结构：
 * - schemas.ts: 基础Schema定义和枚举
 * - validators.ts: 自定义验证逻辑
 * - index.ts: 组合验证规则并导出
 */

// 重新导出所有内容以保持向后兼容
export * from './factory-shipment/index';
