# 库存管理小程序

## 📱 项目简介

这是一个基于微信小程序开发的库存管理系统，提供产品管理、分类管理、库存查询等功能。

### 主要功能

- ✅ 用户认证（登录/退出）
- ✅ 产品列表和详情查看
- ✅ 产品搜索和筛选
- ✅ 分类浏览
- ✅ 库存查询和筛选
- ✅ 用户个人中心

## 🚀 快速开始

### 前置要求

1. **微信开发者工具**
   - 下载地址: https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html

2. **后端服务**
   - Node.js 版本: >= 18.0.0
   - 后端项目位置: `E:/kucun`

### 启动步骤

#### 1. 启动后端服务

```bash
cd E:/kucun
npm install  # 首次运行需要安装依赖
npm run dev  # 启动后端服务（运行在 localhost:3000）
```

#### 2. 打开小程序项目

1. 打开微信开发者工具
2. 选择"导入项目"
3. 项目目录选择: `E:\kucun\kucunxcx`
4. AppID: 使用已配置的 AppID 或选择"测试号"

#### 3. 配置开发环境

**重要**: 在微信开发者工具中进行以下设置：

1. 点击右上角"详情"按钮
2. 选择"本地设置"标签
3. ✅ **勾选"不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书"**

这样才能在开发环境访问本地的 HTTP 接口。

#### 4. 编译运行

- 点击"编译"按钮
- 小程序会自动加载登录页面

### 测试账号

- **用户名**: `testuser`
- **密码**: `test123456`

## 📂 项目结构

```
kucunxcx/
├── miniprogram/              # 小程序源码目录
│   ├── pages/               # 页面
│   │   ├── auth/           # 认证相关页面
│   │   │   └── login/      # 登录页
│   │   ├── index/          # 首页
│   │   ├── products/       # 产品相关页面
│   │   │   ├── list/       # 产品列表
│   │   │   └── detail/     # 产品详情
│   │   ├── categories/     # 分类相关页面
│   │   │   └── list/       # 分类列表
│   │   ├── inventory/      # 库存相关页面
│   │   │   └── list/       # 库存列表
│   │   └── user/           # 用户相关页面
│   │       └── profile/    # 个人中心
│   ├── services/           # API服务层
│   │   ├── auth.service.ts       # 认证服务
│   │   ├── product.service.ts    # 产品服务
│   │   ├── category.service.ts   # 分类服务
│   │   └── inventory.service.ts  # 库存服务
│   ├── utils/              # 工具函数
│   │   └── request.ts      # 网络请求封装
│   ├── types/              # TypeScript类型定义
│   │   ├── auth.d.ts       # 认证类型
│   │   ├── product.d.ts    # 产品类型
│   │   ├── category.d.ts   # 分类类型
│   │   └── inventory.d.ts  # 库存类型
│   ├── config/             # 配置文件
│   │   └── api.ts          # API配置
│   ├── components/         # 自定义组件
│   ├── app.ts              # 小程序入口
│   ├── app.json            # 小程序配置
│   └── app.wxss            # 全局样式
├── project.config.json     # 项目配置
├── README.md              # 项目说明
├── 本地开发配置指南.md    # 本地开发配置详细说明
└── 小程序API接入完成报告.md  # API接入报告
```

## 🔧 配置说明

### API配置 (miniprogram/config/api.ts)

```typescript
const ENV = {
  development: {
    baseURL: 'http://localhost:3000/api', // 开发环境
    timeout: 30000,
  },
  production: {
    baseURL: 'https://your-domain.com/api', // 生产环境（需要HTTPS）
    timeout: 30000,
  },
};
```

### 项目配置 (project.config.json)

- `urlCheck: false` - 允许访问HTTP本地接口（仅开发环境）
- `miniprogramRoot: "miniprogram/"` - 小程序源码目录

## 📡 API端点

| 功能     | 端点                   | 方法 |
| -------- | ---------------------- | ---- |
| 登录     | `/api/auth/mini-login` | POST |
| 产品列表 | `/api/products`        | GET  |
| 产品详情 | `/api/products/:id`    | GET  |
| 分类列表 | `/api/categories`      | GET  |
| 库存列表 | `/api/inventory`       | GET  |

## 🎨 技术栈

- **开发语言**: TypeScript
- **UI框架**: Vant Weapp
- **状态管理**: 微信小程序原生
- **网络请求**: wx.request 封装
- **认证方式**: Bearer Token

## 📝 开发规范

### 代码风格

- 使用 TypeScript 严格类型检查
- 遵循 ESLint 规范
- 使用 2 空格缩进
- 文件名使用 kebab-case

### 命名规范

- 页面文件: `page-name/page-name.ts`
- 组件文件: `component-name/component-name.ts`
- 服务文件: `service-name.service.ts`
- 类型文件: `type-name.d.ts`

### Git提交规范

- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具相关

## 🐛 常见问题

### 1. 无法访问本地接口

**问题**: 提示"request:fail url not in domain list"

**解决**:

1. 确认已在开发者工具中关闭域名校验
2. 确认 `project.config.json` 中 `urlCheck` 为 `false`

### 2. 登录失败

**问题**: 显示"网络连接失败"

**解决**:

1. 确认后端服务已启动: `npm run dev`
2. 浏览器访问 `http://localhost:3000/api/products` 确认后端正常
3. 检查用户名密码: testuser/test123456

### 3. 页面一直加载

**问题**: 页面显示loading但不显示数据

**解决**:

1. 查看微信开发者工具的控制台(Console)标签
2. 查看Network标签检查请求状态
3. 确认Token是否正确保存

### 4. 真机调试无法访问

**问题**: 在真机上无法访问接口

**解决**:

1. 手机和电脑必须在同一局域网
2. 使用本机IP地址替代localhost
3. 修改 `config/api.ts` 中的 baseURL:
   ```typescript
   baseURL: 'http://192.168.1.100:3000/api'; // 替换为实际IP
   ```

## 📚 文档

- [本地开发配置指南](./本地开发配置指南.md) - 详细的本地开发配置说明
- [API接入完成报告](./小程序API接入完成报告.md) - API接入工作报告
- [认证功能实现报告](./认证功能实现报告.md) - 认证功能实现说明

## 🚧 待实现功能

- [ ] 库存详情页
- [ ] 产品收藏功能
- [ ] 浏览历史记录
- [ ] 帮助中心
- [ ] 用户设置页面

## 📄 许可证

MIT License

## 👥 联系方式

如有问题，请联系项目维护者。
