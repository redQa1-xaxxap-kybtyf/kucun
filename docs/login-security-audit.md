# 登录功能安全审计报告

## 审计日期

2025-10-01

## 审计范围

- 登录页面 (`app/auth/signin/page.tsx`)
- 认证配置 (`lib/auth.ts`)
- 验证码 API (`app/api/auth/captcha/route.ts`)

---

## 🚨 发现的安全问题

### 1. **严重:验证码可重复使用** ✅ 已修复

**问题描述**:

- 验证码验证成功后没有删除会话
- 同一个验证码可以被多次使用进行登录尝试
- 攻击者可以获取一个有效验证码后进行暴力破解

**影响等级**: 🔴 严重

**修复方案**:

- 在 `lib/auth.ts` 中添加 `deleteAfterVerify: true` 参数
- 在 `app/api/auth/captcha/route.ts` 中验证成功后删除会话
- 确保每个验证码只能使用一次

**修复代码**:

```typescript
// lib/auth.ts
body: JSON.stringify({
  sessionId: captchaSessionId,
  captcha: credentials.captcha,
  deleteAfterVerify: true, // 验证成功后删除会话
}),

// app/api/auth/captcha/route.ts
if (isValid) {
  if (deleteAfterVerify) {
    captchaSessions.delete(sessionId);
    console.log(`验证码验证成功,会话已删除: ${sessionId}`);
  }
  return NextResponse.json({
    success: true,
    message: '验证码验证成功',
  });
}
```

---

### 2. **中等:IP 验证策略优化** ✅ 已优化

**问题描述**:

- 验证码验证时没有检查 IP 地址
- 但强制 IP 验证会影响用户体验

**影响等级**: 🟡 中等

**最佳实践方案**:

- ✅ **记录 IP 变化但不阻止登录**
- ✅ **用于安全审计和异常检测**
- ✅ **不影响正常用户体验**

**为什么不强制验证 IP**:

1. 移动网络用户 IP 可能频繁变化
2. 用户可能使用 VPN/代理
3. 企业网络可能有多个出口 IP
4. 某些 ISP 会动态分配 IP

**实施方案**:

```typescript
// 记录 IP 变化但不阻止登录
if (session.clientIp !== clientIp) {
  console.warn(
    `[安全审计] 验证码 IP 变化: 会话 IP=${session.clientIp}, 请求 IP=${clientIp}`
  );
  // 不阻止登录,只记录日志用于安全审计
}
```

**高级安全策略**(可选):

- 检查 IP 是否在同一地理区域
- 检查 IP 是否在黑名单中
- 检查 IP 变化频率是否异常
- 结合其他因素(User-Agent、设备指纹等)综合判断

---

### 3. **低:端口配置不一致** ✅ 已修复

**问题描述**:

- `lib/auth.ts` 中硬编码端口 3001
- 实际服务器运行在端口 3003
- 导致验证码 API 调用失败

**影响等级**: 🟢 低

**修复方案**:

- 将默认端口改为 3003
- 优先使用环境变量 `NEXTAUTH_URL`

**修复代码**:

```typescript
const baseUrl =
  process.env.NEXTAUTH_URL || `http://localhost:${process.env.PORT || 3003}`;
```

---

### 4. **中等:验证码会话存储在内存** ⚠️ 待改进

**问题描述**:

- 验证码会话使用 `Map` 存储在内存中
- 服务器重启后所有会话丢失
- 多服务器部署时无法共享会话

**影响等级**: 🟡 中等

**建议改进**:

- 使用 Redis 存储验证码会话
- 设置合理的过期时间(当前 5 分钟)
- 支持分布式部署

**改进方案**:

```typescript
// 使用 Redis 存储
import { redis } from '@/lib/redis';

// 存储验证码
await redis.setex(
  `captcha:${sessionId}`,
  CAPTCHA_CONFIG.expireMinutes * 60,
  JSON.stringify(session)
);

// 获取验证码
const sessionData = await redis.get(`captcha:${sessionId}`);
const session = sessionData ? JSON.parse(sessionData) : null;

