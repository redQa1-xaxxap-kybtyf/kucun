/**
 * 测试解密功能
 */

const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// 手动加载 .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
envLines.forEach(line => {
  const match = line.match(/^NEXTAUTH_SECRET="?([^"]+)"?$/);
  if (match) {
    process.env.NEXTAUTH_SECRET = match[1];
  }
});

// 从环境变量获取密钥
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || '';
const ENCRYPTION_KEY = crypto
  .createHash('sha256')
  .update(NEXTAUTH_SECRET)
  .digest()
  .slice(0, 32);
const ALGORITHM = 'aes-256-cbc';

function decrypt(encryptedText) {
  try {
    console.log(`\n尝试解密: ${encryptedText.substring(0, 50)}...`);
    console.log(`加密文本长度: ${encryptedText.length}`);

    // 检查是否是新格式（包含 IV）
    if (encryptedText.includes(':')) {
      const parts = encryptedText.split(':');
      console.log(`分割后部分数: ${parts.length}`);

      if (parts.length === 2) {
        console.log(`IV部分长度: ${parts[0].length}`);
        console.log(`加密数据部分长度: ${parts[1].length}`);
        console.log(`IV是否为hex: ${/^[0-9a-f]+$/i.test(parts[0])}`);
        console.log(`加密数据是否为hex: ${/^[0-9a-f]+$/i.test(parts[1])}`);

        if (/^[0-9a-f]+$/i.test(parts[0]) && /^[0-9a-f]+$/i.test(parts[1])) {
          try {
            const iv = Buffer.from(parts[0], 'hex');
            const encrypted = parts[1];

            console.log(`\nIV Buffer长度: ${iv.length} 字节`);
            console.log(`加密密钥长度: ${ENCRYPTION_KEY.length} 字节`);
            console.log(
              `NEXTAUTH_SECRET: ${NEXTAUTH_SECRET.substring(0, 20)}...`
            );

            const decipher = crypto.createDecipheriv(
              ALGORITHM,
              ENCRYPTION_KEY,
              iv
            );
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            console.log(`✅ 解密成功!`);
            console.log(`解密后长度: ${decrypted.length}`);
            console.log(`解密后前10个字符: ${decrypted.substring(0, 10)}...`);

            return decrypted;
          } catch (error) {
            console.error(`❌ 新格式解密失败:`, error.message);
            return encryptedText;
          }
        }
      }
    }

    console.log('⚠️ 不是新格式,返回原文');
    return encryptedText;
  } catch (error) {
    console.error('❌ 解密失败:', error.message);
    return encryptedText;
  }
}

async function testDecryption() {
  try {
    console.log('=== 测试七牛云密钥解密 ===');
    console.log(`NEXTAUTH_SECRET存在: ${!!NEXTAUTH_SECRET}`);
    console.log(`NEXTAUTH_SECRET长度: ${NEXTAUTH_SECRET.length}`);

    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: ['qiniu_access_key', 'qiniu_secret_key'],
        },
      },
    });

    for (const setting of settings) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`配置项: ${setting.key}`);
      console.log(`${'='.repeat(60)}`);

      if (setting.value) {
        const decrypted = decrypt(setting.value);

        console.log(`\n最终结果:`);
        console.log(`- 原始长度: ${setting.value.length}`);
        console.log(`- 解密后长度: ${decrypted.length}`);
        console.log(
          `- 是否解密成功: ${decrypted.length !== setting.value.length ? '✅ 是' : '❌ 否'}`
        );
      }
    }
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDecryption();
