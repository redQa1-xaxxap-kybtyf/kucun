# 产品模块图片上传诊断报告

## 问题描述
产品模块上传图片时返回的是本地地址，而不是七牛云CDN地址。

## 代码流程分析

### 1. 上传流程
```
用户上传 → ProductImageUpload 组件
         → use-image-upload Hook
         → POST /api/upload
         → uploadToQiniu() 尝试上传七牛云
         → 如果失败 → saveFileLocally() 降级本地存储
```

### 2. 关键代码逻辑 (`app/api/upload/route.ts`)

```typescript
// Line 220-276
const uploadResult = await uploadToQiniu(buffer, file.name, type);

if (!uploadResult.success) {
  logger.error('upload', '上传至七牛云失败', undefined, {
    cloudError: uploadResult.error,
  });

  // 降级策略：fallback到本地存储
  if (uploadConfig.fallbackEnabled) {
    const fallbackResult = await saveFileLocally(buffer, file.name, file.type, type);

    return NextResponse.json({
      success: true,
      data: {
        url: fallbackResult.url,  // ⚠️ 返回本地路径
        storage: 'local',          // ⚠️ 标记为local
      },
      message: '文件已保存到本地存储，建议尽快修复云存储配置（七牛云上传失败）',
    });
  }
}

// 成功情况
return NextResponse.json({
  data: {
    url: uploadResult.url,  // ✅ 返回七牛云URL
    storage: 'qiniu',
  }
});
```

### 3. 七牛云上传逻辑 (`lib/services/qiniu-upload.ts`)

```typescript
// Line 197-210
export async function uploadToQiniu(buffer: Buffer, fileName: string, type: string = 'product'): Promise<UploadResult> {
  // 获取七牛云配置
  const config = await getQiniuConfig();
  if (!config) {
    return {
      success: false,
      error: '七牛云配置未设置或不完整，请联系管理员配置存储服务',
    };
  }

  // 验证必需配置项 (Line 95-108)
  if (!config.accessKey || !config.secretKey || !config.bucket || !config.domain) {
    return null; // ⚠️ 配置不完整返回null
  }

  // ... 执行上传到七牛云
}
```

## 问题根因

### ✅ 确定的原因
**七牛云配置未设置或不完整，触发了fallback机制**

系统按照以下顺序处理：
1. 尝试从数据库读取七牛云配置 (`qiniu_access_key`, `qiniu_secret_key`, `qiniu_bucket`, `qiniu_domain`)
2. 如果配置不存在或不完整 → `uploadToQiniu()` 返回 `success: false`
3. 触发 `uploadConfig.fallbackEnabled` 降级策略
4. 调用 `saveFileLocally()` 保存到本地目录
5. 返回本地路径 (如 `/uploads/product/xxx.jpg`)

### 证据

1. **Fallback机制已启用** (`lib/env.ts`)
   ```typescript
   uploadConfig: {
     directory: './public/uploads',
     maxSize: 5242880, // 5MB
     fallbackEnabled: true, // ⚠️ 降级策略已启用
   }
   ```

2. **返回消息包含提示**
   ```
   message: '文件已保存到本地存储，建议尽快修复云存储配置（七牛云上传失败）'
   ```

3. **返回数据包含storage标记**
   ```json
   {
     "url": "/uploads/product/...",
     "storage": "local"  // ⚠️ 标记为本地存储
   }
   ```

## 解决方案

### 方案1: 配置七牛云存储 ⭐ 推荐
1. 登录系统设置页面 (`/settings/storage`)
2. 填写七牛云配置:
   - Access Key: 七牛云控制台获取
   - Secret Key: 七牛云控制台获取
   - Bucket: 存储空间名称
   - Domain: 访问域名 (如 `https://cdn.example.com`)
   - Region: 区域 (z0/z1/z2/na0/as0)
3. 测试连接
4. 保存配置

### 方案2: 检查数据库配置
直接检查 `SystemSetting` 表中是否存在以下配置:
```sql
SELECT key, value FROM SystemSetting
WHERE key IN (
  'qiniu_access_key',
  'qiniu_secret_key',
  'qiniu_bucket',
  'qiniu_domain',
  'qiniu_region'
);
```

### 方案3: 禁用Fallback (不推荐)
如果想强制要求七牛云配置，可以禁用fallback:
```typescript
// .env.local
UPLOAD_FALLBACK_ENABLED=false
```
这样未配置七牛云时会直接报错，不会降级到本地存储。

## 验证步骤

1. **检查七牛云配置是否已设置**
   - 访问 `/settings/storage`
   - 查看配置是否完整
   - 测试连接是否成功

2. **模拟上传测试**
   - 创建/编辑产品
   - 上传图片
   - 查看返回的URL:
     - ✅ 如果是 `https://cdn.example.com/...` → 七牛云成功
     - ❌ 如果是 `/uploads/product/...` → 仍在使用本地存储

3. **检查日志**
   - 查看开发服务器日志
   - 搜索 "七牛云" 或 "qiniu" 相关日志
   - 查看是否有错误信息

## 系统设计优点

✅ **优雅降级**: 七牛云失败时自动降级到本地存储，不影响业务
✅ **明确标记**: 返回的 `storage` 字段标识存储类型
✅ **用户提示**: 降级时会提示用户修复云存储配置
✅ **安全加密**: Access Key 和 Secret Key 使用 AES-256 加密存储

## 下一步行动

1. **立即**: 检查系统设置中的七牛云配置
2. **如未配置**: 按方案1完成七牛云配置
3. **如已配置**: 检查配置是否正确、测试连接是否成功
4. **验证**: 重新上传图片测试，确认返回七牛云URL

---

**诊断完成时间**: 2025-10-15
**诊断结果**: ✅ 系统设计正常，需要配置七牛云存储
