## 调度器使用说明

为了确保“运输自动查询”和“运维维护任务”在开发和生产环境都能随应用一起运行，本项目提供了统一调度器。当前 `kucun-scheduler` 负责：

1. 运输自动查询
2. 日志自动清理
3. 数据库自动备份

按照以下指南操作：

### 1. 依赖前提

- 本机或服务器已安装并启动 Redis（`redis://127.0.0.1:6379` 或自定义地址）。
- `.env` 中的运输查询配置已正确设置（`intervalHours`/`minQueryIntervalHours` 等通过 `lib/env.ts` 校验）。  
  如需避免站点被频繁触发，可以设置 `SHIPPING_QUERY_SITE_COOLDOWN_MS`（默认为 5000ms），用于控制 Worker 在尝试下一个站点前的冷却时间。
- 如果开启自动数据库备份，服务器需已安装 `mysqldump`，并保证当前用户对备份目录有写权限。

### 2. 开发环境

运行：

```bash
npm run dev:with-scheduler
```

该命令会同时启动：

1. `next dev`（含 `NODE_OPTIONS="--max-old-space-size=2048"`）。
2. `npm run scheduler:start`（运输查询调度器 + 运维维护调度器 + Worker）。

任一子进程退出或收到 `Ctrl+C`/`SIGTERM`，脚本会优雅地终止所有进程。

### 3. 生产环境

1. 先构建：`npm run build`
2. 启动：`npm run start:with-scheduler`
3. 若使用 PM2，直接执行：`pm2 start ecosystem.config.js --env production`

此命令会串行拉起：

1. `next start`
2. `npm run scheduler:start`

同样支持信号监听，保证两个进程同步退出。

PM2 模式下建议重点检查：

- `pm2 status`
- `pm2 logs kucun-scheduler`

### 4. 单独运行（可选）

若需要单独调试：

- 只启动前端：`npm run dev` / `npm run start`
- 只启动调度器：`npm run scheduler:start`
- 只手动执行一次运维维护：`npm run maintenance:run`
- 强制执行一次数据库备份：`npm run maintenance:run -- --force-backup`

### 5. 常见问题

| 问题                            | 说明                                                                                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 日志显示 `运输查询调度器已禁用` | 检查 `.env` 中运输调度配置的 `enabled` 是否为 `true`。                                                                                                                                |
| 队列有任务但未处理              | 确认 `scheduler:start` 进程正在运行，并检查 Redis 是否可连。                                                                                                                          |
| 数据库备份失败                  | 先检查服务器是否已安装 `mysqldump`，再确认 `DATABASE_URL`、`DB_BACKUP_DIR` 和目录写权限是否正确。                                                                                     |
| 想立即触发一次查询              | 执行 `npx tsx -e "const {getShippingQueryScheduler}=require('./lib/queue/schedulers/shipping-query-scheduler'); getShippingQueryScheduler().triggerManual();"` 或在代码中调用同方法。 |
| 想立即验证日志清理和备份        | 执行 `npm run maintenance:run`，如需忽略备份间隔直接生成一份备份，可执行 `npm run maintenance:run -- --force-backup`。                                                                |
