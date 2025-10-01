/**
 * 使用 STORAGE_ENCRYPTION_KEY 测试解密
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// 手动加载 .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');

let STORAGE_ENCRYPTION_KEY = '';
envLines.forEach(line => {
  const match = line.match(/^STORAGE_ENCRYPTION_KEY="?([^"#]+)"?/);
  if (match) {
    STORAGE_ENCRYPTION_KEY = match[1].trim();
  }
});

const ENCRYPTION_KEY = Buffer.from(STORAGE_ENCRYPTION_KEY.slice(0, 32));
const ALGORITHM = 'aes-256-cbc';

console.log('=== 使用 STORAGE_ENCRYPTION_KEY 测试解密 ===\n');
console.log(`STORAGE_ENCRYPTION_KEY: ${STORAGE_ENCRYPTION_KEY.substring(0, 20)}...`);
console.log(`STORAGE_ENCRYPTION_KEY长度: ${STORAGE_ENCRYPTION_KEY.length}`);
console.log(`加密密钥长度: ${ENCRYPTION_KEY.length} 字节\n`);

function decrypt(encryptedText) {
  try {
    if (encryptedText.includes(':')) {
      const parts = encryptedText.split(':');
      if (parts.length === 2 && /^[0-9a-f]+$/i.test(parts[0]) && /^[0-9a-f]+$/i.test(parts[1])) {
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      }
    }
    return encryptedText;
  } catch (error) {
    console.error(`解密失败: ${error.message}`);
    return encryptedText;
  }
}

async function testDecryption() {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: ['qiniu_access_key', 'qiniu_secret_key'],
        },
      },
    });

    for (const setting of settings) {
      console.log(`\n配置项: ${setting.key}`);
      console.log(`加密值: ${setting.value.substring(0, 50)}...`);
      console.log(`加密值长度: ${setting.value.length}`);
      
      const decrypted = decrypt(setting.value);
      console.log(`解密后长度: ${decrypted.length}`);
      console.log(`解密后前10个字符: ${decrypted.substring(0, 10)}...`);
      console.log(`解密是否成功: ${decrypted.length !== setting.value.length ? '✅ 是' : '❌ 否'}`);
      
      if (decrypted.length === 40) {
        console.log('✅ 密钥长度正确(40个字符)!');
      } else if (decrypted.length !== setting.value.length) {
        console.log(`⚠️ 密钥长度异常: ${decrypted.length} (预期40)`);
      }
    }
    
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDecryption();

