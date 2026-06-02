# 错误监控与日志告警

## 目标

按照 [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)，应用日志应覆盖安全事件，并能被监控、告警和报表流程消费。商业环境至少要做到：故障有人知道，安全拒绝有证据，危险操作可追溯。

## 当前项目入口

- 系统日志：`/api/logs`
- 内存监控：`/api/monitoring/memory`
- Redis 监控：`/api/monitoring/redis`
- 健康检查：`/api/health`
- 运维维护：`npm run maintenance:run`

## 生产配置

| 配置项 | 要求 |
| --- | --- |
| `LOG_LEVEL` | `warn` 或 `info`，排障窗口可临时 `debug` |
| `LOG_RETENTION_DAYS` | 按合同/法规配置，默认建议 180 |
| `ENABLE_MEMORY_MONITOR` | 若启用，必须配置强 `MONITORING_TOKEN` |
| `MONITORING_TOKEN` | 至少 32 字符，不得使用默认值 |
| `RATE_LIMIT_ENABLED` | 必须为 `true` |

## 必须告警的事件

- API 5xx 持续出现。
- 登录失败异常增多、账号锁定、禁用账号访问。
- 权限拒绝集中出现。
- 数据维护、清空、测试数据接口被调用或被拒绝调用。
- 数据库备份失败、恢复演练失败。
- Redis 不可用、队列失败、调度器停止。
- 库存/财务一致性检查失败。

## 日志禁止项

不得记录：

- 密码、token、session、验证码。
- `DATABASE_URL`、`NEXTAUTH_SECRET`、`STORAGE_ENCRYPTION_KEY`。
- 完整身份证、手机号、银行卡等敏感个人信息。
- 大量原始请求体或导入文件内容。

## 巡检动作

每日：

```bash
npm run prod:check
npm run maintenance:run -- --force-checks
```

每次发版后：

```bash
curl -fsS "$NEXTAUTH_URL/api/health"
curl -fsS -H "Authorization: Bearer $MONITORING_TOKEN" "$NEXTAUTH_URL/api/monitoring/memory"
curl -fsS -H "Authorization: Bearer $MONITORING_TOKEN" "$NEXTAUTH_URL/api/monitoring/redis"
```

正式客户建议接入集中日志/告警平台，并把以上事件映射到短信、电话、企业微信或钉钉告警。
