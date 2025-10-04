/**
 * PM2 生产环境配置文件 - 集群模式版本
 * 仅在需要单机多实例横向扩展时使用
 *
 * 注意事项：
 * - 集群模式会导致某些 Next.js 功能失效（如热更新、WebSocket、Server Actions 可能有状态竞争）
 * - 建议优先使用 ecosystem.config.js 的单实例配置 + 负载均衡器
 * - 如果必须使用集群模式，请确保：
 *   1. 使用 Redis 等外部存储管理会话状态
 *   2. WebSocket 使用独立服务或 sticky sessions
 *   3. 文件上传等功能使用外部存储（如 S3）
 */

module.exports = {
  apps: [
    {
      // Next.js 主应用 - 集群模式
      name: 'kucun-app-cluster',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 'max', // 使用所有 CPU 核心
      exec_mode: 'cluster', // 集群模式
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // 集群模式需要的额外配置
        NODE_CLUSTER_SCHED_POLICY: 'rr', // 轮询调度策略
      },
      // 日志配置
      error_file: './logs/app-cluster-err.log',
      out_file: './logs/app-cluster-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // 性能配置
      max_memory_restart: '1G', // 内存超过 1GB 自动重启
      // 自动重启配置
      autorestart: true,
      watch: false, // 生产环境不监听文件变化
      max_restarts: 10, // 最大重启次数
      min_uptime: '10s', // 最小运行时间
      restart_delay: 4000, // 重启延迟 4 秒
      // 环境变量文件
      env_file: '.env.production',
      // 集群特定配置
      instance_var: 'INSTANCE_ID', // 添加实例 ID 环境变量
      // 优雅关闭
      kill_timeout: 5000,
      listen_timeout: 5000,
    },
    {
      // WebSocket 服务 - 必须单实例
      name: 'kucun-ws-cluster',
      script: 'lib/ws/ws-server.ts',
      interpreter: 'node',
      interpreter_args: '--loader ts-node/esm',
      instances: 1, // WebSocket 必须使用单实例
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        WS_PORT: 3002,
      },
      // 日志配置
      error_file: './logs/ws-cluster-err.log',
      out_file: './logs/ws-cluster-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // 性能配置
      max_memory_restart: '500M',
      // 自动重启配置
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      // 环境变量文件
      env_file: '.env.production',
    },
  ],

  // 部署配置 (可选)
  deploy: {
    production: {
      user: 'deploy', // SSH 用户名
      host: 'your-server.com', // 服务器地址
      ref: 'origin/main', // Git 分支
      repo: 'git@github.com:your-repo/kucun.git', // Git 仓库
      path: '/var/www/kucun', // 部署路径
      'post-deploy':
        'npm ci --production && npm run build && pm2 reload ecosystem.cluster.config.js --env production',
      'pre-setup': 'mkdir -p /var/www/kucun',
    },
  },
};
