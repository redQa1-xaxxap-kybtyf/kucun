# IP 地理位置集成文档

## 概述

本项目已集成 MaxMind GeoLite2 IP 地理位置数据库，可在系统日志中自动显示用户操作的 IP 地址对应的地理位置信息。

## 功能特性

✅ **离线定位** - 使用本地数据库，无需外部 API 调用
✅ **高性能** - 查询速度 < 1ms
✅ **中文优先** - 自动显示中文地名（如有）
✅ **异步非阻塞** - IP 定位失败不影响业务流程
✅ **自动集成** - 日志记录时自动解析 IP 位置
✅ **IPv4/IPv6 双栈支持** - 同时支持 IPv4 和 IPv6

## 快速开始

### 1. 下载 GeoLite2 数据库

#### 方案 A: 官方渠道（推荐）

```bash
# 1. 注册 MaxMind 账号并获取 License Key
# 访问: https://www.maxmind.com/en/geolite2/signup

# 2. 设置环境变量
export MAXMIND_LICENSE_KEY="your_license_key"

# 3. 下载数据库
npm run download-geoip
```

#### 方案 B: 开源镜像（备用）

```bash
# 从 GitHub 下载预编译数据库
# https://github.com/P3TERX/GeoLite.mmdb/releases
# 将 GeoLite2-City.mmdb 放置到 data/ 目录
```

### 2. 测试功能

```bash
npm run test:ip-location
```

预期输出：
```
🧪 开始测试 IP 地理位置功能
================================================================================

📍 测试: Google DNS
   IP: 8.8.8.8
   ✅ 定位成功 (耗时: 0ms)
   国家: 美国
   省份: -
   城市: -
   完整位置: 美国
   格式化 (短): 美国
   格式化 (长): 美国
```

### 3. 启动项目

```bash
npm run dev
```

访问 `/settings/logs` 查看系统日志，IP 地址旁会自动显示地理位置信息。

## 技术架构

### 数据库 Schema

```prisma
model SystemLog {
  // ... 其他字段
  ipAddress   String?  @map("ip_address")
  ipCountry   String?  @map("ip_country")   // 国家
  ipProvince  String?  @map("ip_province")  // 省份/州
  ipCity      String?  @map("ip_city")      // 城市
  ipLocation  String?  @map("ip_location")  // 完整位置 "国家 省份 城市"
}
```

### 核心模块

#### 1. IP 定位服务 (`lib/services/ip-location.ts`)

```typescript
import { getIpLocation } from '@/lib/services/ip-location';

// 获取 IP 地理位置
const location = await getIpLocation('8.8.8.8');

console.log(location);
// {
//   country: '美国',
//   province: null,
//   city: null,
//   latitude: 37.751,
//   longitude: -97.822,
//   fullLocation: '美国'
// }
```

#### 2. 日志记录集成 (`lib/logger.ts`)

```typescript
// 自动集成到所有日志记录函数
await logUserAction(
  'user_login',
  '用户登录',
  userId,
  '8.8.8.8',  // IP 会自动解析为地理位置
  userAgent
);
```

#### 3. 前端显示 (`components/settings/SystemLogsTable.tsx`)

```tsx
<TableCell className="text-sm">
  <div className="space-y-1">
    <div className="font-mono text-xs">192.168.1.1</div>
    <div className="flex items-center gap-1 text-xs">
      <span>📍</span>
      <span>中国 北京市</span>
    </div>
  </div>
</TableCell>
```

## API 使用示例

### 基础用法

```typescript
import { getIpLocation, formatLocation } from '@/lib/services/ip-location';

// 单个 IP 查询
const location = await getIpLocation('223.5.5.5');
if (location) {
  console.log(location.country);    // "中国"
  console.log(location.province);   // "浙江省"
  console.log(location.city);       // "杭州市"
  console.log(location.fullLocation); // "中国 浙江省 杭州市"
}

// 格式化显示
console.log(formatLocation(location, 'short')); // "中国 杭州市"
console.log(formatLocation(location, 'full'));  // "中国 浙江省 杭州市"
```

### 批量查询

