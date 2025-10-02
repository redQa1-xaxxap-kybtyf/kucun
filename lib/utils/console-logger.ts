/**
 * 前端调试日志工具
 * 用于替换 console.log/error/warn,支持环境控制和日志级别
 *
 * 使用场景:
 * - 开发调试信息
 * - 前端错误追踪
 * - 性能监控日志
 *
 * 不使用场景:
 * - 业务操作审计 (使用 lib/logger.ts)
 * - 登录安全日志 (使用 lib/services/login-log-service.ts)
 *
 * 遵循全栈项目统一约定规范
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  showTimestamp: boolean;
  showModule: boolean;
}

/**
 * 前端控制台日志类
 * 自动根据环境变量控制日志输出
 */
class ConsoleLogger {
  private config: LoggerConfig;

  constructor() {
    this.config = {
      // 只在开发环境启用日志
      enabled: process.env.NODE_ENV === 'development',
      // 默认日志级别
      level: 'debug',
      // 显示时间戳
      showTimestamp: true,
      // 显示模块名称
      showModule: true,
    };
  }

  /**
   * 判断是否应该输出日志
   */
  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) {return false;}

    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * 格式化并输出日志消息
   */
  private formatMessage(
    level: LogLevel,
    module: string,
    ...args: unknown[]
  ): void {
    if (!this.shouldLog(level)) {return;}

    const timestamp = this.config.showTimestamp
      ? `[${new Date().toLocaleTimeString()}]`
      : '';
    const moduleTag = this.config.showModule ? `[${module}]` : '';
    const levelTag = `[${level.toUpperCase()}]`;

    const prefix = `${timestamp}${moduleTag}${levelTag}`;

    switch (level) {
      case 'debug':
        // eslint-disable-next-line no-console
        console.log(prefix, ...args);
        break;
      case 'info':
        // eslint-disable-next-line no-console
        console.info(prefix, ...args);
        break;
      case 'warn':
         
        console.warn(prefix, ...args);
        break;
      case 'error':
         
        console.error(prefix, ...args);
        break;
    }
  }

  /**
   * 调试级别日志
   * 用于详细的调试信息
   */
  debug(module: string, ...args: unknown[]): void {
    this.formatMessage('debug', module, ...args);
  }

  /**
   * 信息级别日志
   * 用于一般的信息输出
   */
  info(module: string, ...args: unknown[]): void {
    this.formatMessage('info', module, ...args);
  }

  /**
   * 警告级别日志
   * 用于潜在问题的警告
   */
  warn(module: string, ...args: unknown[]): void {
    this.formatMessage('warn', module, ...args);
  }

  /**
   * 错误级别日志
   * 用于错误信息输出
   */
  error(module: string, ...args: unknown[]): void {
    this.formatMessage('error', module, ...args);
  }

  /**
   * 配置日志器
   * 允许运行时修改配置
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): Readonly<LoggerConfig> {
    return { ...this.config };
  }
}

// 导出单例实例
export const logger = new ConsoleLogger();

// 导出类型供外部使用
export type { LogLevel, LoggerConfig };
