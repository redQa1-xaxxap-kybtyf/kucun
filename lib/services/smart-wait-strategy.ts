/**
 * 智能等待策略
 * SOLID-S: 单一职责 - 负责动态内容检测和智能等待
 * DRY: 统一的等待逻辑和条件判断
 *
 * 功能特性:
 * - 网络请求完成检测
 * - DOM稳定性监控
 * - 元素可见性检测
 * - 动态内容加载等待
 * - 智能超时调整
 */

import type { Page } from 'puppeteer-core';

import { logger } from '@/lib/logger';

export interface WaitOptions {
  timeout?: number;
  checkInterval?: number;
  networkIdleTimeout?: number;
  domStabilityTimeout?: number;
  waitForElements?: string[];
  enableNetworkCheck?: boolean;
  enableDOMStability?: boolean;
  enableElementCheck?: boolean;
}

export interface WaitResult {
  success: boolean;
  method: string;
  duration: number;
  details?: unknown;
}

/**
 * 智能等待策略类
 */
export class SmartWaitStrategy {
  private static readonly DEFAULT_TIMEOUT = 30000;
  private static readonly DEFAULT_CHECK_INTERVAL = 500;
  private static readonly DEFAULT_NETWORK_IDLE_TIMEOUT = 5000;
  private static readonly DEFAULT_DOM_STABILITY_TIMEOUT = 3000;

  /**
   * 等待动态内容加载完成
   */
  static async waitForDynamicContent(
    page: Page,
    options: WaitOptions = {}
  ): Promise<WaitResult> {
    const startTime = Date.now();
    const config = this.mergeWithDefaults(options);

    const { waitForElements, ...logSafeConfig } = config;
    logger.info(
      'smart-wait',
      '开始智能等待',
      {
        timeout: logSafeConfig.timeout,
        checkInterval: logSafeConfig.checkInterval,
        networkIdleTimeout: logSafeConfig.networkIdleTimeout,
        domStabilityTimeout: logSafeConfig.domStabilityTimeout,
        enableNetworkCheck: logSafeConfig.enableNetworkCheck,
        enableDOMStability: logSafeConfig.enableDOMStability,
        enableElementCheck: logSafeConfig.enableElementCheck,
      },
      waitForElements.length > 0 ? { waitForElements } : undefined
    );

    try {
      // 策略1: 等待网络空闲
      if (config.enableNetworkCheck) {
        const networkResult = await this.waitForNetworkIdle(page, config);
        if (networkResult.success) {
          return this.createSuccessResult(
            'network-idle',
            startTime,
            networkResult
          );
        }
      }

      // 策略2: 等待DOM稳定
      if (config.enableDOMStability) {
        const domResult = await this.waitForDOMStability(page, config);
        if (domResult.success) {
          return this.createSuccessResult(
            'dom-stability',
            startTime,
            domResult
          );
        }
      }

      // 策略3: 等待特定元素
      if (config.enableElementCheck && config.waitForElements?.length) {
        const elementResult = await this.waitForElements(page, config);
        if (elementResult.success) {
          return this.createSuccessResult(
            'element-visible',
            startTime,
            elementResult
          );
        }
      }

      // 策略4: 智能内容检测
      const contentResult = await this.waitForContentReady(page, config);
      if (contentResult.success) {
        return this.createSuccessResult(
          'content-ready',
          startTime,
          contentResult
        );
      }

      // 所有策略都失败，但等待时间在合理范围内
      if (Date.now() - startTime < config.timeout) {
        logger.info('smart-wait', '等待超时但返回基本成功', {
          duration: Date.now() - startTime,
        });
        return this.createSuccessResult('timeout-passed', startTime);
      }

      return this.createFailureResult('all-strategies-failed', startTime);
    } catch (error) {
      logger.error('smart-wait', '智能等待失败', error);
      return this.createFailureResult('error', startTime, error);
    }
  }

