// 🔒 使用 puppeteer-extra 和 stealth plugin 隐藏自动化特征
import type { Browser, ElementHandle, Page } from 'puppeteer-core';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

import {
  CACHE_CONFIG,
  COMMON_HEADERS,
  DELAY_CONFIG,
  getRandomDelay,
  getRandomUserAgent,
  getRandomViewportOffset,
  PUPPETEER_LAUNCH_OPTIONS,
  RATE_LIMIT_CONFIG,
} from '@/lib/config/puppeteer-config';
import { logger } from '@/lib/logger';
import {
  EnhancedSelectorEngine,
  type SelectorStrategy,
} from '@/lib/services/enhanced-selector-engine';
import { rateLimiter } from '@/lib/services/rate-limiter';
import { shippingQueryCache } from '@/lib/services/shipping-query-cache';
import { SmartWaitStrategy } from '@/lib/services/smart-wait-strategy';
import type { ExtractSelectors } from '@/lib/types/shipping';
import { sanitizeSelectorInput } from '@/lib/utils/selector-normalizer';

// cSpell:ignore domcontentloaded

// 🔒 使用 Stealth Plugin 隐藏 Puppeteer 特征
puppeteer.use(StealthPlugin());

/**
 * Puppeteer 浏览器自动化服务
 * SOLID-S: 单一职责 - 只负责浏览器自动化和数据提取
 * 使用单例模式管理浏览器实例，提升性能
 *
 * 内存管理:
 * - 空闲5分钟自动关闭浏览器
 * - 监听进程退出信号，优雅关闭
 * - 定时器使用unref()防止阻止进程退出
 */
export class PuppeteerService {
  private static browser: Browser | null = null;
  private static lastUsedTime: number = 0;
  private static cleanupTimer: NodeJS.Timeout | null = null;

  private static readonly SELECTOR_FALLBACKS = {
    searchInput: [
      '#txtKey',
      'input[name="keyword"]',
      'input[name="search"]',
      'input[name="query"]',
      'input[name="tracking"]',
      'input[name="bill"]',
      'input#trackingNo',
      'input[type="search"]',
      'input[type="text"]',
      '.search-input',
      '#search',
      'input[placeholder*="搜索"]',
      'input[placeholder*="查询"]',
      'input[placeholder*="track"]',
      'input[placeholder*="单号"]',
    ],
    searchButton: [
      'button.search-btn',
      'button[type="submit"]',
      'input[type="submit"]',
      '#searchBtn',
      '.query-btn',
      '#btnQuery',
      'button:contains("查询")',
      'button:contains("搜索")',
      'button:contains("Search")',
      '.btn-primary',
      '.search-button',
    ],
    resultContainer: [
      '#shipAIS',
      'table',
      '.tracking-result',
      '.result-container',
      '.result-area',
      '.trace-list',
      '#results',
      '.content',
      '.search-result',
      '.query-result',
      '.data-container',
      'tbody',
      '.list-container',
    ],
  } as const;

  /** 空闲超时时间（毫秒）- 5分钟无使用则自动关闭 */
  private static readonly IDLE_TIMEOUT_MS = 5 * 60 * 1000;

  /** 清理检查间隔（毫秒）- 每分钟检查一次 */
  private static readonly CLEANUP_CHECK_INTERVAL_MS = 60 * 1000;

  private static prepareSelector(selector: string) {
    const trimmed = sanitizeSelectorInput(selector);
    if (!trimmed) {
      return { value: '', isXPath: false };
    }

    const lower = trimmed.toLowerCase();
    if (lower.startsWith('xpath=')) {
      return { value: trimmed.slice(6), isXPath: true };
    }

    if (trimmed.startsWith('//')) {
      return { value: trimmed, isXPath: true };
    }

    return { value: trimmed, isXPath: false };
  }

