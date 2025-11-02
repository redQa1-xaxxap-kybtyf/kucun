/**
 * 通用船舶信息提取器
 * 支持多个船舶查询网站的智能数据提取
 *
 * 核心策略：
 * 1. 多层级选择器匹配
 * 2. 智能内容识别
 * 3. 容错数据提取
 * 4. 网站特征自适应
 */

// cSpell:ignore mmsi shipxy chinaports vesselfinder shipfinder myshiptracking hifleet

import { logger } from '@/lib/logger';
import type { ExtractSelectors } from '@/lib/types/shipping';

// 数据提取结果
export interface ShipData {
  status?: string;
  destination?: string;
  estimatedArrival?: string;
  updateTime?: string;
  lastUpdateTime?: string;
  mmsi?: string;
  imo?: string;
  callSign?: string;
  position?: string;
  speed?: string;
  heading?: string;
  confidence?: number; // 提取置信度
}

// 提取配置
export interface ExtractConfig {
  siteType: 'shipxy' | 'chinaports' | 'vesselfinder' | 'shipfinder' | 'myshiptracking' | 'hifleet' | 'generic';
  strategies: ExtractStrategy[];
}

// 提取策略
export interface ExtractStrategy {
  name: string;
  priority: number;
  selectors?: {
    status: string[];
    destination: string[];
    estimatedArrival: string[];
    updateTime: string[];
    additional?: Record<string, string[]>;
  };
  patterns?: {
    status: RegExp[];
    destination: RegExp[];
    estimatedArrival: RegExp[];
    updateTime: RegExp[];
  };
}

/**
 * 通用船舶数据提取器
 */
export class UniversalShipExtractor {
  private static readonly STRATEGIES: ExtractStrategy[] = [
    // 策略1: 表格格式提取 (适用于shipxy.com, chinaports.com)
    {
      name: 'table_based',
      priority: 1,
      selectors: {
        status: [
          'tr:contains("状态") + td',
          'tr:contains("Status") + td',
          'td:contains("状态") + td',
          'td[data-field="status"]',
          '.status',
          '[class*="status"]'
        ],
        destination: [
          'tr:contains("目的地") + td',
          'tr:contains("Destination") + td',
          'td:contains("目的地") + td',
          'td[data-field="destination"]',
          '.destination',
          '[class*="destination"]'
        ],
        estimatedArrival: [
          'tr:contains("预到") + td',
          'tr:contains("ETA") + td',
          'tr:contains("预计到达") + td',
          'td:contains("预到") + td',
          'td[data-field="eta"]',
          '.eta',
          '[class*="eta"]'
        ],
        updateTime: [
          'tr:contains("更新") + td',
          'tr:contains("Update") + td',
          'td:contains("更新") + td',
          'td[data-field="update"]',
          '.update-time',
          '[class*="update"]'
        ]
      }
    },

    // 策略2: 卡片格式提取 (适用于vesselfinder.com, shipfinder.com)
    {
      name: 'card_based',
      priority: 2,
      selectors: {
        status: [
          '[data-testid="vessel-status"]',
          '.vessel-status',
          '[class*="status-info"]',
          'div:contains("Status") + div',
          'span[class*="status"]'
        ],
        destination: [
          '[data-testid="destination"]',
          '.destination-info',
          '[class*="destination"]',
          'div:contains("Destination") + div',
          'span[class*="dest"]'
        ],
        estimatedArrival: [
          '[data-testid="eta"]',
          '.eta-info',
          '[class*="arrival"]',
          'div:contains("ETA") + div',
          'time[datetime]'
        ],
        updateTime: [
          '[data-testid="last-update"]',
          '.last-update',
          '[class*="timestamp"]',
          'div:contains("Last") div:contains("update")',
          'time[title*="update"]'
        ]
      }
    },

    // 策略3: 通用文本匹配 (适用于所有网站)
    {
      name: 'text_pattern',
      priority: 3,
      patterns: {
        status: [
          /状态[:：]\s*([^\n\r]+)/i,
          /Status[:：]\s*([^\n\r]+)/i,
          /船舶状态[:：]\s*([^\n\r]+)/i
        ],
        destination: [
          /目的地[:：]\s*([^\n\r]+)/i,
          /Destination[:：]\s*([^\n\r]+)/i,
          /前往[:：]\s*([^\n\r]+)/i
        ],
        estimatedArrival: [
          /预到时间?[:：]\s*([^\n\r]+)/i,
          /ETA[:：]\s*([^\n\r]+)/i,
          /预计到达[:：]\s*([^\n\r]+)/i
        ],
        updateTime: [
          /更新时间?[:：]\s*([^\n\r]+)/i,
          /Last Update[:：]\s*([^\n\r]+)/i,
          /最后更新[:：]\s*([^\n\r]+)/i
        ]
      }
    },

    // 策略4: JSON数据提取 (适用于提供API的网站)
    {
      name: 'json_data',
      priority: 4,
      selectors: {
        status: [
          'script:contains("vesselStatus")',
          'script:contains("shipStatus")',
          '[data-vessel-status]'
        ],
        destination: [
          'script:contains("destination")',
          '[data-destination]'
        ],
        estimatedArrival: [
          'script:contains("eta")',
          'script:contains("estimatedArrival")',
          '[data-eta]'
        ],
        updateTime: [
          'script:contains("lastUpdate")',
          'script:contains("updateTime")',
          '[data-last-update]'
        ]
      }
    }
  ];

