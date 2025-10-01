/**
 * 测试七牛云配置脚本
 * 运行: npm run dev 后在另一个终端运行此脚本
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// 简化的解密函数
function simpleDecrypt(encryptedText: string): string {
  try {
    const NEXTAUTH_SECRET =
      process.env.NEXTAUTH_SECRET || 'your-secret-key-here';
    const ENCRYPTION_KEY = crypto
      .createHash('sha256')
      .update(NEXTAUTH_SECRET)
      .digest()
      .slice(0, 32);
    const ALGORITHM = 'aes-256-cbc';

    // 检查是否是新格式（包含 IV）
    if (encryptedText.includes(':')) {
      const parts = encryptedText.split(':');
      if (
        parts.length === 2 &&
        /^[0-9a-f]+$/i.test(parts[0]) &&
        /^[0-9a-f]+$/i.test(parts[1])
      ) {
        try {
          const iv = Buffer.from(parts[0], 'hex');
          const encrypted = parts[1];
          const decipher = crypto.createDecipheriv(
            ALGORITHM,
            ENCRYPTION_KEY,
            iv
          );
          let decrypted = decipher.update(encrypted, 'hex', 'utf8');
          decrypted += decipher.final('utf8');
          return decrypted;
        } catch (error) {
          console.warn('新格式解密失败');
        }
      }
    }

    // 尝试旧格式
    try {
      const decipher = crypto.createDecipher('aes192', NEXTAUTH_SECRET);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      return encryptedText;
    }
  } catch (error) {
    return encryptedText;
  }
}

async function testQiniuConfig() {
  try {
    console.log('=== 开始检查七牛云配置 ===\n');

    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            'qiniu_access_key',
            'qiniu_secret_key',
            'qiniu_bucket',
            'qiniu_domain',
            'qiniu_region',
          ],
        },
      },
    });

    console.log(`找到 ${settings.length} 个配置项\n`);

    settings.forEach(setting => {
      console.log(`配置项: ${setting.key}`);
      console.log(`原始值: ${setting.value?.substring(0, 50)}...`);

      if (
        setting.key === 'qiniu_access_key' ||
        setting.key === 'qiniu_secret_key'
      ) {
        if (setting.value) {
          try {
            const decrypted = simpleDecrypt(setting.value);
            console.log(
              `解密后: ${decrypted.substring(0, 10)}... (长度: ${decrypted.length})`
            );
          } catch (error) {
            console.error(`解密失败:`, error);
          }
        }
      } else {
        console.log(`值: ${setting.value}`);
      }
      console.log('---\n');
    });

    console.log('=== 检查完成 ===');
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testQiniuConfig();
