/**
 * 测试加密解密完整流程
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

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

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || '';
const ENCRYPTION_KEY = crypto
  .createHash('sha256')
  .update(NEXTAUTH_SECRET)
  .digest()
  .slice(0, 32);
const ALGORITHM = 'aes-256-cbc';

console.log('=== 测试加密解密流程 ===\n');
console.log(`NEXTAUTH_SECRET: ${NEXTAUTH_SECRET.substring(0, 20)}...`);
console.log(`NEXTAUTH_SECRET长度: ${NEXTAUTH_SECRET.length}`);
console.log(`加密密钥长度: ${ENCRYPTION_KEY.length} 字节\n`);

// 测试数据
const testAccessKey = 'test-access-key-1234567890123456789012';
const testSecretKey = 'test-secret-key-1234567890123456789012';

console.log('=== 步骤1: 加密测试数据 ===');
console.log(`原始 AccessKey: ${testAccessKey}`);
console.log(`原始 AccessKey 长度: ${testAccessKey.length}\n`);

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedText) {
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
}

// 加密
const encryptedAccessKey = encrypt(testAccessKey);
const encryptedSecretKey = encrypt(testSecretKey);

console.log(`加密后 AccessKey: ${encryptedAccessKey.substring(0, 50)}...`);
console.log(`加密后 AccessKey 长度: ${encryptedAccessKey.length}\n`);

console.log('=== 步骤2: 解密测试数据 ===');

// 解密
const decryptedAccessKey = decrypt(encryptedAccessKey);
const decryptedSecretKey = decrypt(encryptedSecretKey);

console.log(`解密后 AccessKey: ${decryptedAccessKey}`);
console.log(`解密后 AccessKey 长度: ${decryptedAccessKey.length}`);
console.log(`解密是否成功: ${decryptedAccessKey === testAccessKey ? '✅ 是' : '❌ 否'}\n`);

console.log('=== 步骤3: 测试数据库中的实际密钥 ===\n');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testDatabaseKeys() {
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
      
      try {
        const decrypted = decrypt(setting.value);
        console.log(`解密后长度: ${decrypted.length}`);
        console.log(`解密后前10个字符: ${decrypted.substring(0, 10)}...`);
        console.log(`解密是否成功: ${decrypted.length !== setting.value.length ? '✅ 是' : '❌ 否'}`);
        
        if (decrypted.length === setting.value.length) {
          console.log('\n⚠️ 解密失败!可能的原因:');
          console.log('1. 数据是用不同的 NEXTAUTH_SECRET 加密的');
          console.log('2. 加密算法不匹配');
          console.log('3. IV 或加密数据损坏');
        }
      } catch (error) {
        console.error(`解密失败: ${error.message}`);
      }
    }
    
    console.log('\n=== 建议 ===');
    console.log('如果解密失败,请在系统设置页面重新保存七牛云配置');
    console.log('这样会用当前的 NEXTAUTH_SECRET 重新加密密钥');
    
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabaseKeys();