  /**
   * 执行数据提取
   */
  static async extractShipData(
    pageContent: string,
    url: string,
    _customConfig?: Partial<ExtractConfig>
  ): Promise<ShipData> {
    // 1. 检测网站类型
    const siteType = this.detectSiteType(url);

    // 2. 获取提取策略
    const strategies = this.getStrategiesForSite(siteType, _customConfig);

    // 3. 按优先级执行提取
    const results: ShipData[] = [];

    for (const strategy of strategies) {
      try {
        const result = await this.executeStrategy(pageContent, strategy);
        if (result && this.hasValidData(result)) {
          result.confidence = this.calculateConfidence(result, strategy);
          results.push(result);
        }
      } catch (error) {
        logger.warn(
          'universal-ship-extractor',
          `策略 ${strategy.name} 执行失败`,
          undefined,
          { error: error instanceof Error ? error.message : String(error) }
        );
      }
    }

    // 4. 合并最佳结果
    return this.mergeResults(results);
  }

  /**
   * 检测网站类型
   */
  private static detectSiteType(url: string): ExtractConfig['siteType'] {
    const urlLower = url.toLowerCase();

    if (urlLower.includes('shipxy.com')) return 'shipxy';
    if (urlLower.includes('chinaports.com')) return 'chinaports';
    if (urlLower.includes('vesselfinder.com')) return 'vesselfinder';
    if (urlLower.includes('shipfinder.com')) return 'shipfinder';
    if (urlLower.includes('myshiptracking.com')) return 'myshiptracking';
    if (urlLower.includes('hifleet.com')) return 'hifleet';

    return 'generic';
  }

