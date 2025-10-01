/**
 * 测试七牛云连接
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const qiniu = require('qiniu');

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

console.log('=== 测试七牛云连接 ===\n');

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

function getQiniuZone(region) {
  const zoneMap = {
    z0: qiniu.zone.Zone_z0, // 华东-浙江
    z1: qiniu.zone.Zone_z1, // 华北-河北
    z2: qiniu.zone.Zone_z2, // 华南-广东
    na0: qiniu.zone.Zone_na0, // 北美
    as0: qiniu.zone.Zone_as0, // 亚太-新加坡
  };
  return zoneMap[region] || qiniu.zone.Zone_z0;
}

async function testConnection() {
  try {
    // 1. 获取配置
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: ['qiniu_access_key', 'qiniu_secret_key', 'qiniu_bucket', 'qiniu_region'],
        },
      },
    });

    const config = {
      accessKey: '',
      secretKey: '',
      bucket: '',
      region: 'z0',
    };

    settings.forEach(setting => {
      switch (setting.key) {
        case 'qiniu_access_key':
          config.accessKey = decrypt(setting.value);
          break;
        case 'qiniu_secret_key':
          config.secretKey = decrypt(setting.value);
          break;
        case 'qiniu_bucket':
          config.bucket = setting.value;
          break;
        case 'qiniu_region':
          config.region = setting.value;
          break;
      }
    });

    console.log('配置信息:');
    console.log(`- AccessKey: ${config.accessKey.substring(0, 10)}... (长度: ${config.accessKey.length})`);
    console.log(`- SecretKey: ${config.secretKey.substring(0, 10)}... (长度: ${config.secretKey.length})`);
    console.log(`- Bucket: ${config.bucket}`);
    console.log(`- Region: ${config.region}\n`);

    if (!config.accessKey || !config.secretKey || !config.bucket) {
      console.log('❌ 配置不完整');
      return;
    }

    // 2. 测试连接
    const mac = new qiniu.auth.digest.Mac(config.accessKey, config.secretKey);
    const qiniuConfig = new qiniu.conf.Config();
    qiniuConfig.zone = getQiniuZone(config.region);

    const bucketManager = new qiniu.rs.BucketManager(mac, qiniuConfig);

    console.log('正在测试连接...');

    bucketManager.listPrefix(
      config.bucket,
      { limit: 1 },
      (err, respBody, respInfo) => {
        if (err) {
          console.log(`\n❌ 连接失败: ${err.message}`);
          prisma.$disconnect();
          return;
        }

        if (respInfo.statusCode === 200) {
          console.log('\n✅ 七牛云连接测试成功!');
        } else if (respInfo.statusCode === 401) {
          console.log('\n❌ 连接失败: Access Key 或 Secret Key 不正确');
        } else if (respInfo.statusCode === 631) {
          console.log('\n❌ 连接失败: 存储空间不存在');
        } else {
          console.log(`\n❌ 连接失败: HTTP ${respInfo.statusCode}`);
        }

        prisma.$disconnect();
      }
    );
  } catch (error) {
    console.error('测试失败:', error);
    await prisma.$disconnect();
  }
}

testConnection();

