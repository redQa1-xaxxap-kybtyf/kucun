/**
 * 全站徽章状态语义色谱
 *
 * 用于统一各业务模块（销售订单 / 工厂发货 / 退货 / 财务等）的状态徽章颜色，
 * 避免相同语义在不同模块映射成不同 Badge variant，造成跨模块视觉错乱。
 *
 * 规则：
 * - 业务侧的 *_STATUS_VARIANTS 一律映射到本表中的语义键，不直接写 'info'/'warning' 等。
 * - 新增业务时，先在本表里找到最贴近的语义键再使用；如果都不合适，再考虑扩展本表。
 */

import type { BadgeProps } from '@/components/ui/badge';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

export const STATUS_PALETTE = {
  /** 草稿 / 未开始：灰色边框，未进入流程 */
  draft: 'outline',
  /** 待操作 / 待结款 / 待审批 / 待签收：橙色，提醒用户处理 */
  pending: 'warning',
  /** 已确认进入主流程，可执行下一步：主蓝 */
  active: 'default',
  /** 流程已发出在外方流转（已发货走物流、已申请待审批）：浅蓝 */
  inTransit: 'info',
  /** 完成 / 已结清：绿色 */
  done: 'success',
  /** 失败 / 取消 / 逾期：红色 */
  failed: 'destructive',
  /** 归档 / 软停：浅灰，不再可操作但保留可见 */
  archived: 'secondary',
} as const satisfies Record<string, BadgeVariant>;

export type StatusPaletteKey = keyof typeof STATUS_PALETTE;