  /**
   * 获取网站特定策略
   */
  private static getStrategiesForSite(
    siteType: ExtractConfig['siteType'],
    _customConfig?: Partial<ExtractConfig>
  ): ExtractStrategy[] {
    // 根据网站类型调整策略优先级
    const strategies = [...this.STRATEGIES];

    switch (siteType) {
      case 'shipxy':
        // shipxy使用表格格式
        strategies[0].priority = 1;
        strategies[1].priority = 3;
        break;
      case 'vesselfinder':
      case 'shipfinder':
        // 这些网站使用卡片格式
        strategies[1].priority = 1;
        strategies[0].priority = 3;
        break;
      case 'chinaports':
        // 混合格式，表格优先
        strategies[0].priority = 1;
        strategies[2].priority = 2; // 文本匹配也有效
        break;
    }

    return strategies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 执行提取策略
   */
  private static async executeStrategy(
    pageContent: string,
    strategy: ExtractStrategy
  ): Promise<ShipData> {
    const result: ShipData = {};

    if (strategy.selectors) {
      // CSS选择器提取
      result.status = this.extractBySelectors(pageContent, strategy.selectors.status);
      result.destination = this.extractBySelectors(pageContent, strategy.selectors.destination);
      result.estimatedArrival = this.extractBySelectors(pageContent, strategy.selectors.estimatedArrival);
      result.updateTime = this.extractBySelectors(pageContent, strategy.selectors.updateTime);
    }

    if (strategy.patterns) {
      // 正则表达式提取
      if (!result.status) result.status = this.extractByPatterns(pageContent, strategy.patterns.status);
      if (!result.destination) result.destination = this.extractByPatterns(pageContent, strategy.patterns.destination);
      if (!result.estimatedArrival) result.estimatedArrival = this.extractByPatterns(pageContent, strategy.patterns.estimatedArrival);
      if (!result.updateTime) result.updateTime = this.extractByPatterns(pageContent, strategy.patterns.updateTime);
    }

    return this.cleanData(result);
  }

  /**
   * 通过选择器提取数据
   */
  private static extractBySelectors(_content: string, _selectors: string[]): string | undefined {
    // 这里需要实际的DOM操作，暂时返回undefined
    // 在PuppeteerService中实现真正的选择器逻辑
    return undefined;
  }

  /**
   * 通过正则表达式提取数据
   */
  private static extractByPatterns(content: string, patterns: RegExp[]): string | undefined {
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return undefined;
  }

  /**
   * 清理和标准化数据
   */
  private static cleanData(data: ShipData): ShipData {
    const cleaned: ShipData = {};

    // 清理状态信息
    if (data.status) {
      cleaned.status = data.status.replace(/[\-_]/g, '').trim();
      if (cleaned.status === '' || cleaned.status === '-') {
        delete cleaned.status;
      }
    }

    // 清理目的地信息
    if (data.destination) {
      cleaned.destination = data.destination.replace(/[\-_]/g, '').trim();
      if (cleaned.destination === '' || cleaned.destination === '-') {
        delete cleaned.destination;
      }
    }

    // 标准化时间格式
    if (data.estimatedArrival) {
      cleaned.estimatedArrival = this.normalizeDateTime(data.estimatedArrival);
    }
    if (data.updateTime) {
      const normalized = this.normalizeDateTime(data.updateTime);
      cleaned.updateTime = normalized;
      cleaned.lastUpdateTime = normalized;
    }
    if (!cleaned.updateTime && data.lastUpdateTime) {
      const normalized = this.normalizeDateTime(data.lastUpdateTime);
      cleaned.lastUpdateTime = normalized;
      cleaned.updateTime = normalized;
    }

    return cleaned;
  }

  /**
   * 标准化日期时间格式
   */
  private static normalizeDateTime(dateStr: string): string {
    // 这里可以添加更多的时间格式标准化逻辑
    return dateStr.trim();
  }

  /**
   * 检查是否有有效数据
   */
  private static hasValidData(data: ShipData): boolean {
    return !!(data.status || data.destination || data.estimatedArrival || data.updateTime || data.lastUpdateTime);
  }

  /**
   * 计算提取置信度
   */
  private static calculateConfidence(data: ShipData, strategy: ExtractStrategy): number {
    let confidence = strategy.priority * 0.1; // 基础置信度

    // 根据提取到的数据数量调整置信度
    const dataCount = Object.values(data).filter(Boolean).length;
    confidence += dataCount * 0.2;

    return Math.min(confidence, 1.0);
  }

  /**
   * 合并多个提取结果
   */
  private static mergeResults(results: ShipData[]): ShipData {
    if (results.length === 0) return {};

    // 按置信度排序，选择最高置信度的结果作为基础
    results.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    const merged = { ...results[0] };

    // 补充缺失的字段
    for (let i = 1; i < results.length; i++) {
      const result = results[i];
      if (!merged.status && result.status) merged.status = result.status;
      if (!merged.destination && result.destination) merged.destination = result.destination;
      if (!merged.estimatedArrival && result.estimatedArrival) merged.estimatedArrival = result.estimatedArrival;
      if (!merged.updateTime && result.updateTime) merged.updateTime = result.updateTime;
      if (!merged.lastUpdateTime && result.lastUpdateTime) merged.lastUpdateTime = result.lastUpdateTime;
    }

    return merged;
  }

  /**
   * 生成网站特定配置
   */
  static generateSiteConfig(url: string): ExtractConfig {
    const siteType = this.detectSiteType(url);
    const strategies = this.getStrategiesForSite(siteType);

    return {
      siteType,
      strategies
    };
  }

  /**
   * 验证选择器有效性
   */
  static validateSelectors(selectors: Partial<ExtractSelectors>): boolean {
    // 基本的选择器语法验证
    const selectorFields = ['status', 'destination', 'estimatedArrival', 'updateTime'];

    for (const field of selectorFields) {
      const selector = selectors[field as keyof ExtractSelectors];
      if (selector && typeof selector === 'string') {
        // 简单的CSS选择器验证
        if (!this.isValidSelector(selector)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 验证单个选择器
   */
  private static isValidSelector(selector: string): boolean {
    try {
      // 基本的CSS选择器验证
      const validPattern = /^[#.]?[\w-]+(\s*[>+~\s]+[#.]?[\w-]+)*(\s*\[[\w-]+([\"']?)[^\"']*\1\])*(\s*:[\w-]+)*$/;
      return validPattern.test(selector);
    } catch {
      return false;
    }
  }
}

export default UniversalShipExtractor;
