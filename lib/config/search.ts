/**
 * 搜索功能统一配置
 * 遵循全栈项目统一约定规范
 */

export const SEARCH_CONFIG = {
  // 防抖延迟配置
  DEBOUNCE_DELAY: {
    DEFAULT: 400, // 默认延迟 (适用于大多数场景)
    FAST: 200, // 快速响应 (简单查询)
    SLOW: 600, // 慢速响应 (复杂查询、大数据量)
  },

  // 搜索参数限制
  MIN_SEARCH_LENGTH: 1, // 最小搜索长度
  MAX_SEARCH_LENGTH: 100, // 最大搜索长度
  MAX_RESULTS: 50, // 最大结果数量

  // 缓存配置
  CACHE: {
    STALE_TIME: 30 * 1000, // 30秒 - 数据新鲜时间
    GC_TIME: 5 * 60 * 1000, // 5分钟 - 垃圾回收时间
  },

  // 重试配置
  RETRY: {
    COUNT: 1, // 重试次数
    DELAY: 1000, // 重试延迟 (毫秒)
  },
} as const;

// 导出类型
export type SearchConfig = typeof SEARCH_CONFIG;
