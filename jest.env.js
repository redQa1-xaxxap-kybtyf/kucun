/**
 * Jest 运行前置环境变量
 * 在测试框架初始化和任何模块加载之前执行
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const defaultDatabaseUrl =
  'mysql://root:root@localhost:3306/kucun_dev?connection_limit=5&pool_timeout=30&connect_timeout=10';

process.env.DATABASE_URL = process.env.DATABASE_URL || defaultDatabaseUrl;

if (process.env.JEST_LOG_ENV === 'true') {
  // eslint-disable-next-line no-console
  console.log('Jest env DATABASE_URL:', process.env.DATABASE_URL);
}

process.env.NEXTAUTH_SECRET =
  process.env.NEXTAUTH_SECRET ||
  'test-secret-key-for-jest-should-be-longer-than-32-chars-123';
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
