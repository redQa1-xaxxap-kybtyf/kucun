/**
 * 数据库事务选项工具测试
 * 验证不同数据库类型的事务配置正确性
 */

import {
  detectDatabaseType,
  getLongTransactionOptions,
  getShortTransactionOptions,
  getStandardTransactionOptions,
  getTransactionOptions,
} from './transaction-options';

// 保存原始环境变量
const originalDatabaseUrl = process.env.DATABASE_URL;

describe('数据库事务选项工具', () => {
  afterEach(() => {
    // 恢复原始环境变量
    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  describe('detectDatabaseType', () => {
    it('应该正确检测 SQLite', () => {
      process.env.DATABASE_URL = 'file:./dev.db';
      expect(detectDatabaseType()).toBe('sqlite');

      process.env.DATABASE_URL = 'file:./data/production.db';
      expect(detectDatabaseType()).toBe('sqlite');

      process.env.DATABASE_URL = 'sqlite://./test.db';
      expect(detectDatabaseType()).toBe('sqlite');
    });

    it('应该正确检测 MySQL', () => {
      process.env.DATABASE_URL = 'mysql://user:password@localhost:3306/mydb';
      expect(detectDatabaseType()).toBe('mysql');

      process.env.DATABASE_URL = 'mysql://root@127.0.0.1/test';
      expect(detectDatabaseType()).toBe('mysql');
    });

    it('应该正确检测 PostgreSQL', () => {
      process.env.DATABASE_URL =
        'postgresql://user:password@localhost:5432/mydb';
      expect(detectDatabaseType()).toBe('postgresql');

      process.env.DATABASE_URL = 'postgres://user@localhost/test';
      expect(detectDatabaseType()).toBe('postgresql');
    });

    it('未知数据库类型应返回 unknown', () => {
      process.env.DATABASE_URL = 'mongodb://localhost:27017/mydb';
      expect(detectDatabaseType()).toBe('unknown');

      process.env.DATABASE_URL = '';
      expect(detectDatabaseType()).toBe('unknown');

      delete process.env.DATABASE_URL;
      expect(detectDatabaseType()).toBe('unknown');
    });
  });

  describe('getTransactionOptions', () => {
    it('SQLite 应只返回 timeout，不包含 isolationLevel', () => {
      process.env.DATABASE_URL = 'file:./dev.db';
      const options = getTransactionOptions(10000);

      expect(options).toEqual({ timeout: 10000 });
      expect(options.isolationLevel).toBeUndefined();
    });

    it('MySQL 应返回 Serializable 隔离级别和超时', () => {
      process.env.DATABASE_URL = 'mysql://user:password@localhost:3306/mydb';
      const options = getTransactionOptions(15000);

      expect(options).toEqual({
        isolationLevel: 'Serializable',
        timeout: 15000,
      });
    });

    it('PostgreSQL 应返回 Serializable 隔离级别和超时', () => {
      process.env.DATABASE_URL =
        'postgresql://user:password@localhost:5432/mydb';
      const options = getTransactionOptions(20000);

      expect(options).toEqual({
        isolationLevel: 'Serializable',
        timeout: 20000,
      });
    });

    it('未知数据库应只返回 timeout', () => {
      process.env.DATABASE_URL = 'unknown://localhost/test';
      const options = getTransactionOptions(8000);

      expect(options).toEqual({ timeout: 8000 });
      expect(options.isolationLevel).toBeUndefined();
    });

    it('应使用默认超时时间 10000ms', () => {
      process.env.DATABASE_URL = 'file:./dev.db';
      const options = getTransactionOptions();

      expect(options.timeout).toBe(10000);
    });
  });

  describe('快捷方法', () => {
    beforeEach(() => {
      process.env.DATABASE_URL = 'mysql://user@localhost/test';
    });

    it('getStandardTransactionOptions 应返回 10 秒超时', () => {
      const options = getStandardTransactionOptions();
      expect(options.timeout).toBe(10000);
      expect(options.isolationLevel).toBe('Serializable');
    });

    it('getLongTransactionOptions 应返回 20 秒超时', () => {
      const options = getLongTransactionOptions();
      expect(options.timeout).toBe(20000);
      expect(options.isolationLevel).toBe('Serializable');
    });

    it('getShortTransactionOptions 应返回 5 秒超时', () => {
      const options = getShortTransactionOptions();
      expect(options.timeout).toBe(5000);
      expect(options.isolationLevel).toBe('Serializable');
    });
  });

  describe('真实场景测试', () => {
    it('SQLite 环境下的事务配置应与 Prisma 兼容', () => {
      process.env.DATABASE_URL = 'file:./dev.db';
      const options = getStandardTransactionOptions();

      // SQLite 不应包含 isolationLevel
      // Prisma 在 SQLite 中会忽略此选项，但最好不传递
      expect(options.isolationLevel).toBeUndefined();
      expect(options.timeout).toBe(10000);
    });

    it('MySQL 环境下的事务配置应包含 Serializable 隔离级别', () => {
      process.env.DATABASE_URL = 'mysql://root@localhost:3306/kucun';
      const options = getLongTransactionOptions();

      // MySQL 支持 isolationLevel 配置
      expect(options.isolationLevel).toBe('Serializable');
      expect(options.timeout).toBe(20000);
    });

    it('PostgreSQL 环境下的事务配置应包含 Serializable 隔离级别', () => {
      process.env.DATABASE_URL = 'postgresql://admin@localhost:5432/inventory';
      const options = getShortTransactionOptions();

      // PostgreSQL 支持 isolationLevel 配置
      expect(options.isolationLevel).toBe('Serializable');
      expect(options.timeout).toBe(5000);
    });
  });

  describe('边界情况', () => {
    it('应正确处理包含特殊字符的数据库 URL', () => {
      process.env.DATABASE_URL = 'mysql://user:p@ssw0rd!@localhost:3306/my-db';
      expect(detectDatabaseType()).toBe('mysql');
    });

    it('应正确处理相对路径的 SQLite URL', () => {
      process.env.DATABASE_URL = 'file:../data/test.db';
      expect(detectDatabaseType()).toBe('sqlite');
    });

    it('应正确处理绝对路径的 SQLite URL', () => {
      process.env.DATABASE_URL = 'file:/var/lib/sqlite/production.db';
      expect(detectDatabaseType()).toBe('sqlite');
    });

    it('应处理大小写变体', () => {
      process.env.DATABASE_URL = 'MySQL://localhost/test';
      // 注意：实际检测是小写，所以这个会返回 unknown
      // 如果需要支持大小写，可以在 detectDatabaseType 中添加 toLowerCase()
      expect(detectDatabaseType()).toBe('unknown');
    });
  });
});

/**
 * 集成测试说明
 *
 * 在真实项目中使用时的验证步骤：
 *
 * 1. SQLite 测试（当前环境）
 *    DATABASE_URL=file:./dev.db
 *    - 事务应成功执行
 *    - 不应出现 isolationLevel 相关错误
 *    - 事务默认串行化，保证数据一致性
 *
  * 2. MySQL 测试（生产环境）
  *    DATABASE_URL=mysql://user:password@host/database
  *    - 事务应使用 Serializable 隔离级别
  *    - 并发事务应正确隔离
  *    - 应防止脏读、不可重复读、幻读
 *
  * 3. PostgreSQL 测试（备选环境）
  *    DATABASE_URL=postgresql://user:password@host/database
  *    - 事务应使用 Serializable 隔离级别
  *    - MVCC 机制应正常工作
  *    - 高并发场景下性能良好
 *
 * 4. 性能测试
 *    - SQLite: 单机高吞吐（受限于全局写锁）
 *    - MySQL: 适合中等并发
 *    - PostgreSQL: 适合高并发场景
 */
