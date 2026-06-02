# 数据备份与恢复演练

## 目标

备份恢复的验收标准不是“备份脚本跑过”，而是“可以在隔离数据库中成功恢复，并证明关键表、迁移和业务数据可用”。本流程参考 [NIST SP 800-34 Rev. 1](https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final) 对备份、恢复、演练和持续维护的要求。

## 备份

生产服务器定时执行：

```bash
./scripts/backup-db.sh
```

要求：

- 备份目录由 `DB_BACKUP_DIR` 控制。
- 保留周期由 `DB_BACKUP_RETENTION_DAYS` 控制。
- 备份文件必须存放到服务器外的安全位置，例如对象存储、NAS 或异地机器。
- 备份任务失败必须告警。

## 恢复演练

准备一个一次性恢复演练库，名称必须能看出不是生产库，例如 `kucun_restore_drill`。

```bash
DRILL_DATABASE_URL="mysql://user:pass@127.0.0.1:3306/kucun_restore_drill" \
  ./scripts/restore-db-drill.sh backups/kucun_20260522_010000.sql.gz
```

演练脚本会：

- 拒绝看起来像 `prod` 或 `production` 的数据库 URL。
- 删除并重建演练数据库。
- 导入 `.sql` 或 `.sql.gz` 备份。
- 检查恢复后存在表。

## 人工验收

恢复后继续检查：

```bash
DRILL_DATABASE_URL="mysql://user:pass@127.0.0.1:3306/kucun_restore_drill" \
  mysql "$DRILL_DATABASE_URL" -e "SHOW TABLES;"
```

至少抽查：

- 用户表存在且管理员账号可识别。
- 产品、库存、订单、财务往来表有合理数据量。
- 最新迁移已包含在线上库结构中。
- 随机抽 1 个销售订单、1 个入库批次、1 个往来账单核对金额。

## 演练频率

- 商业试运行：每次上线前演练一次。
- 正式客户：至少每月演练一次。
- 大版本升级、数据库迁移、清理脚本上线前必须额外演练。

## 记录模板

| 日期 | 备份文件 | 恢复库 | 表数量 | 抽查结果 | RTO | RPO | 负责人 | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05-22 | `kucun_*.sql.gz` | `kucun_restore_drill` | 0 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 |
