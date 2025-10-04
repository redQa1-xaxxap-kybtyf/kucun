/**
 * PM2 生产环境配置文件
 * 用于管理 Next.js 应用和 WebSocket 服务
 *
 * 重要说明：
 * - Next.js 官方推荐使用单实例运行以支持所有功能
 * - 使用 PM2 进程守护确保服务稳定性
 * - 通过 Nginx/负载均衡器实现横向扩展
 * - 所有端口配置从环境变量读取，无硬编码依赖
 */

module.exports = {
  apps: [
    {
      // Next.js 主应用 - 单实例模式
      name: 'kucun-app',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 1, // 使用单实例，避免 Next.js 功能冲突
      exec_mode: 'fork', // fork 模式，支持所有 Next.js 功能
      env: {
        NODE_ENV: 'production',
        // 端口从环境变量读取，默认3000
        PORT: process.env.PORT || 3000,
      },
      // 日志配置
      error_file: './logs/app-err.log',
      out_file: './logs/app-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // 性能配置
      max_memory_restart: '2G', // 提高内存限制到 2GB
      // 自动重启配置
      autorestart: true,
      watch: false, // 生产环境不监听文件变化
      max_restarts: 10, // 最大重启次数
      min_uptime: '10s', // 最小运行时间
      restart_delay: 4000, // 重启延迟 4 秒
      // 环境变量文件
      env_file: '.env.production',
      // 优雅关闭
      kill_timeout: 5000, // 给进程 5 秒时间优雅关闭
      listen_timeout: 5000, // 启动超时时间
      // 进程信号处理
      shutdown_with_message: true,
    },
    {
      // WebSocket 服务
      name: 'kucun-ws',
      script: 'lib/ws/ws-server.ts',
      interpreter: 'node',
      interpreter_args: '--loader ts-node/esm',
      instances: 1, // WebSocket 服务使用单实例
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        // WebSocket端口从环境变量读取，默认3002
        WS_PORT: process.env.WS_PORT || 3002,
        // 允许的Origin从环境变量读取
        WS_ALLOWED_ORIGINS: process.env.WS_ALLOWED_ORIGINS || '',
      },
      // 日志配置
      error_file: './logs/ws-err.log',
      out_file: './logs/ws-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // 性能配置
      max_memory_restart: '500M',
      // 自动重启配置
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
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
        'npm ci --production && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'mkdir -p /var/www/kucun',
    },
  },
};

