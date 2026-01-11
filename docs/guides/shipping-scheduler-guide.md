## 运输查询调度器使用说明

为了确保“运输自动查询”在开发和生产环境都能随应用一起运行，本项目提供了组合启动脚本。按照以下指南操作：

### 1. 依赖前提

- 本机或服务器已安装并启动 Redis（`redis://127.0.0.1:6379` 或自定义地址）。
- `.env` 中的运输查询配置已正确设置（`intervalHours`/`minQueryIntervalHours` 等通过 `lib/env.ts` 校验）。  
  如需避免站点被频繁触发，可以设置 `SHIPPING_QUERY_SITE_COOLDOWN_MS`（默认为 5000ms），用于控制 Worker 在尝试下一个站点前的冷却时间。

### 2. 开发环境

运行：

```bash
npm run dev:with-scheduler
```

该命令会同时启动：

1. `next dev`（含 `NODE_OPTIONS="--max-old-space-size=2048"`）。
2. `npm run scheduler:start`（运输查询调度器 + Worker）。

任一子进程退出或收到 `Ctrl+C`/`SIGTERM`，脚本会优雅地终止所有进程。

### 3. 生产环境

1. 先构建：`npm run build`
2. 启动：`npm run start:with-scheduler`

此命令会串行拉起：

1. `next start`
2. `npm run scheduler:start`

同样支持信号监听，保证两个进程同步退出。

### 4. 单独运行（可选）

若需要单独调试：

- 只启动前端：`npm run dev` / `npm run start`
- 只启动调度器：`npm run scheduler:start`

### 5. 常见问题

| 问题                            | 说明                                                                                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 日志显示 `运输查询调度器已禁用` | 检查 `.env` 中运输调度配置的 `enabled` 是否为 `true`。                                                                                                                                |
| 队列有任务但未处理              | 确认 `scheduler:start` 进程正在运行，并检查 Redis 是否可连。                                                                                                                          |
| 想立即触发一次查询              | 执行 `npx tsx -e "const {getShippingQueryScheduler}=require('./lib/queue/schedulers/shipping-query-scheduler'); getShippingQueryScheduler().triggerManual();"` 或在代码中调用同方法。 |
