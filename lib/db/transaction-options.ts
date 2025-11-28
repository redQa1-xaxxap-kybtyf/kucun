/**
 * 数据库事务配置工具
 * 根据数据库类型动态生成Prisma事务选项
 *
 * 背景说明：
 * - Prisma的isolationLevel配置仅对PostgreSQL和MySQL有效
 * - SQLite不支持Prisma的isolationLevel参数配置
 * - SQLite默认使用串行化事务（SERIALIZABLE），通过内部锁机制实现
 * - SQLite使用全局写锁，同一时间只允许一个写事务，天然保证了串行化隔离
 */

/**
 * 支持的数据库类型
 */
export type DatabaseType = 'sqlite' | 'mysql' | 'postgresql' | 'unknown';

/**
 * Prisma事务选项类型
 */
export interface TransactionOptions {
  timeout?: number;
  isolationLevel?: 'Serializable' | 'ReadCommitted';
}

/**
 * 检测当前数据库类型
 *
 * @returns 数据库类型：sqlite | mysql | postgresql | unknown
 */
export function detectDatabaseType(): DatabaseType {
  const dbUrl = process.env.DATABASE_URL || '';

  // SQLite: file:./dev.db 或包含 sqlite 关键字
  if (dbUrl.includes('file:') || dbUrl.includes('sqlite')) {
    return 'sqlite';
  }

  // MySQL: mysql://user:password@host/database
  if (dbUrl.includes('mysql')) {
    return 'mysql';
  }

  // PostgreSQL: postgresql://user:password@host/database
  if (dbUrl.includes('postgres')) {
    return 'postgresql';
  }

  return 'unknown';
}

/**
 * 获取事务选项（根据数据库类型动态配置）
 *
 * SQLite行为说明：
 * - SQLite不支持Prisma的isolationLevel配置参数
 * - SQLite默认就是SERIALIZABLE隔离级别，无需显式配置
 * - SQLite通过全局写锁实现事务串行化：
 *   1. 同一时间只允许一个写事务执行
 *   2. 多个读事务可以并发执行
 *   3. 写事务会阻塞所有其他事务（读和写）
 * - 这种机制确保了完全的事务隔离，防止脏读、不可重复读和幻读
 *
 * MySQL/PostgreSQL行为说明：
 * - 支持多种隔离级别（Read Uncommitted, Read Committed, Repeatable Read, Serializable）
 * - 为避免丢失更新 / 幻读风险，库存、往来账等关键事务统一使用 SERIALIZABLE
 * - 通过更强隔离级别，换取更高的数据一致性和审计可靠性
 *
 * 参考文档:
 * - https://learn.microsoft.com/en-us/sql/relational-databases/sql-server-transaction-locking-and-row-versioning-guide
 * - https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-isolation-levels.html
 * - https://www.percona.com/blog/mysql-performance-implications-of-innodb-isolation-modes/
 *
 * @param timeout - 事务超时时间（毫秒），默认10000ms（10秒）
 * @returns Prisma事务选项对象
 *
 * @example
 * ```typescript
 * // SQLite环境
 * getTransactionOptions(10000)
 * // 返回: { timeout: 10000 }
 *
 * // MySQL/PostgreSQL环境
 * getTransactionOptions(15000)
 * // 返回: { isolationLevel: 'Serializable', timeout: 15000 }
 * ```
 */
export function getTransactionOptions(
  timeout: number = 10000
): TransactionOptions {
  const dbType = detectDatabaseType();

  // SQLite: 仅设置超时，不配置isolationLevel
  // 原因：SQLite不支持此配置，且默认已是SERIALIZABLE级别
  if (dbType === 'sqlite') {
    return { timeout };
  }

  // MySQL和PostgreSQL: 使用 SERIALIZABLE 隔离级别（数据一致性优先）
  //
  // 2025-11 调整：
  // - 原先为 READ COMMITTED（性能优先），在高并发下存在不可重复读 / 幻读 / 丢失更新风险
  // - 为库存、往来账、财务等关键写事务提供更强的隔离保证，统一提升为 SERIALIZABLE
  // - 如需针对部分批量统计/报表降级隔离级别，可在未来按调用点单独定制事务选项
  if (dbType === 'mysql' || dbType === 'postgresql') {
    return {
      isolationLevel: 'Serializable' as const,
      timeout,
    };
  }

  // 未知数据库类型: 保守起见，不设置isolationLevel
  // 避免潜在的配置错误
  return { timeout };
}

/**
 * 快捷方法：获取标准事务选项（10秒超时）
 *
 * @returns 事务选项
 */
export function getStandardTransactionOptions(): TransactionOptions {
  return getTransactionOptions(10000);
}

/**
 * 快捷方法：获取长事务选项（20秒超时）
 * 适用于复杂业务逻辑，如订单创建、库存调整等
 *
 * 2025-10-21紧急修复: 从15秒增至20秒
 * 原因: 入库事务包含多个串行操作(批次号生成+批次规格+入库记录+库存更新)
 * 在高并发下即使使用READ COMMITTED仍可能因锁等待超过15秒
 *
 * @returns 事务选项
 */
export function getLongTransactionOptions(): TransactionOptions {
  return getTransactionOptions(20000); // 从15000增至20000
}

/**
 * 快捷方法：获取短事务选项（5秒超时）
 * 适用于简单快速的数据库操作
 *
 * @returns 事务选项
 */
export function getShortTransactionOptions(): TransactionOptions {
  return getTransactionOptions(5000);
}

/**
 * 快捷方法：获取报表/统计类事务选项
 *
 * 设计目标：
 * - 用于只读或轻量级统计类查询（报表、仪表盘等）
 * - 在 MySQL / PostgreSQL 上显式使用 READ COMMITTED，以降低锁竞争
 * - 不用于库存、订单、往来账等关键写事务
 *
 * 注意：
 * - 调用方应确保只在“读取为主”的报表场景使用
 * - 不建议在任何会执行写操作的事务中使用
 */
export function getReportingTransactionOptions(
  timeout: number = 10000
): TransactionOptions {
  const dbType = detectDatabaseType();

  if (dbType === 'mysql' || dbType === 'postgresql') {
    return {
      isolationLevel: 'ReadCommitted',
      timeout,
    };
  }

  // SQLite / 其他：沿用默认（SQLite 本身接近串行化）
  return { timeout };
}
