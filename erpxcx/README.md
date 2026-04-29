# ERP 小程序

这是瓷砖 ERP 的微信小程序项目，当前第一批实现客户侧“花色货架”。

## 当前功能

- 首页按花色/系列找产品。
- 同一花色内切换罗马柱、转角石、线条、外墙砖、配套。
- 产品组详情页。
- 产品详情页。
- 产品组/产品/首页分享与转发。
- 管理员登录页占位。

## 数据来源

小程序不维护第二套产品库，当前直接读取 ERP 后端接口：

- `/api/miniprogram/catalog`
- `/api/miniprogram/groups/:id`
- `/api/miniprogram/products/:id`

这些接口基于现有 ERP 的 `Product`、`Category`、`ProductVariant`、`Inventory` 生成前台展示数据。

## 开发配置

接口地址在 `utils/config.js`：

```js
apiBaseUrl: 'http://localhost:3000';
```

本地调试步骤：

1. 在 ERP 根目录启动后端：`npm run dev`
2. 用微信开发者工具导入 `erpxcx` 目录。
3. 本地开发阶段可关闭“校验合法域名”。
4. 上线前将 `apiBaseUrl` 改为 ERP 的 HTTPS 域名，并配置小程序 request 合法域名。

## 下一批开发

- 管理员登录接入 `/api/auth/mini-login`。
- 管理端库存查询。
- 管理端产品新增/编辑/下架。
- 产品删除前校验库存和业务单据。
- 销售单创建。
- 收款登记。
