# 验证码校验回调 URL 硬编码问题修复

## 问题描述

在 `lib/auth.ts` 第 123-125 行,验证码校验时使用了硬编码的回调 URL:

```typescript
const baseUrl =
  process.env.NEXTAUTH_URL ||
  `http://localhost:${process.env.PORT || 3003}`;
```

这会导致以下问题:

1. **生产环境 HTTPS 不匹配**: 硬编码的 `http://` 协议在生产环境使用 HTTPS 时会导致 500 错误
2. **端口号错误**: 默认端口 3003 与实际运行端口 3000 不匹配
3. **域名不匹配**: 在非 localhost 域名(如正式域名)下,回调地址无效
4. **缺少容错机制**: 认证链路极易失效

## 修复方案

### 1. 使用环境变量优先

修改后的代码优先使用 `env.NEXTAUTH_URL` 环境变量(已在 `lib/env.ts` 中定义和验证):

```typescript
const baseUrl = (() => {
  // 优先使用 NEXTAUTH_URL 环境变量
  if (env.NEXTAUTH_URL) {
    return env.NEXTAUTH_URL;
  }

  // 生产环境必须配置 NEXTAUTH_URL
  if (process.env.NODE_ENV === 'production') {
    console.error('[Auth] 生产环境必须配置 NEXTAUTH_URL 环境变量');
    throw new Error(
      'NEXTAUTH_URL is required in production environment'
    );
  }

  // 开发环境回退到 localhost
  const port = process.env.PORT || 3000;
  const fallbackUrl = `http://localhost:${port}`;
  console.warn(
    `[Auth] NEXTAUTH_URL 未配置,使用回退 URL: ${fallbackUrl}`
  );
  return fallbackUrl;
})();
```

### 2. 添加容错机制

- **开发环境**: 如果 `NEXTAUTH_URL` 未配置,自动回退到 `http://localhost:3000`(使用正确的默认端口)
- **生产环境**: 如果 `NEXTAUTH_URL` 未配置,抛出明确的错误提示,防止静默失败
- **日志记录**: 添加警告和错误日志,便于调试认证问题

### 3. 环境变量配置

在 `.env.local` 中已配置:

```env
NEXTAUTH_URL="http://localhost:3000"
```

在生产环境中,需要配置为实际的域名和协议:

```env
NEXTAUTH_URL="https://your-domain.com"
```

## 修复效果

### 开发环境

- ✅ 使用 `.env.local` 中配置的 `NEXTAUTH_URL="http://localhost:3000"`
- ✅ 如果未配置,自动回退到 `http://localhost:3000`(修正了之前的 3003 端口错误)
- ✅ 显示警告日志,提醒开发者配置环境变量

### 生产环境

- ✅ 必须配置 `NEXTAUTH_URL`,否则抛出错误
- ✅ 支持 HTTPS 协议
- ✅ 支持自定义域名和端口
- ✅ 避免硬编码导致的认证失败

## 验证结果

1. **TypeScript 类型检查**: ✅ 通过,`lib/auth.ts` 无类型错误
2. **开发服务器**: ✅ 正常运行,无相关错误
3. **环境变量**: ✅ 已在 `lib/env.ts` 中定义和验证
4. **向后兼容**: ✅ 保持与现有代码的兼容性

## 相关文件

- `lib/auth.ts` - 修复的主要文件(第 123-144 行)
- `lib/env.ts` - 环境变量定义和验证(第 30-34 行)
- `.env.local` - 开发环境配置

## 注意事项

1. **生产环境部署**: 确保在生产环境的环境变量中配置正确的 `NEXTAUTH_URL`
2. **HTTPS 支持**: 生产环境应使用 HTTPS 协议,例如 `https://your-domain.com`
3. **端口配置**: 如果应用运行在非标准端口,需要在 URL 中包含端口号,例如 `https://your-domain.com:8443`

## 修复日期

2025-10-03