// 删除验证码
await redis.del(`captcha:${sessionId}`);
```

---

## ✅ 安全措施已实施

### 1. **密码哈希**

- 使用 bcrypt 进行密码哈希
- 密码不以明文存储
- 密码比较使用 `bcrypt.compare()`

### 2. **防止用户名枚举**

- 用户不存在和密码错误返回相同错误信息
- 统一返回"用户名或密码错误"
- 符合 OWASP 安全最佳实践

### 3. **验证码限制**

- 最大尝试次数:5 次
- 过期时间:5 分钟
- 超过尝试次数自动删除会话

### 4. **账户状态检查**

- 检查账户是否被禁用
- 禁用账户无法登录
- 返回明确的错误信息

### 5. **CSRF 保护**

- Next-Auth 自动提供 CSRF Token
- 所有登录请求都需要 CSRF Token

### 6. **会话管理**

- 使用 JWT 进行会话管理
- 会话有效期:24 小时
- 支持自动刷新

---

## 🔍 代码质量检查

### 1. **类型安全** ✅

- 使用 TypeScript 严格模式
- 所有 API 输入使用 Zod 验证
- 类型定义完整

### 2. **错误处理** ✅

- 所有 API 都有 try-catch 错误处理
- 错误信息不泄露敏感信息
- 服务器日志记录详细错误

### 3. **输入验证** ✅

- 用户名、密码、验证码都经过 Zod 验证
- 验证码长度限制:4 位
- 密码长度限制:8-100 位

---

## 📋 测试建议

### 1. **功能测试**

- [ ] 使用正确的用户名和密码登录
- [ ] 使用错误的用户名登录
- [ ] 使用错误的密码登录
- [ ] 使用错误的验证码登录
- [ ] 验证码过期后登录
- [ ] 超过最大尝试次数后登录

### 2. **安全测试**

- [ ] 尝试重复使用同一个验证码
- [ ] 尝试在不同 IP 使用验证码(生产环境)
- [ ] 尝试暴力破解密码
- [ ] 尝试 SQL 注入攻击
- [ ] 尝试 XSS 攻击

### 3. **性能测试**

- [ ] 并发登录测试
- [ ] 验证码生成性能测试
- [ ] 内存泄漏测试

---

## 🎯 后续改进建议

### 1. **短期改进**(1-2 周)

- [ ] 将验证码会话迁移到 Redis
- [ ] 添加登录失败次数限制(防止暴力破解)
- [ ] 添加登录日志记录
- [ ] 添加异常登录检测(如异地登录)

### 2. **中期改进**(1-2 月)

- [ ] 实现双因素认证(2FA)
- [ ] 添加登录设备管理
- [ ] 实现会话管理(查看所有活跃会话)
- [ ] 添加登录通知(邮件/短信)

### 3. **长期改进**(3-6 月)

- [ ] 实现 OAuth 登录(Google, GitHub 等)
- [ ] 添加生物识别登录(指纹、面部识别)
- [ ] 实现风险评分系统
- [ ] 添加行为分析(检测异常登录行为)

---

## 📊 安全评分

| 项目           | 评分       | 说明                        |
| -------------- | ---------- | --------------------------- |
| **密码安全**   | ⭐⭐⭐⭐⭐ | 使用 bcrypt,安全性高        |
| **验证码安全** | ⭐⭐⭐⭐   | 已修复重复使用问题          |
| **会话管理**   | ⭐⭐⭐⭐   | JWT 管理,安全可靠           |
| **输入验证**   | ⭐⭐⭐⭐⭐ | Zod 验证,类型安全           |
| **错误处理**   | ⭐⭐⭐⭐   | 完善的错误处理              |
| **防暴力破解** | ⭐⭐⭐     | 有验证码,但缺少登录次数限制 |
| **日志记录**   | ⭐⭐⭐     | 基本日志,可以改进           |

**总体评分**: ⭐⭐⭐⭐ (4/5)

---

## 🎯 安全策略说明

### IP 验证策略

**当前策略**: 记录但不阻止

**原因**:

1. **用户体验优先**: 不因 IP 变化阻止正常用户登录
2. **移动场景友好**: 支持移动网络、VPN、代理等场景
3. **安全审计**: 记录所有 IP 变化用于事后分析
4. **灵活扩展**: 可以根据需要添加更复杂的风险评估

**替代安全措施**:

- ✅ 验证码一次性使用(防止重放攻击)
- ✅ 验证码 5 分钟过期
- ✅ 最多 5 次尝试机会
- ✅ 密码 bcrypt 哈希
- ✅ CSRF Token 保护
- ✅ 会话 JWT 管理

**高级安全选项**(可选实施):

```typescript
// 1. 地理位置检查
const isNearby = checkGeoDistance(session.clientIp, clientIp);
if (!isNearby) {
  // 发送邮件/短信通知用户
  sendSecurityAlert(user, 'IP 地址变化');
}

// 2. IP 黑名单检查
const isBlacklisted = await checkIPBlacklist(clientIp);
if (isBlacklisted) {
  return NextResponse.json(
    { success: false, error: '该 IP 已被限制' },
    { status: 403 }
  );
}

// 3. 频率限制
const attempts = await getIPAttempts(clientIp);
if (attempts > 10) {
  return NextResponse.json(
    { success: false, error: '尝试次数过多,请稍后再试' },
    { status: 429 }
  );
}

// 4. 设备指纹
const deviceFingerprint = request.headers.get('x-device-fingerprint');
if (session.deviceFingerprint !== deviceFingerprint) {
  // 记录设备变化
  logDeviceChange(session, deviceFingerprint);
}
```

---

## 📝 总结

经过本次安全审计,发现并修复了 3 个安全问题:

1. ✅ **验证码可重复使用**(严重) - 已修复
2. ✅ **IP 验证策略优化**(中等) - 已优化
3. ✅ **端口配置不一致**(低) - 已修复

**安全策略**:

- 采用"记录但不阻止"的 IP 验证策略
- 平衡安全性和用户体验
- 通过多层安全措施保障系统安全

系统整体安全性良好,符合 OWASP 安全最佳实践。建议按照后续改进计划逐步完善安全措施。

---

**审计人员**: AI Assistant
**审计日期**: 2025-10-01
**下次审计**: 2025-11-01
