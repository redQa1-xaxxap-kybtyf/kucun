/**
 * 调试上传流程
 * 不依赖环境变量验证,直接连接数据库检查配置
 */
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

// 解密函数 (从 route.ts 复制)
function decrypt(text) {
  try {
    if (!text.includes(':')) {
      return text;
    }

    const ENCRYPTION_KEY = process.env.STORAGE_ENCRYPTION_KEY || 'default-key-for-development-only-32char';
    const ALGORITHM = 'aes-256-cbc';

    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = textParts.join(':');
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY.slice(0, 32)),
      iv
    );
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('解密失败:', error.message);
    return text;
  }
}

async function debugUpload() {
  console.log('========================================');
  console.log('🔍 七牛云配置调试');
  console.log('========================================\n');

  try {
    // 1. 检查数据库配置
    console.log('📋 步骤1: 读取数据库配置\n');

    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            'qiniu_access_key',
            'qiniu_secret_key',
            'qiniu_bucket',
            'qiniu_domain',
            'qiniu_region',
            'qiniu_path_format'
          ]
        }
      },
      select: {
        key: true,
        value: true,
        updatedAt: true
      }
    });

    console.log(`找到 ${settings.length} 条配置记录\n`);

    const config = {
      accessKey: '',
      secretKey: '',
      bucket: '',
      domain: '',
      region: '',
      pathFormat: ''
    };

    for (const setting of settings) {
      console.log(`  • ${setting.key}:`);
      console.log(`    - 有值: ${!!setting.value}`);
      console.log(`    - 更新时间: ${setting.updatedAt.toISOString()}`);

      if (setting.value) {
        switch (setting.key) {
          case 'qiniu_access_key':
            config.accessKey = decrypt(setting.value);
            console.log(`    - 解密后长度: ${config.accessKey.length} 字符`);
            console.log(`    - 前缀: ${config.accessKey.substring(0, 8)}...`);
            break;
          case 'qiniu_secret_key':
            config.secretKey = decrypt(setting.value);
            console.log(`    - 解密后长度: ${config.secretKey.length} 字符`);
            console.log(`    - 前缀: ${config.secretKey.substring(0, 8)}...`);
            break;
          case 'qiniu_bucket':
            config.bucket = setting.value;
            console.log(`    - 值: ${setting.value}`);
            break;
          case 'qiniu_domain':
            config.domain = setting.value;
            console.log(`    - 值: ${setting.value}`);
            break;
          case 'qiniu_region':
            config.region = setting.value;
            console.log(`    - 值: ${setting.value}`);
            break;
          case 'qiniu_path_format':
            config.pathFormat = setting.value;
            console.log(`    - 值: ${setting.value || '(空)'}`);
            break;
        }
      } else {
        console.log(`    - ❌ 值为空`);
      }
      console.log();
    }

    console.log('----------------------------------------\n');

    // 2. 验证配置完整性
    console.log('📊 步骤2: 配置完整性检查\n');

    const checks = [
      { name: 'Access Key', value: config.accessKey, required: true },
      { name: 'Secret Key', value: config.secretKey, required: true },
      { name: 'Bucket', value: config.bucket, required: true },
      { name: 'Domain', value: config.domain, required: true },
      { name: 'Region', value: config.region, required: false },
      { name: 'Path Format', value: config.pathFormat, required: false }
    ];

    let allValid = true;

    for (const check of checks) {
      const hasValue = check.value && check.value.trim().length > 0;
      const status = hasValue ? '✅' : (check.required ? '❌' : '⚠️');

      console.log(`  ${status} ${check.name}: ${hasValue ? '已配置' : '未配置'}${check.required ? ' (必需)' : ' (可选)'}`);

      if (check.required && !hasValue) {
        allValid = false;
      }
    }

    console.log();

    if (!allValid) {
      console.log('❌ 配置不完整! 缺少必需的配置项\n');
      console.log('💡 解决方案:');
      console.log('   1. 访问 http://localhost:3001/settings/storage');
      console.log('   2. 填写完整的七牛云配置');
      console.log('   3. 点击"测试连接"验证');
      console.log('   4. 保存配置\n');
    } else {
      console.log('✅ 配置完整!\n');
    }

    console.log('----------------------------------------\n');

    // 3. Domain格式检查
    console.log('📊 步骤3: Domain格式检查\n');

    if (config.domain) {
      const domainChecks = [
        { name: '包含协议 (http/https)', pass: config.domain.startsWith('http://') || config.domain.startsWith('https://') },
        { name: '不以斜杠结尾', pass: !config.domain.endsWith('/') },
        { name: '格式正确', pass: /^https?:\/\/[^\/]+$/.test(config.domain) }
      ];

      for (const check of domainChecks) {
        console.log(`  ${check.pass ? '✅' : '❌'} ${check.name}`);
      }

      console.log();

      if (!domainChecks.every(c => c.pass)) {
        console.log('⚠️  Domain 格式可能有问题\n');
        console.log('正确格式示例:');
        console.log('  - https://cdn.example.com');
        console.log('  - http://your-domain.qiniudn.com\n');
        console.log('错误格式:');
        console.log('  - cdn.example.com (缺少协议)');
        console.log('  - https://cdn.example.com/ (多余的斜杠)\n');
      }
    }

    console.log('----------------------------------------\n');

    // 4. 预期上传URL
    console.log('📊 步骤4: 预期上传URL\n');

    if (allValid && config.domain) {
      const sampleKey = '2025/01/15/1737024000000_abc123.jpg';
      const expectedUrl = `${config.domain}/${sampleKey}`;
      console.log(`  示例文件: ${sampleKey}`);
      console.log(`  预期URL: ${expectedUrl}\n`);
    }

    console.log('========================================');
    console.log('✅ 调试完成');
    console.log('========================================\n');

    // 5. 给出建议
    if (!allValid) {
      console.log('🔧 下一步操作: 完善七牛云配置\n');
    } else {
      console.log('🧪 下一步操作: 测试实际上传\n');
      console.log('测试方法:');
      console.log('1. 访问 http://localhost:3001/products/create');
      console.log('2. 上传图片');
      console.log('3. 在浏览器开发者工具的 Network 标签中查看 /api/upload 响应');
      console.log('4. 检查返回的 data.url 和 data.storage\n');
      console.log('如果仍然返回本地路径,请查看服务器日志中的错误信息:');
      console.log('  • 七牛云 API 错误');
      console.log('  • 网络连接问题');
      console.log('  • 权限/认证失败\n');
    }

  } catch (error) {
    console.error('❌ 调试过程出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugUpload();
