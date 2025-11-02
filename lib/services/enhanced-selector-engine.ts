/**
 * 增强选择器引擎
 * SOLID-S: 单一职责 - 负责多策略数据提取
 * DRY: 统一的选择器处理逻辑
 *
 * 功能特性:
 * - 多策略选择器支持 (CSS/XPath/文本/结构)
 * - 智能容错和降级
 * - 高级文本匹配
 * - 结构化数据解析
 */

import type { ElementHandle, Page } from 'puppeteer-core';

import { logger } from '@/lib/logger';
import { sanitizeSelectorInput } from '@/lib/utils/selector-normalizer';

export interface ExtractionConfig {
  strategies: SelectorStrategy[];
  fallbacks: FallbackConfig;
  timeout: number;
  retryCount: number;
  containerSelector?: string; // 可选：限定数据提取的容器范围
  containerIsXPath?: boolean; // 容器选择器是否为 XPath
}

type SelectorPriority =
  | 'id'
  | 'class'
  | 'attribute'
  | 'pseudo'
  | 'tag'
  | 'other';

export interface SelectorStrategy {
  type: 'css' | 'xpath' | 'text' | 'attribute' | 'structure';
  selector: string;
  weight: number; // 优先级权重
  options?: StrategyOptions;
  effectiveWeight?: number;
  priorityHint?: SelectorPriority;
}

export interface StrategyOptions {
  caseSensitive?: boolean;
  partialMatch?: boolean;
  regex?: string;
  attribute?: string;
  textPattern?: string;
  structureType?: 'table' | 'list' | 'card';
}

export interface FallbackConfig {
  enableTextMatching: boolean;
  enableStructureParsing: boolean;
  enableAttributeSearch: boolean;
}

export interface ExtractResult {
  value: string;
  strategy: string;
  confidence: number;
  element?: ElementHandle<Element>;
}

/**
 * 增强选择器引擎
 * 提供多种策略的数据提取能力
 */
export class EnhancedSelectorEngine {
  private static readonly DEFAULT_TIMEOUT = 10000;
  private static readonly DEFAULT_RETRY_COUNT = 3;
  private static readonly CSS_PRIORITY_BOOST: Record<SelectorPriority, number> =
    {
      id: 1.15,
      class: 1.08,
      attribute: 1.02,
      pseudo: 0.9,
      tag: 0.95,
      other: 1,
    };

