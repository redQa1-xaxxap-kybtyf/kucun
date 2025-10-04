/**
 * 事件系统统一导出
 * 提供业务事件的发布订阅能力
 */

export * from './types';
export * from './publisher';

// 便捷别名
export {
  publishEvent as emit,
  notifyUser as notify,
  broadcast,
} from './publisher';
