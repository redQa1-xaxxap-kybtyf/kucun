/**
 * Error Reporting Service
 * 统一的错误上报服务
 *
 * SOLID-S: 单一职责 - 只负责错误上报
 * YAGNI: 先实现基础功能，后续可扩展集成 Sentry
 *
 * 使用场景：
 * - 错误边界组件捕获的错误
 * - 全局未捕获的错误
 * - 关键业务逻辑错误
 *
 * 设计理念：
 * - 提供统一的错误上报接口
 * - 支持多种上报目标（日志、Sentry、自定义端点）
 * - 收集丰富的错误上下文信息
 * - 失败时不影响主业务流程
 */

type AppLogger = {
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
};

let cachedLogger: AppLogger | null = null;

async function getAppLogger(): Promise<AppLogger> {
  if (cachedLogger) {
    return cachedLogger;
  }

  if (typeof window === 'undefined') {
    try {
      const loggerModule = await import('@/lib/logger');
      cachedLogger = loggerModule.logger;
      return cachedLogger;
    } catch (error) {
      const consoleLogger =
        typeof globalThis !== 'undefined' ? globalThis.console : undefined;
      consoleLogger?.error?.(
        '[error-reporting] Failed to load server logger',
        error
      );
    }
  }

  const consoleRef =
    typeof globalThis !== 'undefined' ? globalThis.console : undefined;

  cachedLogger = {
    error: (...args: unknown[]) =>
      consoleRef?.error?.('[error-reporting]', ...args),
    warn: (...args: unknown[]) =>
      consoleRef?.warn?.('[error-reporting]', ...args),
    info: (...args: unknown[]) =>
      consoleRef?.info?.('[error-reporting]', ...args),
  };

  return cachedLogger;
}

/**
 * 错误严重程度
 */
export enum ErrorSeverity {
  /** 致命错误 - 导致应用崩溃或核心功能不可用 */
  FATAL = 'fatal',
  /** 错误 - 功能失败但应用可继续运行 */
  ERROR = 'error',
  /** 警告 - 潜在问题但不影响功能 */
  WARNING = 'warning',
  /** 信息 - 记录重要事件 */
  INFO = 'info',
}

/**
 * 错误上下文信息
 */
export interface ErrorContext {
  /** 用户ID */
  userId?: string;
  /** 用户名 */
  username?: string;
  /** 用户邮箱 */
  userEmail?: string;
  /** 当前路由 */
  route?: string;
  /** 页面标题 */
  pageTitle?: string;
  /** 组件名称 */
  componentName?: string;
  /** 错误摘要ID（Next.js 提供） */
  digest?: string;
  /** 浏览器信息 */
  userAgent?: string;
  /** 额外的自定义数据 */
  extra?: Record<string, unknown>;
  /** 标签（用于分类和过滤） */
  tags?: Record<string, string>;
}

/**
 * 错误上报选项
 */
export interface ErrorReportOptions {
  /** 错误严重程度 */
  severity?: ErrorSeverity;
  /** 错误上下文 */
  context?: ErrorContext;
  /** 是否在开发环境也上报（默认：false） */
  reportInDevelopment?: boolean;
  /** 是否记录到本地日志（默认：true） */
  logLocally?: boolean;
}

/**
 * 错误上报服务
 */
export class ErrorReportingService {
  private static instance: ErrorReportingService;
  private isProduction: boolean;