  /**
   * 动态生成等待元素列表
   * SOLID-O: 开放/封闭原则 - 通过配置扩展，而不是修改代码
   *
   * @param resultContainerSelector 结果容器选择器（来自数据库配置）
   * @returns 等待元素选择器数组
   *
   * 策略：
   * 1. 使用结果容器本身
   * 2. 使用结果容器的直接子元素（> *）
   * 3. 使用结果容器的后代元素（常见的数据容器标签）
   * 4. 通用的表格/列表/数据行选择器
   */
  private static generateDynamicWaitElements(
    resultContainerSelector: string
  ): string[] {
    const trimmed = sanitizeSelectorInput(resultContainerSelector);
    if (!trimmed) {
      // 如果没有配置结果容器，使用通用选择器
      return ['table', 'ul', 'ol', '.result', '.data', '.content'];
    }

    // 检查是否为 XPath
    const isXPath =
      trimmed.startsWith('//') || trimmed.toLowerCase().startsWith('xpath=');

    if (isXPath) {
      // XPath 不支持子元素选择器，只返回容器本身
      return [trimmed];
    }

    // CSS 选择器：生成多层等待策略
    const waitElements: string[] = [
      // 1. 容器本身
      trimmed,

      // 2. 容器的直接子元素
      `${trimmed} > *`,

      // 3. 容器内的常见数据元素（表格行、列表项、数据行）
      `${trimmed} tr`,
      `${trimmed} li`,
      `${trimmed} .item`,
      `${trimmed} .row`,
      `${trimmed} .data`,

      // 4. 容器内的任意后代元素（至少有内容）
      `${trimmed} span`,
      `${trimmed} div`,
    ];

    return waitElements;
  }

  private static async waitForSelector(
    page: Page,
    selector: { value: string; isXPath: boolean },
    timeout = 30000
  ) {
    if (!selector.value) {
      throw new Error('未提供有效的选择器');
    }

    const start = Date.now();
    while (Date.now() - start < timeout) {
      const handle = await this.queryElementHandle(page, selector);
      if (handle) {
        await handle.dispose();
        return;
      }
      await this.delay(250);
    }

    throw new Error(`等待选择器超时: ${selector.value}`);
  }

  private static async queryElementHandle(
    page: Page,
    selector: { value: string; isXPath: boolean }
  ): Promise<ElementHandle<Element> | null> {
    if (!selector.value) {
      return null;
    }

    const frames = page.frames();

    for (const frame of frames) {
      try {
        if (selector.isXPath) {
          const handle = await frame.evaluateHandle(xpath => {
            try {
              const result = document.evaluate(
                xpath,
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
              );
              return result.singleNodeValue;
            } catch {
              return null;
            }
          }, selector.value);

          const element = handle.asElement();
          if (element) {
            return element as ElementHandle<Element>;
          }
          await handle.dispose();
        } else {
          const element = await frame.$(selector.value);
          if (element) {
            return element as ElementHandle<Element>;
          }
        }
      } catch {
        // 可能遇到跨域 iframe，直接忽略
        continue;
      }
    }

    return null;
  }

  /**
   * 启动空闲清理定时器
   * 定期检查浏览器空闲时间，超时则自动关闭
   */
  private static startIdleCleanup(): void {
    // 如果已有定时器，不重复创建
    if (this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      const idleTime = Date.now() - this.lastUsedTime;

      // 超过空闲时间阈值，自动关闭浏览器
      if (idleTime > this.IDLE_TIMEOUT_MS && this.browser) {
        logger.info('puppeteer-service', '浏览器空闲超时，执行自动关闭', {
          idleSeconds: Math.round(idleTime / 1000),
        });
        this.closeBrowser().catch(err => {
          logger.error('puppeteer-service', '自动关闭浏览器失败', err);
        });
      }
    }, this.CLEANUP_CHECK_INTERVAL_MS);