```typescript
import { getIpLocations } from '@/lib/services/ip-location';

const ips = ['8.8.8.8', '1.1.1.1', '223.5.5.5'];
const locations = await getIpLocations(ips);

locations.forEach((loc, i) => {
  console.log(`${ips[i]}: ${loc?.fullLocation || '未知'}`);
});
```

### 特殊 IP 处理

```typescript
// 内网 IP
await getIpLocation('192.168.1.1');
// { country: '内网', fullLocation: '内网IP', ... }

// 无效 IP
await getIpLocation('invalid-ip');
// null

// 空值处理
await getIpLocation(null);
// null
```

## 数据维护

### 更新频率

GeoLite2 数据库**每周二更新一次**，建议定期更新：

```bash
# 手动更新
npm run download-geoip

# 定时任务（Linux/Mac）
0 0 * * 2 cd /path/to/project && npm run download-geoip
```

### 监控数据库状态

```bash
# 查看数据库文件信息
ls -lh data/GeoLite2-City.mmdb

# 示例输出
# -rw-r--r-- 1 user user 70M Jan 15 10:30 GeoLite2-City.mmdb
```

## 性能指标

| 指标 | 数值 |
|------|------|
| 数据库大小 | ~70MB |
| 查询速度 | < 1ms |
| 内存占用 | ~80MB (加载后) |
| 准确度（国家） | 99.8% |
| 准确度（城市） | ~80% |

## 故障排查

### 问题 1: 数据库文件不存在

**症状**: 控制台警告 `IP定位数据库不存在`

**解决**:
```bash
npm run download-geoip
```

### 问题 2: 所有 IP 都无法定位

**症状**: 测试脚本显示所有测试失败

**排查步骤**:
1. 检查数据库文件是否存在: `ls data/GeoLite2-City.mmdb`
2. 检查文件大小是否正常: 应该约 70MB
3. 重新下载数据库: `npm run download-geoip`

### 问题 3: License Key 错误

**症状**: 下载脚本报错 `状态码: 401`

**解决**:
1. 检查环境变量是否正确设置
2. 验证 License Key 是否有效
3. 确认账号状态正常

### 问题 4: 内网 IP 无法定位

**说明**: 这是**正常行为**，内网 IP（如 192.168.x.x, 10.x.x.x）无法获取真实地理位置，系统会返回"内网IP"。

## 最佳实践

### 1. 定期更新数据库

```bash
# 添加到 crontab（每周二凌晨2点更新）
0 2 * * 2 cd /path/to/project && npm run download-geoip >> /var/log/geoip-update.log 2>&1
```

### 2. 监控定位成功率

```typescript
// 在日志记录中添加统计
const location = await getIpLocation(ipAddress);
if (!location && ipAddress && !isPrivateIp(ipAddress)) {
  console.warn(`IP 定位失败: ${ipAddress}`);
}
```

### 3. 降级策略

```typescript
// 如果本地数据库不可用，可以降级到在线 API
async function getIpLocationWithFallback(ip: string) {
  const location = await getIpLocation(ip);
  if (!location && shouldUseFallback(ip)) {
    return await fetchFromOnlineAPI(ip); // 备用方案
  }
  return location;
}
```

## 合规性说明

### 数据使用许可

GeoLite2 数据库遵循 [Creative Commons Attribution-ShareAlike 4.0 International License](https://creativecommons.org/licenses/by-sa/4.0/)。

### 隐私保护

- IP 地址属于个人信息，应妥善保管
- 日志保留期限应符合当地法规（如 GDPR）
- 建议定期清理过期日志

### 法律声明

本功能仅用于安全审计和用户体验优化，不得用于非法用途。

## 相关资源

- **MaxMind 官网**: https://www.maxmind.com
- **GeoLite2 文档**: https://dev.maxmind.com/geoip/geolite2-free-geolocation-data
- **开源镜像**: https://github.com/P3TERX/GeoLite.mmdb
- **IP 定位原理**: https://en.wikipedia.org/wiki/Internet_geolocation

## 更新日志

### v1.0.0 (2025-01-15)

- ✅ 集成 MaxMind GeoLite2 数据库
- ✅ 实现 IP 地理位置自动解析
- ✅ 优化系统日志显示
- ✅ 添加下载和测试脚本
- ✅ 编写完整文档

---

**维护者**: 库存管理系统开发团队
**最后更新**: 2025-01-15
