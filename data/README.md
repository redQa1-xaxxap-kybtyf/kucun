# GeoLite2 IP 数据库目录

本目录用于存储 MaxMind GeoLite2 IP 地理位置数据库。

## 快速开始

### 方案1: 使用 MaxMind 官方数据库（推荐）

1. **注册 MaxMind 账号**
   - 访问: https://www.maxmind.com/en/geolite2/signup
   - 免费注册账号

2. **生成 License Key**
   - 登录后访问: https://www.maxmind.com/en/accounts/current/license-key
   - 点击 "Generate new license key"
   - 保存你的 License Key

3. **设置环境变量**

   ```bash
   # Windows (PowerShell)
   $env:MAXMIND_LICENSE_KEY="your_license_key_here"

   # Windows (CMD)
   set MAXMIND_LICENSE_KEY=your_license_key_here

   # Linux/Mac
   export MAXMIND_LICENSE_KEY=your_license_key_here
   ```

4. **下载数据库**
   ```bash
   npm run download-geoip
   ```

### 方案2: 使用开源镜像（备用方案）

如果不想注册 MaxMind 账号，可以使用第三方开源镜像：

1. **从 GitHub 下载**
   - 访问: https://github.com/P3TERX/GeoLite.mmdb/releases
   - 下载最新的 `GeoLite2-City.mmdb` 文件

2. **放置到本目录**
   ```
   data/
   └── GeoLite2-City.mmdb
   ```

## 数据库更新

GeoLite2 数据库**每周二更新一次**，建议定期更新以获得最准确的 IP 定位数据。

```bash
# 手动更新
npm run download-geoip

# 可以设置定时任务自动更新（可选）
# Windows: 任务计划程序
# Linux: crontab
0 0 * * 2 cd /path/to/project && npm run download-geoip
```

## 文件结构

```
data/
├── README.md              # 本说明文件
├── GeoLite2-City.mmdb    # IP 城市数据库（约 70MB）
└── .gitignore            # 忽略数据库文件
```

## 常见问题

### Q: 数据库文件有多大？

A: 约 70MB，建议不要提交到 Git 仓库。

### Q: 定位准确度如何？

A:

- 国家级别: 99.8% 准确
- 城市级别: 约 80% 准确
- 内网 IP: 无法定位

### Q: 是否支持 IPv6？

A: 是的，GeoLite2-City 同时支持 IPv4 和 IPv6。

### Q: 如何验证数据库是否正常工作？

A: 启动项目后，查看系统日志页面，IP 地址旁会显示地理位置信息。

## 许可证

GeoLite2 数据库由 MaxMind 提供，使用前请阅读其许可条款：
https://www.maxmind.com/en/geolite2/eula

## 相关链接

- MaxMind 官网: https://www.maxmind.com
- GeoLite2 数据库: https://dev.maxmind.com/geoip/geolite2-free-geolocation-data
- 开源镜像: https://github.com/P3TERX/GeoLite.mmdb