  /**
   * 等待网络空闲
   */
  private static async waitForNetworkIdle(
    page: Page,
    config: Required<WaitOptions>
  ): Promise<WaitResult> {
    const startTime = Date.now();

    try {
      await page.waitForNetworkIdle({
        timeout: config.networkIdleTimeout,
      });

      return {
        success: true,
        method: 'network-idle',
        duration: Date.now() - startTime,
      };
    } catch (error) {
      logger.warn('smart-wait', '网络空闲等待失败', undefined, {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        method: 'network-idle',
        duration: Date.now() - startTime,
        details: error,
      };
    }
  }

  /**
   * 等待DOM稳定
   */
  private static async waitForDOMStability(
    page: Page,
    config: Required<WaitOptions>
  ): Promise<WaitResult> {
    const startTime = Date.now();
    let lastDOMState = 0;
    let stableCount = 0;
    const requiredStableCount = 3; // 连续3次检查都认为稳定

    return new Promise(resolve => {
      const checkInterval = setInterval(async () => {
        try {
          const currentDOMState = await page.evaluate(
            () =>
              document.documentElement.outerHTML.length +
              document.querySelectorAll('*').length
          );

          if (currentDOMState === lastDOMState) {
            stableCount++;
            if (stableCount >= requiredStableCount) {
              clearInterval(checkInterval);
              resolve({
                success: true,
                method: 'dom-stability',
                duration: Date.now() - startTime,
                details: { stableChecks: stableCount },
              });
              return;
            }
          } else {
            stableCount = 0;
            lastDOMState = currentDOMState;
          }

          // 检查超时
          if (Date.now() - startTime > config.domStabilityTimeout) {
            clearInterval(checkInterval);
            resolve({
              success: false,
              method: 'dom-stability',
              duration: Date.now() - startTime,
              details: { reason: 'timeout' },
            });
          }
        } catch (error) {
          clearInterval(checkInterval);
          resolve({
            success: false,
            method: 'dom-stability',
            duration: Date.now() - startTime,
            details: error,
          });
        }
      }, config.checkInterval);
    });
  }

  /**
   * 等待特定元素出现
   */
  private static async waitForElements(
    page: Page,
    config: Required<WaitOptions>
  ): Promise<WaitResult> {
    const startTime = Date.now();

    try {
      for (const selector of config.waitForElements) {
        try {
          await page.waitForSelector(selector, {
            timeout: Math.min(
              5000,
              config.timeout / config.waitForElements.length
            ),
            visible: true,
          });

          return {
            success: true,
            method: 'element-visible',
            duration: Date.now() - startTime,
            details: { selector },
          };
        } catch {
          // 继续尝试下一个选择器
          continue;
        }
      }

      return {
        success: false,
        method: 'element-visible',
        duration: Date.now() - startTime,
        details: { reason: 'no-elements-found' },
      };
    } catch (error) {
      return {
        success: false,
        method: 'element-visible',
        duration: Date.now() - startTime,
        details: error,
      };
    }
  }

  /**
   * 智能内容检测
   */
  private static async waitForContentReady(
    page: Page,
    _config: Required<WaitOptions>
  ): Promise<WaitResult> {
    const startTime = Date.now();

    try {
      const contentAnalysis = await page.evaluate(() => {
        const body = document.body;
        const textContent = body?.textContent?.trim() || '';
        const textLength = textContent.length;

        const elementCount = document.querySelectorAll('*').length;
        const hasLoadingIndicators =
          document.querySelectorAll(
            '.loading, .spinner, .loader, [class*="loading"]'
          ).length > 0;
        const hasDynamicElements =
          document.querySelectorAll(
            '[data-loading], [data-ajax], .dynamic, .async'
          ).length > 0;
        const hasTables =
          document.querySelectorAll('table tbody tr').length > 0;
        const hasLists =
          document.querySelectorAll('ul li, ol li, dl dd').length > 0;
        const hasCards =
          document.querySelectorAll('.card, .item, .result').length > 0;

        if (!body) {
          return {
            hasContent: false,
            reason: 'no-body',
            hasLoadingIndicators,
            hasDynamicElements,
            hasTables,
            hasLists,
            hasCards,
            textLength,
            elementCount,
          };
        }

        if (textLength < 10) {
          return {
            hasContent: false,
            reason: 'insufficient-text',
            hasLoadingIndicators,
            hasDynamicElements,
            hasTables,
            hasLists,
            hasCards,
            textLength,
            elementCount,
          };
        }

        return {
          hasContent: true,
          hasLoadingIndicators,
          hasDynamicElements,
          hasTables,
          hasLists,
          hasCards,
          textLength,
          elementCount,
        };
      });

      // 如果页面正在加载中，继续等待
      if (
        contentAnalysis.hasLoadingIndicators ||
        contentAnalysis.hasDynamicElements
      ) {
        await this.delay(2000); // 额外等待2秒

        // 重新检查
        const recheck = await page.evaluate(() => {
          const hasLoadingIndicators =
            document.querySelectorAll(
              '.loading, .spinner, .loader, [class*="loading"]'
            ).length > 0;
          return { hasLoadingIndicators };
        });

        if (!recheck.hasLoadingIndicators) {
          return {
            success: true,
            method: 'content-ready',
            duration: Date.now() - startTime,
            details: { ...contentAnalysis, rechecked: true },
          };
        }
      }

      // 检查是否有结构化内容
      if (
        contentAnalysis.hasTables ||
        contentAnalysis.hasLists ||
        contentAnalysis.hasCards
      ) {
        return {
          success: true,
          method: 'content-ready',
          duration: Date.now() - startTime,
          details: contentAnalysis,
        };
      }

      // 基本内容检查通过
      if (contentAnalysis.hasContent && contentAnalysis.textLength > 50) {
        return {
          success: true,
          method: 'content-ready',
          duration: Date.now() - startTime,
          details: contentAnalysis,
        };
      }

      return {
        success: false,
        method: 'content-ready',
        duration: Date.now() - startTime,
        details: { ...contentAnalysis, reason: 'insufficient-content' },
      };
    } catch (error) {
      return {
        success: false,
        method: 'content-ready',
        duration: Date.now() - startTime,
        details: error,
      };
    }
  }

  /**
   * 等待页面完全加载
   */
  static async waitForPageLoad(
    page: Page,
    options: WaitOptions = {}
  ): Promise<WaitResult> {
    const startTime = Date.now();
    const config = this.mergeWithDefaults(options);

    try {
      // 等待页面文档完成加载
      await page.waitForFunction(() => document.readyState === 'complete', {
        timeout: config.timeout,
      });

      // 然后应用智能等待策略
      const smartResult = await this.waitForDynamicContent(page, config);

      return {
        success: true,
        method: 'page-load',
        duration: Date.now() - startTime,
        details: { smartWait: smartResult },
      };
    } catch (error) {
      return {
        success: false,
        method: 'page-load',
        duration: Date.now() - startTime,
        details: error,
      };
    }
  }

  /**
   * 等待特定条件满足
   */
  static async waitForCondition(
    page: Page,
    condition: () => Promise<boolean>,
    options: WaitOptions = {}
  ): Promise<WaitResult> {
    const startTime = Date.now();
    const config = this.mergeWithDefaults(options);

    return new Promise(resolve => {
      const checkInterval = setInterval(async () => {
        try {
          const result = await condition();
          if (result) {
            clearInterval(checkInterval);
            resolve({
              success: true,
              method: 'condition-met',
              duration: Date.now() - startTime,
            });
            return;
          }

          // 检查超时
          if (Date.now() - startTime > config.timeout) {
            clearInterval(checkInterval);
            resolve({
              success: false,
              method: 'condition-met',
              duration: Date.now() - startTime,
              details: { reason: 'timeout' },
            });
          }
        } catch (error) {
          clearInterval(checkInterval);
          resolve({
            success: false,
            method: 'condition-met',
            duration: Date.now() - startTime,
            details: error,
          });
        }
      }, config.checkInterval);
    });
  }

  /**
   * 等待并检测结果容器
   */
  static async waitForResultContainer(
    page: Page,
    containerSelector: string,
    options: WaitOptions = {}
  ): Promise<WaitResult> {
    const startTime = Date.now();
    const config = this.mergeWithDefaults(options);

    try {
      // 首先等待容器出现
      await page.waitForSelector(containerSelector, {
        timeout: config.timeout,
        visible: true,
      });

      // 然后等待容器内的内容加载
      const contentReady = await this.waitForCondition(
        page,
        () =>
          page.evaluate(selector => {
            const container = document.querySelector(selector);
            if (!container) return false;

            const textContent = container.textContent?.trim() || '';
            const hasChildren = container.children.length > 0;

            // 检查是否有实际内容或子元素
            return textContent.length > 5 || hasChildren;
          }, containerSelector),
        { timeout: 10000 }
      );

      return {
        success: true,
        method: 'result-container',
        duration: Date.now() - startTime,
        details: { containerSelector, contentReady },
      };
    } catch (error) {
      return {
        success: false,
        method: 'result-container',
        duration: Date.now() - startTime,
        details: { containerSelector, error },
      };
    }
  }

  /**
   * 合并默认配置
   */
  private static mergeWithDefaults(
    options: WaitOptions
  ): Required<WaitOptions> {
    return {
      timeout: options.timeout || this.DEFAULT_TIMEOUT,
      checkInterval: options.checkInterval || this.DEFAULT_CHECK_INTERVAL,
      networkIdleTimeout:
        options.networkIdleTimeout || this.DEFAULT_NETWORK_IDLE_TIMEOUT,
      domStabilityTimeout:
        options.domStabilityTimeout || this.DEFAULT_DOM_STABILITY_TIMEOUT,
      waitForElements: options.waitForElements || [],
      enableNetworkCheck: options.enableNetworkCheck !== false,
      enableDOMStability: options.enableDOMStability !== false,
      enableElementCheck: options.enableElementCheck !== false,
    };
  }

  /**
   * 创建成功结果
   */
  private static createSuccessResult(
    method: string,
    startTime: number,
    details?: unknown
  ): WaitResult {
    return {
      success: true,
      method,
      duration: Date.now() - startTime,
      details,
    };
  }

  /**
   * 创建失败结果
   */
  private static createFailureResult(
    method: string,
    startTime: number,
    details?: unknown
  ): WaitResult {
    return {
      success: false,
      method,
      duration: Date.now() - startTime,
      details,
    };
  }

  /**
   * 延迟函数
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
