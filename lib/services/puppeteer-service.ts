import type { Browser, ElementHandle, Page } from 'puppeteer-core';
import type { ExtractSelectors } from '@/lib/types/shipping';
import { sanitizeSelectorInput } from '@/lib/utils/selector-normalizer';

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

  private static async waitForSelector(
    page: Page,
    selector: { value: string; isXPath: boolean },
    timeout = 30000
  ) {
    if (!selector.value) {
      throw new Error('未提供有效的选择器');
    }

    if (selector.isXPath) {
      await page.waitForFunction(
        xpath => {
          const result = document.evaluate(
            xpath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          return Boolean(result.singleNodeValue);
        },
        { timeout },
        selector.value
      );
      return;
    }

    await page.waitForSelector(selector.value, { timeout });
  }

  private static async queryElementHandle(
    page: Page,
    selector: { value: string; isXPath: boolean }
  ): Promise<ElementHandle<Element> | null> {
    if (!selector.value) {
      return null;
    }

    if (selector.isXPath) {
      const handle = await page.evaluateHandle(xpath => {
        const result = document.evaluate(
          xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        return result.singleNodeValue;
      }, selector.value);

      const element = handle.asElement();
      if (element) {
        return element as ElementHandle<Element>;
      }

      await handle.dispose();
      return null;
    }

    return (await page.$(selector.value)) ?? null;
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
        console.log(
          `[Puppeteer] 浏览器空闲超过${this.IDLE_TIMEOUT_MS / 1000}秒，自动关闭`
        );
        this.closeBrowser().catch(err => {
          console.error('[Puppeteer] 自动关闭浏览器失败:', err);
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
   * 优化说明:
   * 1. 记录最后使用时间，用于空闲检测
   * 2. 启动空闲清理定时器
   * 3. 使用单例模式，避免重复创建
   */
  static async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      // 动态导入 puppeteer-core
      const puppeteer = await import('puppeteer-core');

      this.browser = await puppeteer.default.launch({
        // 使用系统安装的Chrome
        executablePath:
          process.env.PUPPETEER_EXECUTABLE_PATH ||
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Windows默认路径
        headless: true, // 无头模式
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security', // 允许跨域
          '--disable-features=IsolateOrigins,site-per-process',
        ],
      });

      // 启动空闲清理定时器
      this.startIdleCleanup();
    }

    // 更新最后使用时间
    this.lastUsedTime = Date.now();

    return this.browser;
  }

  /**
   * 执行查询操作
   * @param url 站点URL
   * @param keyword 查询关键词(已转换为大写)
   * @param selectors 选择器配置
   * @param extractSelectors 数据提取选择器
   */
  static async queryShipping(
    url: string,
    keyword: string,
    selectors: {
      searchInput: string;
      searchButton: string;
      resultContainer: string;
    },
    extractSelectors: ExtractSelectors
  ): Promise<{
    status?: string;
    destination?: string;
    estimatedArrival?: string;
    lastUpdateTime?: string;
  }> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // 设置超时
      page.setDefaultTimeout(30000);

      // 设置视口大小
      await page.setViewport({ width: 1920, height: 1080 });

      // 访问页面
      await page.goto(url, { waitUntil: 'networkidle2' });

      const preparedSearchInput = this.prepareSelector(selectors.searchInput);
      const preparedSearchButton = this.prepareSelector(selectors.searchButton);
      const preparedResultContainer = this.prepareSelector(
        selectors.resultContainer
      );

      const preparedExtractSelectors = Object.fromEntries(
        Object.entries(extractSelectors).map(([key, value]) => [
          key,
          this.prepareSelector(value as string),
        ])
      ) as Record<keyof ExtractSelectors, { value: string; isXPath: boolean }>;

      // 输入查询关键词
      await this.waitForSelector(page, preparedSearchInput);
      const inputHandle = await this.queryElementHandle(
        page,
        preparedSearchInput
      );
      if (!inputHandle) {
        throw new Error('未找到查询输入框，请检查选择器配置');
      }
      await inputHandle.focus();
      await page.evaluate(el => {
        if (
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement
        ) {
          el.value = '';
        }
      }, inputHandle);
      await inputHandle.type(keyword);

      // 点击搜索按钮
      const buttonHandle = await this.queryElementHandle(
        page,
        preparedSearchButton
      );
      if (!buttonHandle) {
        throw new Error('未找到搜索按钮，请检查选择器配置');
      }
      await buttonHandle.click();

      // 等待结果容器出现
      await this.waitForSelector(page, preparedResultContainer, 15000);

      // 等待额外的加载时间(确保动态内容加载完成)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 提取数据
      const result = await page.evaluate(
        (selectors: Record<string, { value: string; isXPath: boolean }>) => {
          const getTextContent = (selector: {
            value: string;
            isXPath: boolean;
          }) => {
            if (!selector?.value) {
              return undefined;
            }

            if (selector.isXPath) {
              const xpathResult = document.evaluate(
                selector.value,
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
              );
              const node = xpathResult.singleNodeValue as
                | HTMLElement
                | SVGElement
                | null;
              return node?.textContent?.trim() || undefined;
            }

            const element = document.querySelector(selector.value);
            return element?.textContent?.trim() || undefined;
          };

          return {
            status: getTextContent(selectors.status),
            destination: getTextContent(selectors.destination),
            estimatedArrival: getTextContent(selectors.estimatedArrival),
            lastUpdateTime: getTextContent(selectors.updateTime),
          };
        },
        preparedExtractSelectors
      );

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
        console.error('[Puppeteer] 关闭浏览器时出错:', error);
      } finally {
        this.browser = null;
      }
    }
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
    console.log(`[Puppeteer] 收到 ${signal} 信号，正在关闭浏览器...`);
    try {
      await PuppeteerService.closeBrowser();
      console.log('[Puppeteer] 浏览器已关闭');
    } catch (error) {
      console.error('[Puppeteer] 关闭浏览器失败:', error);
    }
  };

  // 监听进程退出信号
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('beforeExit', () => gracefulShutdown('beforeExit'));
}