    // 使用unref()防止定时器阻止Node.js进程退出
    this.cleanupTimer.unref();
  }

  /**
   * 停止空闲清理定时器
   */
  private static stopIdleCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * 获取或创建浏览器实例 (单例模式)
   * SOLID-S: 单一职责 - 只负责浏览器生命周期管理
   *
   * 🔒 反检测增强:
   * 1. 使用 puppeteer-extra 和 stealth plugin
   * 2. 使用反检测配置启动浏览器
   * 3. 记录最后使用时间，用于空闲检测
   * 4. 启动空闲清理定时器
   * 5. 使用单例模式，避免重复创建
   */
  static async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      logger.info(
        'puppeteer-service',
        '启动 Puppeteer 浏览器（反检测模式）...'
      );

      // 🔒 使用 puppeteer-extra 和反检测配置启动浏览器
      this.browser = (await puppeteer.launch(
        PUPPETEER_LAUNCH_OPTIONS
      )) as unknown as Browser;

      // 启动空闲清理定时器
      this.startIdleCleanup();

      logger.info(
        'puppeteer-service',
        '✅ Puppeteer 浏览器已启动（反检测模式）'
      );
    }

    // 更新最后使用时间
    this.lastUsedTime = Date.now();

    return this.browser;
  }

  /**
   * 创建页面并配置反检测
   * 🔒 反检测增强:
   * 1. 设置随机 User-Agent
   * 2. 设置通用 Headers
   * 3. 隐藏 webdriver 特征
   * 4. 设置真实的视口大小（添加随机偏移）
   */
  private static async createPage(browser: Browser): Promise<Page> {
    const page = await browser.newPage();

    // 🔒 设置随机 User-Agent
    const userAgent = getRandomUserAgent();
    await page.setUserAgent(userAgent);
    logger.debug('puppeteer-service', `使用 User-Agent: ${userAgent}`);

    // 🔒 设置通用 Headers
    await page.setExtraHTTPHeaders(COMMON_HEADERS);

    // 🔒 隐藏 webdriver 特征（额外保险）
    await page.evaluateOnNewDocument(() => {
      // 删除 navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });

      // 修改 plugins 长度
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // 修改 languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['zh-CN', 'zh', 'en'],
      });

      // 添加 Chrome 对象
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).chrome = {
        runtime: {},
      };

      // 修改 permissions
      const originalQuery = window.navigator.permissions.query;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.navigator.permissions.query = (parameters: any) =>
        parameters.name === 'notifications'
          ? Promise.resolve({
              state: Notification.permission,
            } as PermissionStatus)
          : originalQuery(parameters);
    });

    // 🔒 设置真实的视口大小（添加随机偏移）
    const offset = getRandomViewportOffset();
    const width = 1920 + offset.width;
    const height = 1080 + offset.height;
    await page.setViewport({ width, height });

    return page;
  }

  /**
   * 随机延迟（模拟人类行为）
   * 🔒 使用随机延迟避免被识别为机器人
   */
  private static async randomDelay(min: number, max: number): Promise<void> {
    const delay = getRandomDelay(min, max);
    logger.debug('puppeteer-service', `随机延迟 ${delay}ms`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * 模拟人类打字（随机速度）
   * 🔒 使用人类打字速度避免被识别为机器人
   */
  private static async humanType(
    element: ElementHandle<Element>,
    text: string
  ): Promise<void> {
    for (const char of text) {
      await element.type(char, {
        delay: getRandomDelay(
          DELAY_CONFIG.typingSpeed.min,
          DELAY_CONFIG.typingSpeed.max
        ),
      });
    }
  }

  /**
   * 执行查询操作 - 增强版
   * 🔒 集成反检测配置：随机延迟、人类打字、随机滚动
   * 🔒 集成 Rate Limiting：限制访问频率，避免被封禁
   * 🔒 集成缓存：减少重复查询，提升响应速度
   *
   * @param siteId 站点ID（用于 Rate Limiting 和缓存）
   * @param url 站点URL
   * @param keyword 查询关键词(已转换为大写)
   * @param selectors 选择器配置
   * @param extractSelectors 数据提取选择器
   * @param options 可选配置
   */
  static async queryShipping(
    siteId: string,
    url: string,
    keyword: string,
    selectors: {
      searchInput: string;
      searchButton: string;
      resultContainer: string;
    },
    extractSelectors: ExtractSelectors,
    options?: {
      skipCache?: boolean; // 跳过缓存检查
      skipRateLimit?: boolean; // 跳过 Rate Limiting（仅用于测试）
      cacheTTL?: number; // 自定义缓存过期时间（秒）
    }
  ): Promise<{
    status?: string;
    destination?: string;
    estimatedArrival?: string;
    lastUpdateTime?: string;
  }> {
    // 1. 检查缓存
    if (!options?.skipCache) {
      const cached = await shippingQueryCache.get(siteId, keyword);
      if (cached) {
        logger.info('puppeteer-service', '✅ 缓存命中，直接返回结果', {
          siteId,
          keyword,
        });
        return {
          status: cached.status,
          destination: cached.destination,
          estimatedArrival: cached.estimatedArrival
            ? cached.estimatedArrival.toISOString()
            : undefined,
          lastUpdateTime: cached.lastUpdateTime
            ? cached.lastUpdateTime.toISOString()
            : undefined,
        };
      }
    }

    // 2. Rate Limiting 检查
    if (!options?.skipRateLimit) {
      const rateLimitKey = `shipping-query:site:${siteId}`;
      const rateLimitResult = await rateLimiter.waitForLimit(
        rateLimitKey,
        RATE_LIMIT_CONFIG.default
      );

      logger.info('puppeteer-service', '✅ Rate Limiting 检查通过', {
        siteId,
        remaining: rateLimitResult.remaining,
        resetAt: new Date(rateLimitResult.resetAt * 1000).toISOString(),
      });
    }

    // 3. 执行实际查询
    const browser = await this.getBrowser();
    // 🔒 使用反检测配置创建页面
    const page = await this.createPage(browser);

    try {
      logger.info(
        'puppeteer-service',
        '🔍 开始查询运输信息（反检测模式 + Rate Limiting + 缓存）',
        { siteId, url, keyword },
        {
          selectors,
          extractSelectorKeys: Object.keys(extractSelectors),
        }
      );

      // 设置超时
      page.setDefaultTimeout(30000);

      // 🔒 随机延迟后再访问页面（模拟用户思考时间）
      await this.randomDelay(
        DELAY_CONFIG.afterPageLoad.min,
        DELAY_CONFIG.afterPageLoad.max
      );

      // 访问页面并使用智能等待
      // 使用 networkidle0 确保所有网络请求完成
      logger.info('puppeteer-service', '开始访问页面', { url });
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

      // 调试模式：记录页面标题和 URL
      const pageTitle = await page.title();
      const pageUrl = page.url();
      logger.info('puppeteer-service', '页面导航完成', {
        title: pageTitle,
        url: pageUrl,
      });

      // 🔒 随机滚动页面（模拟用户浏览）
      await page.evaluate(() => {
        window.scrollTo(0, Math.floor(Math.random() * 300));
      });
      await this.randomDelay(
        DELAY_CONFIG.afterScroll.min,
        DELAY_CONFIG.afterScroll.max
      );

      // 使用智能等待策略等待页面完全加载
      const waitResult = await SmartWaitStrategy.waitForDynamicContent(page, {
        timeout: 15000,
        enableNetworkCheck: true,
        enableDOMStability: true,
        waitForElements: ['input', 'table', '.result', '.content'],
      });

      logger.info('puppeteer-service', '页面加载完成', {
        waitMethod: waitResult.method,
        waitDuration: waitResult.duration,
        success: waitResult.success,
      });

      const preparedExtractSelectors = Object.fromEntries(
        Object.entries(extractSelectors).map(([key, value]) => [
          key,
          this.prepareSelector(value as string),
        ])
      ) as Record<keyof ExtractSelectors, { value: string; isXPath: boolean }>;

      const searchInputResult = await this.findElementHandleWithFallback(
        page,
        selectors.searchInput,
        this.SELECTOR_FALLBACKS.searchInput
      );
      const inputHandle = searchInputResult.handle;

      let buttonHandle: ElementHandle<Element> | null = null;
      if (selectors.searchButton?.trim()) {
        try {
          const buttonResult = await this.findElementHandleWithFallback(
            page,
            selectors.searchButton,
            this.SELECTOR_FALLBACKS.searchButton
          );
          buttonHandle = buttonResult.handle;
        } catch {
          buttonHandle = null;
        }
      }

      // 🔒 点击搜索框前延迟（模拟鼠标移动）
      await this.randomDelay(
        DELAY_CONFIG.beforeClick.min,
        DELAY_CONFIG.beforeClick.max
      );

      // 输入查询关键词
      await inputHandle.focus();
      await page.evaluate(el => {
        if (
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement
        ) {
          el.value = '';
        }
      }, inputHandle);

      // 🔒 使用人类打字速度输入
      await this.humanType(inputHandle, keyword);
      logger.info('puppeteer-service', `✅ 已输入查询关键词: ${keyword}`);

      // 🔒 输入后延迟（模拟用户检查输入）
      await this.randomDelay(
        DELAY_CONFIG.afterInput.min,
        DELAY_CONFIG.afterInput.max
      );

      // 执行搜索（点击按钮或按Enter键）
      if (buttonHandle) {
        // 🔒 点击前延迟
        await this.randomDelay(
          DELAY_CONFIG.beforeClick.min,
          DELAY_CONFIG.beforeClick.max
        );
        await buttonHandle.click();
        logger.info('puppeteer-service', '✅ 已点击搜索按钮');
        await buttonHandle.dispose();
      } else {
        // 如果没有搜索按钮，按Enter键
        await inputHandle.press('Enter');
        logger.info('puppeteer-service', '✅ 已按Enter键搜索');
      }
      await inputHandle.dispose();

      // 等待结果出现 - 使用智能等待策略
      let waitSuccess = false;
      try {
        const resultWaitResult = await this.ensureSelectorWithFallbackEnhanced(
          page,
          selectors.resultContainer,
          this.SELECTOR_FALLBACKS.resultContainer,
          15000
        );
        logger.info('puppeteer-service', '✅ 结果容器等待完成', {
          method: resultWaitResult.method,
          duration: resultWaitResult.duration,
        });
        waitSuccess = true;

        // 🔒 结果加载后延迟（模拟用户阅读）
        await this.randomDelay(
          DELAY_CONFIG.afterResultLoad.min,
          DELAY_CONFIG.afterResultLoad.max
        );
      } catch (error) {
        logger.warn(
          'puppeteer-service',
          '结果容器等待失败，尝试备用方案',
          undefined,
          { error }
        );

        // 备用方案：等待搜索结果链接
        try {
          await page.waitForFunction(
            () => {
              const resultLinks = document.querySelectorAll(
                'a[href*="javascript:void(0)"]'
              );
              return resultLinks.length > 0;
            },
            { timeout: 10000 }
          );
          waitSuccess = true;
        } catch (fallbackError) {
          logger.error(
            'puppeteer-service',
            '所有等待策略都失败，无法找到结果容器',
            undefined,
            {
              error:
                fallbackError instanceof Error
                  ? fallbackError.message
                  : String(fallbackError),
            }
          );
          throw new Error(
            '页面加载超时：无法找到结果容器。请检查选择器配置或网络连接。'
          );
        }
      }

      // 额外等待，确保 JavaScript 完全执行
      if (waitSuccess) {
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 检查页面是否仍然显示 JavaScript 未启用的提示
        const hasJsWarning = await page.evaluate(() =>
          document.body.textContent?.includes(
            "doesn't work properly without JavaScript enabled"
          )
        );

        if (hasJsWarning) {
          logger.warn(
            'puppeteer-service',
            '检测到 JavaScript 未启用警告，但结果容器已出现，继续执行'
          );
        }
      }

      // 智能等待额外内容加载
      // 动态生成等待元素列表，基于结果容器选择器
      const dynamicWaitElements = this.generateDynamicWaitElements(
        selectors.resultContainer
      );

      logger.info('puppeteer-service', '动态生成等待元素', {
        resultContainer: selectors.resultContainer,
        waitElementsCount: dynamicWaitElements.length,
      });

      const contentWaitResult = await SmartWaitStrategy.waitForDynamicContent(
        page,
        {
          timeout: 8000,
          enableDOMStability: true,
          enableElementCheck: true,
          waitForElements: dynamicWaitElements,
        }
      );

      logger.info('puppeteer-service', '内容等待完成', {
        method: contentWaitResult.method,
        duration: contentWaitResult.duration,
      });

      // 智能检测搜索建议列表并点击（适配不同站点的搜索流程）
      const searchSuggestionResult = await page.evaluate(() => {
        // 尝试多种搜索建议选择器（按优先级排序）
        const suggestionSelectors = [
          // ships66.com 的搜索建议
          'ul li.ac_even a, ul li.ac_over a',
          'ul li.ac_even, ul li.ac_over',
          // 通用的自动完成下拉列表
          '.autocomplete-suggestions a',
          '.autocomplete-suggestion a',
          '.search-suggestions a',
          '.search-suggestion a',
          // 通用的搜索结果链接
          'a[href*="javascript:void(0)"]',
          '.search-result a',
          '.result-item a',
        ];

        for (const selector of suggestionSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            return {
              found: true,
              selector,
              text: element.textContent?.trim() || '',
              isLink: element.tagName === 'A',
            };
          }
        }

        return { found: false, selector: '', text: '', isLink: false };
      });

      logger.info('puppeteer-service', '搜索建议检测结果', {
        found: searchSuggestionResult.found,
        selector: searchSuggestionResult.selector,
        text: searchSuggestionResult.text,
      });

      if (searchSuggestionResult.found) {
        logger.info('puppeteer-service', '找到搜索建议，点击进入详情页', {
          selector: searchSuggestionResult.selector,
          text: searchSuggestionResult.text,
        });

        // 点击第一个搜索建议
        const clickSuccess = await page.evaluate((selector: string) => {
          const element = document.querySelector(selector);
          if (element) {
            (element as HTMLElement).click();
            return true;
          }
          return false;
        }, searchSuggestionResult.selector);

        if (!clickSuccess) {
          logger.warn(
            'puppeteer-service',
            '点击搜索建议失败，继续尝试提取数据'
          );
        } else {
          // 等待详情页加载
          logger.info('puppeteer-service', '等待详情页加载');

          // 先等待一小段时间让页面开始加载
          await new Promise(resolve => setTimeout(resolve, 1000));

          // 尝试等待结果容器出现（如果之前没有出现的话）
          try {
            const preparedResultContainer = this.prepareSelector(
              selectors.resultContainer
            );

            if (preparedResultContainer.isXPath) {
              // XPath 选择器，使用 $x
              await page.waitForFunction(
                (xpath: string) => {
                  const result = document.evaluate(
                    xpath,
                    document,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                  );
                  return !!result.singleNodeValue;
                },
                { timeout: 10000 },
                preparedResultContainer.value
              );
            } else {
              // CSS 选择器
              await page.waitForSelector(preparedResultContainer.value, {
                timeout: 10000,
              });
            }

            logger.info('puppeteer-service', '详情页结果容器已出现');
          } catch (error) {
            logger.warn(
              'puppeteer-service',
              '等待详情页结果容器超时，继续尝试提取数据',
              { error: error instanceof Error ? error.message : String(error) }
            );
          }

          // 额外等待确保页面完全加载
          await new Promise(resolve => setTimeout(resolve, 2000));

          logger.info('puppeteer-service', '详情页加载完成');
        }
      } else {
        logger.info('puppeteer-service', '未找到搜索建议，假设已在结果页面');
      }

      // 使用增强选择器���擎提取数据
      const extractStrategies: Record<string, SelectorStrategy[]> = {
        status: [
          {
            type: 'css',
            selector: preparedExtractSelectors.status.value,
            weight: 1.0,
          },
          {
            type: 'xpath',
            selector: preparedExtractSelectors.status.value,
            weight: 0.9,
          },
          {
            type: 'text',
            selector: '状态',
            weight: 0.8,
            options: { partialMatch: true },
          },
          {
            type: 'structure',
            selector: '状态',
            weight: 0.85,
            options: { structureType: 'table' },
          },
        ],
        destination: [
          {
            type: 'css',
            selector: preparedExtractSelectors.destination.value,
            weight: 1.0,
          },
          {
            type: 'xpath',
            selector: preparedExtractSelectors.destination.value,
            weight: 0.9,
          },
          {
            type: 'text',
            selector: '目的地',
            weight: 0.8,
            options: { partialMatch: true },
          },
          {
            type: 'text',
            selector: '港口',
            weight: 0.7,
            options: { partialMatch: true },
          },
          {
            type: 'structure',
            selector: '目的地',
            weight: 0.85,
            options: { structureType: 'table' },
          },
        ],
        estimatedArrival: [
          {
            type: 'css',
            selector: preparedExtractSelectors.estimatedArrival.value,
            weight: 1.0,
          },
          {
            type: 'xpath',
            selector: preparedExtractSelectors.estimatedArrival.value,
            weight: 0.9,
          },
          {
            type: 'text',
            selector: '预到',
            weight: 0.8,
            options: { partialMatch: true },
          },
          {
            type: 'text',
            selector: '预计',
            weight: 0.7,
            options: { partialMatch: true },
          },
          {
            type: 'structure',
            selector: '预到时间',
            weight: 0.85,
            options: { structureType: 'table' },
          },
        ],
        updateTime: [
          {
            type: 'css',
            selector: preparedExtractSelectors.updateTime.value,
            weight: 1.0,
          },
          {
            type: 'xpath',
            selector: preparedExtractSelectors.updateTime.value,
            weight: 0.9,
          },
          {
            type: 'text',
            selector: '更新时间',
            weight: 0.8,
            options: { partialMatch: true },
          },
          {
            type: 'text',
            selector: '更新',
            weight: 0.7,
            options: { partialMatch: true },
          },
          {
            type: 'structure',
            selector: '更新时间',
            weight: 0.85,
            options: { structureType: 'table' },
          },
        ],
      };

      // 准备容器选择器配置
      const preparedResultContainer = this.prepareSelector(
        selectors.resultContainer
      );

      logger.info('puppeteer-service', '开始数据提取', {
        containerSelector: selectors.resultContainer,
        containerIsXPath: preparedResultContainer.isXPath,
      });

      const extractedData = await EnhancedSelectorEngine.batchExtract(
        page,
        extractStrategies,
        {
          timeout: 10000,
          retryCount: 2,
          fallbacks: {
            enableTextMatching: true,
            enableStructureParsing: true,
            enableAttributeSearch: true,
          },
          // ✅ 传递容器选择器配置，限定数据提取范围
          containerSelector: preparedResultContainer.value,
          containerIsXPath: preparedResultContainer.isXPath,
        }
      );

      const result = {
        status: extractedData.status?.value,
        destination: extractedData.destination?.value,
        estimatedArrival: extractedData.estimatedArrival?.value,
        lastUpdateTime: extractedData.updateTime?.value,
      };

      // 记录提取结果
      const extractionSummary = Object.entries(extractedData).map(
        ([key, data]) => ({
          field: key,
          value: data?.value || 'null',
          strategy: data?.strategy || 'none',
          confidence: data?.confidence || 0,
        })
      );

      const totalFields = Object.keys(result).length;
      const successFields = Object.values(result).filter(v => v).length;

      logger.info(
        'puppeteer-service',
        '数据提取完成',
        {
          totalFields,
          successFields,
        },
        { extractionSummary }
      );

      // 4. 保存结果到缓存
      if (!options?.skipCache && (result.status || result.destination)) {
        // 只有当查询成功时才缓存
        const cacheTTL = options?.cacheTTL || CACHE_CONFIG.defaultTTL;

        await shippingQueryCache
          .set(
            siteId,
            keyword,
            {
              status: result.status,
              destination: result.destination,
              estimatedArrival: result.estimatedArrival
                ? new Date(result.estimatedArrival)
                : undefined,
              lastUpdateTime: result.lastUpdateTime
                ? new Date(result.lastUpdateTime)
                : undefined,
            },
            cacheTTL
          )
          .catch(error => {
            // 缓存失败不影响业务
            logger.error('puppeteer-service', '保存缓存失败', error);
          });

        logger.info('puppeteer-service', '✅ 查询结果已缓存', {
          siteId,
          keyword,
          cacheTTL,
        });
      }

      return result;
    } finally {
      await page.close();
    }
  }

  /**
   * 关闭浏览器
   * 优雅关闭：清理定时器、关闭浏览器、重置状态
   */
  static async closeBrowser(): Promise<void> {
    // 停止空闲清理定时器
    this.stopIdleCleanup();

    // 关闭浏览器实例
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        logger.error('puppeteer-service', '关闭浏览器时出错', error);
      } finally {
        this.browser = null;
      }
    }
  }

  private static async delay(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  private static buildCandidateSelectorList(
    primary: string,
    fallback: readonly string[]
  ): string[] {
    const list: string[] = [];
    const add = (value?: string | null) => {
      if (!value) return;
      const trimmed = value.trim();
      if (!trimmed) return;
      if (!list.includes(trimmed)) {
        list.push(trimmed);
      }
    };

    add(primary);
    fallback.forEach(add);

    return list;
  }

  private static async ensureSelectorWithFallback(
    page: Page,
    primarySelector: string,
    fallback: readonly string[],
    timeout = 15000
  ): Promise<void> {
    const candidates = this.buildCandidateSelectorList(
      primarySelector,
      fallback
    );

    const errors: string[] = [];
    for (const candidate of candidates) {
      const prepared = this.prepareSelector(candidate);
      try {
        await this.waitForSelector(page, prepared, timeout);
        return;
      } catch (error) {
        errors.push(
          `${candidate}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    throw new Error(
      `未找到有效的结果容器选择器。尝试的选择器：${candidates.join(
        ', '
      )}。错误详情：${errors.join(' | ')}`
    );
  }

  /**
   * 增强版选择器等待 - 集成智能等待策略
   */
  private static async ensureSelectorWithFallbackEnhanced(
    page: Page,
    primarySelector: string,
    fallback: readonly string[],
    timeout = 15000
  ): Promise<{ method: string; duration: number }> {
    const startTime = Date.now();
    const candidates = this.buildCandidateSelectorList(
      primarySelector,
      fallback
    );

    // 首先尝试使用智能等待策略等待结果容器
    try {
      const smartWaitResult = await SmartWaitStrategy.waitForResultContainer(
        page,
        primarySelector,
        {
          timeout: timeout / 2,
          enableNetworkCheck: true,
          enableDOMStability: true,
        }
      );

      if (smartWaitResult.success) {
        return {
          method: `smart-wait-${smartWaitResult.method}`,
          duration: smartWaitResult.duration,
        };
      }
    } catch (error) {
      logger.warn(
        'puppeteer-service',
        '智能等待失败，使用传统方式',
        undefined,
        { error }
      );
    }

    // 智能等待失败，使用传统方式
    const errors: string[] = [];
    for (const candidate of candidates) {
      const prepared = this.prepareSelector(candidate);
      try {
        await this.waitForSelector(
          page,
          prepared,
          Math.min(timeout / candidates.length, 5000)
        );
        return {
          method: `traditional-selector-${prepared.isXPath ? 'xpath' : 'css'}`,
          duration: Date.now() - startTime,
        };
      } catch (error) {
        errors.push(
          `${candidate}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // 所有选择器都失败，尝试等待通用元素
    try {
      const fallbackResult = await SmartWaitStrategy.waitForDynamicContent(
        page,
        {
          timeout: 5000,
          waitForElements: ['table', '.result', '.content', 'tbody'],
          enableElementCheck: true,
        }
      );

      if (fallbackResult.success) {
        return {
          method: 'generic-element-wait',
          duration: Date.now() - startTime,
        };
      }
    } catch (fallbackError) {
      errors.push(
        `通用元素等待失败: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
      );
    }

    throw new Error(
      `未找到任何有效的结果容器。尝试的选择器：${candidates.join(', ')}。错误详情：${errors.join(' | ')}`
    );
  }

  private static async findElementHandleWithFallback(
    page: Page,
    primarySelector: string,
    fallback: readonly string[],
    timeout = 15000
  ): Promise<{
    handle: ElementHandle<Element>;
    prepared: { value: string; isXPath: boolean };
  }> {
    const candidates = this.buildCandidateSelectorList(
      primarySelector,
      fallback
    );

    const errors: string[] = [];

    for (const candidate of candidates) {
      const prepared = this.prepareSelector(candidate);
      try {
        await this.waitForSelector(page, prepared, timeout);
        const handle = await this.queryElementHandle(page, prepared);
        if (handle) {
          return { handle, prepared };
        }
        errors.push(`未找到元素: ${candidate}`);
      } catch (error) {
        errors.push(
          `${candidate}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    throw new Error(
      `未找到可用的元素选择器。尝试的选择器：${candidates.join(
        ', '
      )}。错误详情：${errors.join(' | ')}`
    );
  }
}

// ==================== 进程退出监听 ====================

/**
 * 全局标记：防止热重载时重复注册监听器
 */
declare global {
  var __puppeteerShutdownRegistered: boolean | undefined;
}

/**
 * 注册进程退出监听器
 * 确保在进程退出时优雅关闭浏览器
 * 使用全局标记防止热重载时重复注册
 */
if (typeof process !== 'undefined' && !global.__puppeteerShutdownRegistered) {
  global.__puppeteerShutdownRegistered = true;

  const gracefulShutdown = async (signal: string): Promise<void> => {
    logger.info('puppeteer-service', '收到进程信号，准备关闭浏览器', {
      signal,
    });
    try {
      await PuppeteerService.closeBrowser();
      logger.info('puppeteer-service', '浏览器已关闭');
    } catch (error) {
      logger.error('puppeteer-service', '关闭浏览器失败', error);
    }
  };

  // 监听进程退出信号
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('beforeExit', () => gracefulShutdown('beforeExit'));
}
