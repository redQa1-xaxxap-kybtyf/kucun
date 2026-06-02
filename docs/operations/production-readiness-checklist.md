# 生产就绪检查清单

本清单用于每次商业交付、试运行上线、正式发版前的人工和脚本化核查。

## 参考基线

- [12-Factor App: Config](https://12factor.net/config): 配置必须与代码分离，通过环境变量管理。
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/): 用作认证、会话、访问控制与安全控制验证基线。
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html): 安全事件日志需要覆盖认证、授权、输入校验、关键业务操作，并能进入监控、告警、报表流程。
- [NIST SP 800-34 Rev. 1](https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final): 备份恢复不是只生成备份文件，还需要定期恢复演练和持续维护。

## 发版前必须通过

```bash
npm run type-check
npm run lint
npm run build
./scripts/check-release-hygiene.sh
./scripts/check-production-readiness.sh .env.production
```

## 生产开关

| 配置项 | 生产要求 | 说明 |
| --- | --- | --- |
| `NODE_ENV` | `production` | 生产模式 |
| `NEXTAUTH_URL` | `https://...` | 对外访问域名 |
| `NEXTAUTH_SECRET` | 强随机值，至少 32 字符 | 不可复用示例值 |
| `STORAGE_ENCRYPTION_KEY` | 强随机值，至少 32 字符 | 七牛等存储配置加密 |
| `ENABLE_DEMO_CLEAR_API` | `false` | 禁止演示清空接口 |
| `ENABLE_TEST_DATA_API` | `false` | 禁止测试数据生成接口 |
| `ENABLE_TEST_DATA_API_PRODUCTION_CONFIRM` | 空 | 禁止生产二次确认被误配置 |
| `RATE_LIMIT_ENABLED` | `true` | 开启 API 速率限制 |
| `ENABLE_MEMORY_MONITOR` | 视监控方案而定 | 开启时必须配置强 `MONITORING_TOKEN` |
| `AUTO_DB_BACKUP_ENABLED` | `true` 或外部备份已落地 | 不能没有备份方案 |
| `DB_BACKUP_RETENTION_DAYS` | 建议不少于 30 | 保留周期按合同/法规调整 |

## 高危接口策略

- `/api/seed-test-data`: 默认 404；必须 `admin + ENABLE_TEST_DATA_API=true`；生产还要设置确认变量。正式生产不得开启。
- `/api/admin/clear-demo-data`: 默认关闭；只允许 admin；需要确认码；正式生产不得开启。
- `/api/monitoring/*`: 必须使用强 token；生产 token 缺失或弱值时返回 404。

## 权限全链路审计

每个 API 路由必须归入以下类别之一：

- Public: 登录、验证码、地址字典、健康检查等明确公开能力。
- Authenticated: 登录用户可访问，仍需服务端按对象归属/业务状态做校验。
- Permissioned: 需要 `withAuth(..., { permissions/anyPermissions/allPermissions })`。
- Admin-only: 系统设置、用户管理、打印模板管理、清空/维护类操作。
- Token-protected: 监控、内部调用、小程序受控公开聚合接口。

审计输出建议使用表格记录：路径、方法、分类、保护机制、对象级权限、审计日志、测试覆盖。

## 关键业务 E2E 验收

上线前至少覆盖：

- 登录、改密、权限不足页面。
- 产品建档、分类、图片、规格。
- 入库、出库、库存调整、盘点。
- 销售订单创建、确认、收款、取消/回滚。
- 退货、退款、往来账单。
- 采购/厂家发货、到货入库、费用/应付。
- 财务月报/利润报表。
- 小程序 catalog 浏览、调货请求、图片访问。

优先运行已有全链路测试：

```bash
npm run test:business-fullchain
npm run test:e2e
```

## 错误监控和日志告警

最低要求：

- 认证失败、权限拒绝、账号禁用、危险接口拒绝调用必须有安全日志。
- 删除、确认、取消、清空、数据维护、金额变更必须有业务审计日志。
- 5xx、数据库连接失败、备份失败、队列失败、Redis 失败必须进入告警通道。
- 日志不得记录密码、token、数据库连接串、加密密钥、完整身份证/手机号等敏感数据。
- 至少每日检查日志和备份状态；正式客户建议接入集中日志或告警平台。
