# ERP 小程序 uni-app 前端

这个目录只放新的小程序前端。ERP 后端、数据库、库存、销售、收款等主系统代码不在这里改。

## 本地运行

```bash
cd erpxcx-uni
npm install
npm run build:mp-weixin
```

构建成功后，用微信开发者工具导入：

```text
erpxcx-uni/dist/build/mp-weixin
```

默认接口地址是：

```text
http://localhost:3000
```

上线前在 `src/utils/config.js` 里改成 ERP 的 HTTPS 域名，并加入微信小程序 request 合法域名。

## 当前已迁移页面

- 客户首页：花色、品种、产品组
- 产品组详情
- 产品详情
- 管理员登录
- 管理工作台
- 小程序分类管理
- 库存查询
- 产品列表

销售单、收款、产品新增编辑表单还没有迁移到 uni-app。
