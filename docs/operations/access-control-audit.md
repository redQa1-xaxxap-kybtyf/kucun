# 权限全链路审计

## 目标

确保每个入口都有明确的认证、授权、对象级权限和审计日志策略。这里采用 [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) 作为核查基线：ASVS 可作为测试 Web 应用技术安全控制的基础，也可作为安全控制开发清单。

## 生成初始矩阵

```bash
npm run audit:api-auth > .audit-api-auth.csv
```

输出字段：

- `route`: API route 文件。
- `classification`: 脚本基于代码信号的初始分类。
- `signals`: 命中的保护信号，例如 `withAuth`、`requireAdmin`、`permissions`、`monitoring-token`。

脚本只做初筛，不代替人工审计。`review`、`no-wrapper-detected`、公开读接口都必须人工确认。

## 人工审计字段

| 字段 | 说明 |
| --- | --- |
| 路径/方法 | API 路径和 HTTP 方法 |
| 分类 | Public / Authenticated / Permissioned / Admin-only / Token-protected |
| 认证机制 | Session、Bearer、内部密钥、监控 token |
| 角色/权限 | `requireAdmin` 或具体权限 |
| 对象级权限 | 是否校验记录归属、账套模式、业务状态 |
| CSRF/Origin | 写操作是否走 `withAuth` 防护或等价保护 |
| 速率限制 | 登录、写操作、监控接口是否限制 |
| 审计日志 | 成功/失败/拒绝是否记录 |
| 测试覆盖 | 单元、集成、E2E 或手工验收 |

## 高风险入口优先级

1. 数据删除、清空、维护任务。
2. 测试数据生成、演示数据重置。
3. 用户、权限、系统设置、存储密钥配置。
4. 金额、库存、订单状态变更。
5. 文件上传、图片读取、小程序公开接口。
6. 监控、内部调用、WebHook。

## 验收标准

- 所有写接口都有认证与 CSRF/Origin 或非 Cookie token 保护。
- 所有管理接口都有 `requireAdmin` 或等价服务端检查。
- 财务、库存成本、系统设置接口有明确权限。
- 对象级权限不依赖前端隐藏按钮。
- 危险接口默认关闭，生产环境有显式开关检查。
- 审计日志能回答“谁在什么时候对什么资源做了什么，结果如何”。