  private constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): ErrorReportingService {
    if (!ErrorReportingService.instance) {
      ErrorReportingService.instance = new ErrorReportingService();
    }
    return ErrorReportingService.instance;
  }

  /**
   * 上报错误
   *
   * @param error - 错误对象
   * @param options - 上报选项
   */
  public async reportError(
    error: Error,
    options: ErrorReportOptions = {}
  ): Promise<void> {
    const {
      severity = ErrorSeverity.ERROR,
      context = {},
      reportInDevelopment = false,
      logLocally = true,
    } = options;

    // 开发环境默认不上报（除非明确指定）
    if (!this.isProduction && !reportInDevelopment) {
      if (logLocally) {
        await this.logErrorLocally(error, severity, context);
      }
      return;
    }

    try {
      // 1. 记录到本地日志
      if (logLocally) {
        await this.logErrorLocally(error, severity, context);
      }

      // 2. 收集错误信息
      const errorData = this.collectErrorData(error, severity, context);

      // 3. 上报到监控服务
      await this.sendToMonitoring(errorData);

      // 4. 如果是致命错误，发送告警通知
      if (severity === ErrorSeverity.FATAL) {
        await this.sendAlert(errorData);
      }
    } catch (reportError) {
      const logger = await getAppLogger();
      // 错误上报失败不应该影响主业务
      logger.error(
        'error-reporting-service',
        'Failed to report error',
        reportError,
        {
          originalError: error.message,
          originalStack: error.stack,
        }
      );
    }
  }

  /**
   * 记录错误到本地日志
   */
  private async logErrorLocally(
    error: Error,
    severity: ErrorSeverity,
    context: ErrorContext
  ): Promise<void> {
    const logger = await getAppLogger();
    // 构建符合 LogContext 类型的上下文对象
    const logContext = {
      severity: severity as string,
      userId: context.userId,
      userAgent: context.userAgent,
      path: context.route,
      componentName: context.componentName,
      digest: context.digest,
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
    };

    switch (severity) {
      case ErrorSeverity.FATAL:
      case ErrorSeverity.ERROR:
        logger.error('error-boundary', error.message, error, logContext);
        break;
      case ErrorSeverity.WARNING:
        logger.warn('error-boundary', error.message, logContext);
        break;
      case ErrorSeverity.INFO:
        logger.info('error-boundary', error.message, logContext);
        break;
    }
  }

  /**
   * 收集错误数据
   */
  private collectErrorData(
    error: Error,
    severity: ErrorSeverity,
    context: ErrorContext
  ): Record<string, unknown> {
    return {
      // 错误基本信息
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      // 严重程度
      severity,
      // 时间戳
      timestamp: new Date().toISOString(),
      // 环境信息
      environment: {
        nodeEnv: process.env.NODE_ENV,
        platform: typeof window !== 'undefined' ? 'browser' : 'server',
      },
      // 用户上下文
      user: context.userId
        ? {
            id: context.userId,
            username: context.username,
            email: context.userEmail,
          }
        : undefined,
      // 页面上下文
      page: {
        route: context.route,
        title: context.pageTitle,
        component: context.componentName,
      },
      // Next.js 错误摘要
      digest: context.digest,
      // 浏览器信息
      userAgent: context.userAgent,
      // 额外数据
      extra: context.extra,
      // 标签
      tags: context.tags,
    };
  }

  /**
   * 发送到监控服务
   *
   * 当前实现：记录到日志
   * TODO: 集成 Sentry 或其他监控服务
   */
  private async sendToMonitoring(
    errorData: Record<string, unknown>
  ): Promise<void> {
    const logger = await getAppLogger();
    // 当前实现：记录到结构化日志
    // 使用 metadata 参数传递复杂对象
    logger.info(
      'error-monitoring',
      'Error reported to monitoring',
      undefined,
      errorData as Record<string, unknown>
    );

    // TODO: 集成 Sentry
    // if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    //   Sentry.captureException(errorData.error, {
    //     level: this.mapSeverityToSentryLevel(errorData.severity),
    //     user: errorData.user,
    //     tags: errorData.tags,
    //     extra: errorData.extra,
    //   });
    // }

    // TODO: 发送到自定义监控端点
    // if (process.env.ERROR_REPORTING_ENDPOINT) {
    //   await fetch(process.env.ERROR_REPORTING_ENDPOINT, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify(errorData),
    //   });
    // }
  }

  /**
   * 发送告警通知（致命错误）
   *
   * 当前实现：记录到日志
   * TODO: 集成告警系统（邮件、短信、钉钉等）
   */
  private async sendAlert(errorData: Record<string, unknown>): Promise<void> {
    const logger = await getAppLogger();
    // 使用 metadata 参数传递复杂对象
    logger.error(
      'error-alert',
      'FATAL ERROR ALERT',
      undefined,
      undefined,
      errorData as Record<string, unknown>
    );

    // TODO: 发送邮件告警
    // TODO: 发送钉钉/企业微信告警
    // TODO: 发送短信告警（关键人员）
  }

  /**
   * 上报错误边界捕获的错误
   *
   * 便捷方法，专门用于错误边界组件
   */
  public async reportErrorBoundary(
    error: Error & { digest?: string },
    componentName: string,
    additionalContext?: Partial<ErrorContext>
  ): Promise<void> {
    // 获取浏览器信息
    const userAgent =
      typeof window !== 'undefined' ? window.navigator.userAgent : undefined;

    // 获取当前路由
    const route =
      typeof window !== 'undefined' ? window.location.pathname : undefined;

    await this.reportError(error, {
      severity: ErrorSeverity.ERROR,
      context: {
        componentName,
        digest: error.digest,
        route,
        userAgent,
        ...additionalContext,
      },
      logLocally: true,
    });
  }
}

/**
 * 默认的错误上报服务实例
 */
export const errorReportingService = ErrorReportingService.getInstance();

/**
 * 便捷函数：上报错误
 */
export const reportError = (
  error: Error,
  options?: ErrorReportOptions
): Promise<void> => errorReportingService.reportError(error, options);

/**
 * 便捷函数：上报错误边界错误
 */
export const reportErrorBoundary = (
  error: Error & { digest?: string },
  componentName: string,
  additionalContext?: Partial<ErrorContext>
): Promise<void> =>
  errorReportingService.reportErrorBoundary(
    error,
    componentName,
    additionalContext
  );
