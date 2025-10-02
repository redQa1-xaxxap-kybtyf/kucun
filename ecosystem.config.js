/**
 * PM2 生产环境配置文件
 * 用于管理 Next.js 应用和 WebSocket 服务
 */

module.exports = {
  apps: [
    {
      // Next.js 主应用
      name: 'kucun-app',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 'max', // 使用所有 CPU 核心
      exec_mode: 'cluster', // 集群模式
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // 日志配置
      error_file: './logs/app-err.log',
      out_file: './logs/app-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // 性能配置
      max_memory_restart: '1G', // 内存超过 1GB 自动重启
      // 自动重启配置
      autorestart: true,
      watch: false, // 生产环境不监听文件变化
      max_restarts: 10, // 最大重启次数
      min_uptime: '10s', // 最小运行时间
      // 环境变量文件
      env_file: '.env.production',
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
        WS_PORT: 3002,
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