  /**
   * 使用多策略提取数据
   */
  static async extractWithMultipleStrategies(
    page: Page,
    configs: SelectorStrategy[],
    options: Partial<ExtractionConfig> = {}
  ): Promise<ExtractResult | null> {
    const config: ExtractionConfig = {
      strategies: configs,
      fallbacks: {
        enableTextMatching: true,
        enableStructureParsing: true,
        enableAttributeSearch: true,
        ...options.fallbacks,
      },
      timeout: options.timeout || this.DEFAULT_TIMEOUT,
      retryCount: options.retryCount || this.DEFAULT_RETRY_COUNT,
      // ✅ 传递容器选择器配置
      containerSelector: options.containerSelector,
      containerIsXPath: options.containerIsXPath,
    };

    // 调试日志：记录容器配置
    if (config.containerSelector) {
      logger.info('enhanced-selector', '使用容器范围提取', {
        containerSelector: config.containerSelector,
        containerIsXPath: config.containerIsXPath,
        strategiesCount: configs.length,
      });
    }

    // 根据优先级与具体性优化排序
    const optimizedStrategies = this.optimizeStrategies(config.strategies);
    config.strategies = optimizedStrategies;

    for (const strategy of optimizedStrategies) {
      try {
        const result = await this.executeStrategy(page, strategy, config);
        if (result && result.value.trim()) {
          logger.info('enhanced-selector', '策略提取成功', {
            strategy: strategy.type,
            selector: strategy.selector,
            value: result.value.substring(0, 50),
            confidence: result.confidence,
          });
          return result;
        }
      } catch (error) {
        logger.warn('enhanced-selector', '策略提取失败', {
          strategy: strategy.type,
          selector: strategy.selector,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 如果所有策略都失败，尝试智能降级
    if (
      config.fallbacks.enableTextMatching ||
      config.fallbacks.enableStructureParsing
    ) {
      return await this.intelligentFallback(page, config);
    }

    return null;
  }

  /**
   * 执行单个提取策略
   */
  private static async executeStrategy(
    page: Page,
    strategy: SelectorStrategy,
    config: ExtractionConfig
  ): Promise<ExtractResult | null> {
    switch (strategy.type) {
      case 'css':
        return await this.extractByCSS(page, strategy, config);
      case 'xpath':
        return await this.extractByXPath(page, strategy, config);
      case 'text':
        return await this.extractByText(page, strategy, config);
      case 'attribute':
        return await this.extractByAttribute(page, strategy, config);
      case 'structure':
        return await this.extractByStructure(page, strategy, config);
      default:
        throw new Error(`未知策略类型: ${strategy.type}`);
    }
  }

  private static optimizeStrategies(
    strategies: SelectorStrategy[]
  ): SelectorStrategy[] {
    if (!Array.isArray(strategies) || strategies.length === 0) {
      return [];
    }

    const decorated = strategies.map((strategy, index) => {
      const baseWeight =
        typeof strategy.weight === 'number' ? strategy.weight : 1;
      const optimized: SelectorStrategy = { ...strategy };

      let effectiveWeight = baseWeight;
      let priorityHint: SelectorPriority = 'other';

      if (strategy.type === 'css') {
        const normalizedSelector = sanitizeSelectorInput(strategy.selector);
        priorityHint = this.detectCssPriority(normalizedSelector);
        const priorityBoost = this.getPriorityBoost(priorityHint);
        const specificityPenalty =
          this.calculateSpecificityPenalty(normalizedSelector);
        effectiveWeight = baseWeight * priorityBoost * specificityPenalty;
      } else if (strategy.type === 'attribute') {
        priorityHint = 'attribute';
        effectiveWeight = baseWeight * this.getPriorityBoost(priorityHint);
      } else {
        effectiveWeight = baseWeight;
      }

      optimized.priorityHint = priorityHint;
      optimized.effectiveWeight =
        this.normalizeEffectiveWeight(effectiveWeight);

      return {
        strategy: optimized,
        effectiveWeight: optimized.effectiveWeight ?? baseWeight,
        index,
      };
    });

    decorated.sort((a, b) => {
      if (b.effectiveWeight === a.effectiveWeight) {
        return a.index - b.index;
      }
      return b.effectiveWeight - a.effectiveWeight;
    });

    return decorated.map(item => item.strategy);
  }

  /**
   * CSS选择器提取
   * SOLID-O: 支持在指定容器内提取数据
   */
  private static async extractByCSS(
    page: Page,
    strategy: SelectorStrategy,
    config: ExtractionConfig
  ): Promise<ExtractResult | null> {
    const { selector } = strategy;

    // 处理高级CSS选择器 (如 :contains())
    if (selector.includes(':contains(')) {
      return await this.extractByAdvancedCSS(page, selector);
    }

    // 如果配置了容器选择器，在容器内查找
    if (config.containerSelector) {
      return await this.extractByCSSInContainer(
        page,
        selector,
        config.containerSelector,
        config.containerIsXPath || false,
        strategy
      );
    }

    // 否则在整个页面上查找
    const element = await page.$(selector);
    if (!element) {
      return null;
    }

    const value = await element.evaluate(
      (el: Element) => el.textContent?.trim() || ''
    );
    await element.dispose();

    return {
      value,
      strategy: 'css',
      confidence: this.calculateConfidence(
        value,
        this.resolveEffectiveWeight(strategy)
      ),
    };
  }

  /**
   * 在指定容器内执行 CSS 查询
   */
  private static async extractByCSSInContainer(
    page: Page,
    cssSelector: string,
    containerSelector: string,
    containerIsXPath: boolean,
    strategy: SelectorStrategy
  ): Promise<ExtractResult | null> {
    try {
      // 获取容器元素
      let containerElement: ElementHandle<Element> | null = null;

      if (containerIsXPath) {
        const puppeteerPage = page as Page & {
          $x: (expression: string) => Promise<ElementHandle<Element>[]>;
        };
        const containers = await puppeteerPage.$x(containerSelector);
        containerElement = containers.length > 0 ? containers[0] : null;
      } else {
        containerElement = await page.$(containerSelector);
      }

      if (!containerElement) {
        logger.warn('enhanced-selector', 'CSS容器元素未找到', {
          containerSelector,
          containerIsXPath,
        });
        return null;
      }

      // 在容器元素内执行 CSS 查询
      const element = await containerElement.$(cssSelector);
      if (!element) {
        await containerElement.dispose();
        return null;
      }

      const value = await element.evaluate(
        (el: Element) => el.textContent?.trim() || ''
      );

      await element.dispose();
      await containerElement.dispose();

      if (!value) {
        return null;
      }

      logger.info('enhanced-selector', '容器内 CSS 提取成功', {
        containerSelector,
        cssSelector,
        value: value.substring(0, 50),
      });

      return {
        value,
        strategy: 'css-in-container',
        confidence: this.calculateConfidence(
          value,
          this.resolveEffectiveWeight(strategy)
        ),
      };
    } catch (error) {
      logger.error('enhanced-selector', '容器内 CSS 提取失败', undefined, {
        containerSelector,
        cssSelector,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * XPath选择器提取
   * SOLID-O: 支持在指定容器内提取数据，遵循开放/封闭原则
   */
  private static async extractByXPath(
    page: Page,
    strategy: SelectorStrategy,
    config: ExtractionConfig
  ): Promise<ExtractResult | null> {
    const { selector } = strategy;

    // 如果配置了容器选择器，先获取容器元素
    if (config.containerSelector) {
      return await this.extractByXPathInContainer(
        page,
        selector,
        config.containerSelector,
        config.containerIsXPath || false,
        strategy
      );
    }

    // 否则在整个页面上执行 XPath
    const puppeteerPage = page as Page & {
      $x: (expression: string) => Promise<ElementHandle<Element>[]>;
    };
    const elements = await puppeteerPage.$x(selector);
    if (elements.length === 0) {
      return null;
    }

    const element = elements[0];
    const value = await element.evaluate(
      (el: Element) => el.textContent?.trim() || ''
    );
    await element.dispose();

    return {
      value,
      strategy: 'xpath',
      confidence: this.calculateConfidence(
        value,
        this.resolveEffectiveWeight(strategy)
      ),
    };
  }

  /**
   * 在指定容器内执行 XPath 查询
   * @param page Puppeteer 页面对象
   * @param xpath XPath 选择器
   * @param containerSelector 容器选择器
   * @param containerIsXPath 容器选择器是否为 XPath
   * @param strategy 策略配置
   */
  private static async extractByXPathInContainer(
    page: Page,
    xpath: string,
    containerSelector: string,
    containerIsXPath: boolean,
    strategy: SelectorStrategy
  ): Promise<ExtractResult | null> {
    try {
      // 获取容器元素
      let containerElement: ElementHandle<Element> | null = null;

      if (containerIsXPath) {
        // 容器选择器是 XPath
        const puppeteerPage = page as Page & {
          $x: (expression: string) => Promise<ElementHandle<Element>[]>;
        };
        const containers = await puppeteerPage.$x(containerSelector);
        containerElement = containers.length > 0 ? containers[0] : null;
      } else {
        // 容器选择器是 CSS
        containerElement = await page.$(containerSelector);
      }

      if (!containerElement) {
        logger.warn('enhanced-selector', '容器元素未找到', {
          containerSelector,
          containerIsXPath,
        });
        return null;
      }

      // 在容器元素内执行 XPath 查询
      const value = await containerElement.evaluate(
        (container: Element, xpathSelector: string) => {
          try {
            const result = document.evaluate(
              xpathSelector,
              container, // ✅ 在容器范围内查询
              null,
              XPathResult.FIRST_ORDERED_NODE_TYPE,
              null
            );
            const node = result.singleNodeValue;
            return node?.textContent?.trim() || '';
          } catch (error) {
            console.error('XPath 执行失败:', error);
            return '';
          }
        },
        xpath
      );

      await containerElement.dispose();

      if (!value) {
        return null;
      }

      logger.info('enhanced-selector', '容器内 XPath 提取成功', {
        containerSelector,
        xpath,
        value: value.substring(0, 50),
      });

      return {
        value,
        strategy: 'xpath-in-container',
        confidence: this.calculateConfidence(
          value,
          this.resolveEffectiveWeight(strategy)
        ),
      };
    } catch (error) {
      logger.error('enhanced-selector', '容器内 XPath 提取失败', undefined, {
        containerSelector,
        xpath,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * 文本内容匹配提取
   */
  private static async extractByText(
    page: Page,
    strategy: SelectorStrategy,
    _config: ExtractionConfig
  ): Promise<ExtractResult | null> {
    const { selector, options } = strategy;

    const result = await page.evaluate(
      (payload: { selector: string; options?: StrategyOptions }) => {
        const { selector, options } = payload;

        // 查找包含指定文本的元素
        const elements = Array.from(document.querySelectorAll('*'));
        const targetElements = elements.filter((el: Element) => {
          const text = el.textContent?.trim() || '';
          if (options?.caseSensitive) {
            return options?.partialMatch
              ? text.includes(selector)
              : text === selector;
          } else {
            const lowerText = text.toLowerCase();
            const lowerSelector = selector.toLowerCase();
            return options?.partialMatch
              ? lowerText.includes(lowerSelector)
              : lowerText === lowerSelector;
          }
        });

        if (targetElements.length === 0) {
          return null;
        }

        // 返回第一个匹配元素的文本内容
        return targetElements[0].textContent?.trim() || '';
      },
      { selector, options }
    );

    if (!result) {
      return null;
    }

    return {
      value: result,
      strategy: 'text',
      confidence: this.calculateConfidence(
        result,
        this.resolveEffectiveWeight(strategy) * 0.8
      ), // 文本匹配权重稍低
    };
  }

  /**
   * 属性提取
   */
  private static async extractByAttribute(
    page: Page,
    strategy: SelectorStrategy,
    _config: ExtractionConfig
  ): Promise<ExtractResult | null> {
    const { selector, options } = strategy;
    const attributeName = options?.attribute || 'value';

    const result = await page.evaluate(
      (payload: { selector: string; attributeName: string }) => {
        const { selector, attributeName } = payload;

        // 尝试ID选择器
        let element = document.getElementById(selector);
        if (!element) {
          // 尝试name选择器
          element = document.querySelector(`[name="${selector}"]`);
        }
        if (!element) {
          // 尝试其他属性
          element = document.querySelector(
            `[data-*="${selector}"], [class*="${selector}"], [id*="${selector}"]`
          );
        }

        if (!element) {
          return null;
        }

        return element.getAttribute(attributeName)?.trim() || null;
      },
      { selector, attributeName }
    );

    if (!result) {
      return null;
    }

    return {
      value: result,
      strategy: 'attribute',
      confidence: this.calculateConfidence(
        result,
        this.resolveEffectiveWeight(strategy) * 0.9
      ),
    };
  }

  /**
   * 结构化解析 (表格/列表)
   */
  private static async extractByStructure(
    page: Page,
    strategy: SelectorStrategy,
    _config: ExtractionConfig
  ): Promise<ExtractResult | null> {
    const { selector, options } = strategy;
    const structureType = options?.structureType || 'table';

    if (structureType === 'table') {
      return await this.extractFromTable(page, selector, strategy);
    } else if (structureType === 'list') {
      return await this.extractFromList(page, selector, strategy);
    }

    return null;
  }

  /**
   * 表格数据提取
   */
  private static async extractFromTable(
    page: Page,
    labelSelector: string,
    strategy: SelectorStrategy
  ): Promise<ExtractResult | null> {
    const result = await page.evaluate(labelSelector => {
      // 查找包含标签的表格单元格
      const labelCells = Array.from(document.querySelectorAll('td, th')).filter(
        (cell: Element) => {
          const text = cell.textContent?.trim() || '';
          return text.includes(labelSelector);
        }
      );

      for (const labelCell of labelCells) {
        // 尝试获取同一行的下一个单元格
        const nextCell = labelCell.nextElementSibling;
        if (nextCell && ['TD', 'TH'].includes(nextCell.tagName)) {
          return nextCell.textContent?.trim() || null;
        }

        // 尝试获取同行中的值单元格
        const row = labelCell.parentElement;
        if (row) {
          const valueCells = Array.from(row.children).filter(
            (cell): cell is Element =>
              cell !== labelCell && ['TD', 'TH'].includes(cell.tagName)
          );
          if (valueCells.length > 0) {
            return valueCells[0].textContent?.trim() || null;
          }
        }
      }

      return null;
    }, labelSelector);

    if (!result) {
      return null;
    }

    return {
      value: result,
      strategy: 'table-structure',
      confidence: this.calculateConfidence(
        result,
        this.resolveEffectiveWeight(strategy) * 0.85
      ),
    };
  }

  /**
   * 列表数据提取
   */
  private static async extractFromList(
    page: Page,
    labelSelector: string,
    strategy: SelectorStrategy
  ): Promise<ExtractResult | null> {
    const result = await page.evaluate(labelSelector => {
      // 查找包含标签的列表项
      const listItems = Array.from(
        document.querySelectorAll('li, dt, dd')
      ).filter((item: Element) => {
        const text = item.textContent?.trim() || '';
        return text.includes(labelSelector);
      });

      for (const item of listItems) {
        // 如果是dt，查找对应的dd
        if (item.tagName === 'DT') {
          const nextDD = item.nextElementSibling;
          if (nextDD && nextDD.tagName === 'DD') {
            return nextDD.textContent?.trim() || null;
          }
        }

        // 尝试获取同级元素中的值
        const nextSibling = item.nextElementSibling;
        if (nextSibling) {
          return nextSibling.textContent?.trim() || null;
        }
      }

      return null;
    }, labelSelector);

    if (!result) {
      return null;
    }

    return {
      value: result,
      strategy: 'list-structure',
      confidence: this.calculateConfidence(
        result,
        this.resolveEffectiveWeight(strategy) * 0.8
      ),
    };
  }

  /**
   * 高级CSS选择器处理 (支持 :contains())
   */
  private static async extractByAdvancedCSS(
    page: Page,
    selector: string
  ): Promise<ExtractResult | null> {
    // 解析 :contains() 选择器
    const match = selector.match(
      /^([^:]+):contains\(["']([^"']+)["']\)(?:\s*\+\s*(.+))?$/
    );
    if (!match) {
      return null;
    }

    const [, targetSelector, containsText, siblingSelector] = match;

    const result = await page.evaluate(
      (payload: {
        targetSelector: string;
        containsText: string;
        siblingSelector?: string;
      }) => {
        const { targetSelector, containsText, siblingSelector } = payload;

        const targetElements = Array.from(
          document.querySelectorAll(targetSelector)
        ) as Element[];
        for (const element of targetElements) {
          if (element.textContent?.includes(containsText)) {
            if (siblingSelector) {
              const sibling = element.nextElementSibling;
              if (
                sibling &&
                sibling.matches &&
                sibling.matches(siblingSelector)
              ) {
                return sibling.textContent?.trim() || null;
              }
            } else {
              return element.textContent?.trim() || null;
            }
          }
        }

        return null;
      },
      { targetSelector, containsText, siblingSelector }
    );

    if (!result) {
      return null;
    }

    return {
      value: result,
      strategy: 'advanced-css',
      confidence: this.calculateConfidence(result, 0.9),
    };
  }

  /**
   * 智能降级策略
   */
  private static async intelligentFallback(
    page: Page,
    config: ExtractionConfig
  ): Promise<ExtractResult | null> {
    // 1. 文本匹配降级
    if (config.fallbacks.enableTextMatching) {
      const textResult = await this.fallbackTextMatching(page);
      if (textResult) {
        return textResult;
      }
    }

    // 2. 结构解析降级
    if (config.fallbacks.enableStructureParsing) {
      const structureResult = await this.fallbackStructureParsing(page);
      if (structureResult) {
        return structureResult;
      }
    }

    return null;
  }

  /**
   * 文本匹配降级
   */
  private static async fallbackTextMatching(
    page: Page
  ): Promise<ExtractResult | null> {
    const commonLabels = [
      '状态',
      '位置',
      '目的地',
      '时间',
      '更新',
      '状态',
      'location',
      'status',
      'time',
    ];

    for (const label of commonLabels) {
      const result = await page.evaluate(label => {
        // 查找包含标签的元素
        const elements = Array.from(document.querySelectorAll('*')).filter(
          (el: Element) => {
            const text = el.textContent?.toLowerCase() || '';
            return text.includes(label.toLowerCase());
          }
        );

        // 尝试找到邻近的值元素
        for (const element of elements.slice(0, 10)) {
          // 只检查前10个结果
          const parent = element.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children);
            const currentIndex = siblings.indexOf(element);

            // 检查下一个兄弟元素
            if (currentIndex < siblings.length - 1) {
              const nextSibling = siblings[currentIndex + 1];
              const value = nextSibling.textContent?.trim();
              if (
                value &&
                value.length > 0 &&
                value !== element.textContent?.trim()
              ) {
                return value;
              }
            }
          }
        }

        return null;
      }, label);

      if (result) {
        return {
          value: result,
          strategy: 'fallback-text',
          confidence: 0.6,
        };
      }
    }

    return null;
  }

  /**
   * 结构解析降级
   */
  private static async fallbackStructureParsing(
    page: Page
  ): Promise<ExtractResult | null> {
    const result = await page.evaluate(() => {
      // 查找表格结构
      const tables = document.querySelectorAll('table');
      for (const table of tables) {
        const rows = table.querySelectorAll('tr');
        for (const row of rows) {
          const cells = row.querySelectorAll('td, th');
          if (cells.length >= 2) {
            const firstCell = cells[0].textContent?.trim() || '';
            const secondCell = cells[1].textContent?.trim() || '';

            // 如果第一个单元格看起来像标签，返回第二个单元格的值
            if (firstCell.length < 20 && secondCell.length > 0) {
              return secondCell;
            }
          }
        }
      }

      // 查找列表结构
      const lists = document.querySelectorAll('dl, ul');
      for (const list of lists) {
        const items = list.querySelectorAll('dt, li');
        for (const item of items) {
          const text = item.textContent?.trim() || '';
          if (text.length < 20 && text.length > 0) {
            const nextElement = item.nextElementSibling;
            if (nextElement) {
              const value = nextElement.textContent?.trim();
              if (value && value.length > 0) {
                return value;
              }
            }
          }
        }
      }

      return null;
    });

    if (result) {
      return {
        value: result,
        strategy: 'fallback-structure',
        confidence: 0.5,
      };
    }

    return null;
  }

  private static getPriorityBoost(priority: SelectorPriority): number {
    return this.CSS_PRIORITY_BOOST[priority] ?? 1;
  }

  private static detectCssPriority(selector: string): SelectorPriority {
    const normalized = selector?.trim() ?? '';
    if (!normalized) {
      return 'other';
    }

    const withoutAttributes = this.stripAttributeBlocks(normalized);

    if (/#/u.test(withoutAttributes)) {
      return 'id';
    }

    if (/\.[A-Za-z0-9_-]+/u.test(withoutAttributes)) {
      return 'class';
    }

    if (/\[[^\]]+\]/u.test(normalized)) {
      return 'attribute';
    }

    if (/:([A-Za-z-]+)(\([^)]*\))?/u.test(normalized)) {
      return 'pseudo';
    }

    return withoutAttributes ? 'tag' : 'other';
  }

  private static calculateSpecificityPenalty(selector: string): number {
    const normalized = selector?.trim() ?? '';
    if (!normalized) {
      return 1;
    }

    let penalty = 1;

    const segmentCount = normalized
      .split(/(?<!\\)[>+~\s]+/u)
      .filter(Boolean).length;

    if (segmentCount > 3) {
      penalty *= 0.8;
    } else if (segmentCount > 2) {
      penalty *= 0.88;
    } else if (segmentCount > 1) {
      penalty *= 0.93;
    }

    const idCount = (normalized.match(/#/gu) ?? []).length;
    if (idCount > 1) {
      penalty *= 0.9;
    }

    if (/:nth-|:not\(|:has\(|:only|:first|:last/iu.test(normalized)) {
      penalty *= 0.9;
    }

    if (/\[[^\]]*(\*=|\^=|\$=)/u.test(normalized)) {
      penalty *= 0.95;
    }

    if (normalized.length > 80) {
      penalty *= 0.9;
    }

    return Math.max(penalty, 0.6);
  }

  private static normalizeEffectiveWeight(weight: number): number {
    if (!Number.isFinite(weight)) {
      return 0.1;
    }
    return Math.min(Math.max(weight, 0.05), 1.2);
  }

  private static stripAttributeBlocks(selector: string): string {
    return selector.replace(/\[[^\]]*\]/gu, '');
  }

  private static resolveEffectiveWeight(strategy: SelectorStrategy): number {
    if (typeof strategy.effectiveWeight === 'number') {
      return strategy.effectiveWeight;
    }
    return strategy.weight;
  }

  /**
   * 计算置信度
   */
  private static calculateConfidence(
    value: string,
    baseWeight: number
  ): number {
    if (!value || value.trim().length === 0) {
      return 0;
    }

    let confidence = baseWeight;

    // 根据值的内容质量调整置信度
    const trimmedValue = value.trim();

    // 过短的值置信度较低
    if (trimmedValue.length < 2) {
      confidence *= 0.5;
    }

    // 包含数字或日期的值置信度较高
    if (/\d/.test(trimmedValue)) {
      confidence *= 1.1;
    }

    // 包含常见状态词的值置信度较高
    if (
      /(状态|已|未|进行中|完成|抵达|出发|status|delivered|pending|transit)/i.test(
        trimmedValue
      )
    ) {
      confidence *= 1.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * 批量提取多个字段
   */
  static async batchExtract(
    page: Page,
    fieldConfigs: Record<string, SelectorStrategy[]>,
    options: Partial<ExtractionConfig> = {}
  ): Promise<Record<string, ExtractResult | null>> {
    const results: Record<string, ExtractResult | null> = {};

    const extractPromises = Object.entries(fieldConfigs).map(
      async ([fieldName, strategies]) => {
        const result = await this.extractWithMultipleStrategies(
          page,
          strategies,
          options
        );
        return { fieldName, result };
      }
    );

    const extractResults = await Promise.all(extractPromises);

    for (const { fieldName, result } of extractResults) {
      results[fieldName] = result;
    }

    return results;
  }
}
