/**
 * 一致性监控规则接口
 * 所有规则必须实现此接口
 */

import type { RuleOutput, RuleConfig, RuleContext } from './types';

export interface IConsistencyRule {
  /**
   * 规则唯一标识符
   */
  readonly ruleName: string;

  /**
   * 规则配置
   */
  config: RuleConfig;

  /**
   * 执行一致性检查
   * @param context 规则执行上下文（时间窗、分片等）
   * @returns 发现的异常列表
   */
  check(context: RuleContext): Promise<RuleOutput[]>;

  /**
   * 生成去重键（用于防止同一异常重复告警）
   * @param output 规则输出
   * @returns 去重键
   */
  generateDedupeKey(output: RuleOutput): string;

  /**
   * 规则是否支持增量扫描
   */
  supportsIncrementalScan: boolean;
}
