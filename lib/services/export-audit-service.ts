/**
 * 导出审计日志服务
 *
 * 职责：
 * - 记录导出操作的详细信息
 * - 支持审计日志查询和统计
 * - 集成SystemLog表
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * 导出审计信息
 */
export interface ExportAuditInfo {
  /** 导出模块 */
  module: 'receivables' | 'payables' | 'factory-shipments' | 'other';
  /** 导出格式 */
  format: 'excel' | 'csv';
  /** 数据量 */
  recordCount: number;
  /** 筛选条件 */
  filters?: Record<string, unknown>;
  /** 用户ID */
  userId: string;
  /** 用户名称 */
  userName?: string;
  /** IP地址 */
  ipAddress?: string;
  /** User-Agent */
  userAgent?: string;
  /** 是否成功 */
  success: boolean;
  /** 错误信息（如果失败） */
  errorMessage?: string;
  /** 文件名 */
  filename?: string;
}

/**
 * 导出审计服务
 */
export class ExportAuditService {
  /**
   * 记录导出操作审计日志
   *
   * @param auditInfo 审计信息
   * @returns 日志ID
   */
  static async logExport(auditInfo: ExportAuditInfo): Promise<string> {
    try {
      const {
        module,
        format,
        recordCount,
        filters,
        userId,
        userName,
        ipAddress,
        userAgent,
        success,
        errorMessage,
        filename,
      } = auditInfo;

      // 构建描述信息
      const description = success
        ? `成功导出${this.getModuleName(module)}数据（${recordCount}条，${format.toUpperCase()}格式）`
        : `导出${this.getModuleName(module)}数据失败：${errorMessage}`;

      // 构建元数据
      const metadata = JSON.stringify({
        module,
        format,
        recordCount,
        filters,
        success,
        errorMessage,
        filename,
        userName,
      });

      // 创建系统日志
      const log = await prisma.systemLog.create({
        data: {
          type: 'export',
          level: success ? 'info' : 'error',
          action: `export_${module}`,
          description,
          userId,
          ipAddress,
          userAgent,
          metadata,
        },
      });

      logger.info('export-audit', '导出审计日志记录成功', {
        logId: log.id,
        module,
        format,
        recordCount,
        userId,
      });

      return log.id;
    } catch (error) {
      logger.error('export-audit', '导出审计日志记录失败', error, {
        module: auditInfo.module,
        userId: auditInfo.userId,
      });
      // 审计失败不应阻断主流程，仅记录错误
      return '';
    }
  }

  /**
   * 获取模块名称
   */
  private static getModuleName(module: ExportAuditInfo['module']): string {
    const moduleNames: Record<ExportAuditInfo['module'], string> = {
      receivables: '应收账款',
      payables: '应付账款',
      'factory-shipments': '厂家发货',
      other: '其他',
    };
    return moduleNames[module] || module;
  }

  /**
   * 获取导出统计信息
   *
   * @param startDate 开始日期
   * @param endDate 结束日期
   * @param module 模块筛选
   * @returns 统计信息
   */
  static async getExportStatistics(
    startDate?: Date,
    endDate?: Date,
    module?: string
  ): Promise<{
    totalExports: number;
    successExports: number;
    failedExports: number;
    totalRecords: number;
    byModule: Record<string, number>;
    byFormat: Record<string, number>;
  }> {
    try {
      // 构建查询条件
      const where: {
        type: string;
        action?: { contains: string };
        createdAt?: { gte?: Date; lte?: Date };
      } = {
        type: 'export',
      };

      if (module) {
        where.action = { contains: `export_${module}` };
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      // 查询所有导出日志
      const logs = await prisma.systemLog.findMany({
        where,
        select: {
          level: true,
          action: true,
          metadata: true,
        },
      });

      // 统计数据
      let totalRecords = 0;
      const byModule: Record<string, number> = {};
      const byFormat: Record<string, number> = {};
      let successExports = 0;
      let failedExports = 0;

      for (const log of logs) {
        // 统计成功失败
        if (log.level === 'info') {
          successExports++;
        } else if (log.level === 'error') {
          failedExports++;
        }

        // 解析metadata
        try {
          const meta = JSON.parse(log.metadata || '{}');
          if (meta.recordCount) {
            totalRecords += meta.recordCount;
          }
          if (meta.module) {
            byModule[meta.module] = (byModule[meta.module] || 0) + 1;
          }
          if (meta.format) {
            byFormat[meta.format] = (byFormat[meta.format] || 0) + 1;
          }
        } catch {
          // 忽略解析错误
        }
      }

      return {
        totalExports: logs.length,
        successExports,
        failedExports,
        totalRecords,
        byModule,
        byFormat,
      };
    } catch (error) {
      logger.error('export-audit', '获取导出统计失败', error);
      return {
        totalExports: 0,
        successExports: 0,
        failedExports: 0,
        totalRecords: 0,
        byModule: {},
        byFormat: {},
      };
    }
  }

  /**
   * 获取最近的导出记录
   *
   * @param userId 用户ID（可选）
   * @param limit 返回数量
   * @returns 导出记录列表
   */
  static async getRecentExports(
    userId?: string,
    limit = 20
  ): Promise<
    Array<{
      id: string;
      module: string;
      format: string;
      recordCount: number;
      success: boolean;
      createdAt: Date;
      userName?: string;
      filename?: string;
    }>
  > {
    try {
      const where: {
        type: string;
        userId?: string;
      } = {
        type: 'export',
      };

      if (userId) {
        where.userId = userId;
      }

      const logs = await prisma.systemLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          action: true,
          level: true,
          metadata: true,
          createdAt: true,
        },
      });

      return logs.map(log => {
        let meta: any = {};
        try {
          meta = JSON.parse(log.metadata || '{}');
        } catch {
          // 忽略解析错误
        }

        return {
          id: log.id,
          module: meta.module || 'unknown',
          format: meta.format || 'unknown',
          recordCount: meta.recordCount || 0,
          success: log.level === 'info',
          createdAt: log.createdAt,
          userName: meta.userName,
          filename: meta.filename,
        };
      });
    } catch (error) {
      logger.error('export-audit', '获取最近导出记录失败', error);
      return [];
    }
  }
}
