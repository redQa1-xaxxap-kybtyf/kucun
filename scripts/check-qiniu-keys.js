/**
 * 检查七牛云密钥格式
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkKeys() {
  try {
    console.log('=== 检查七牛云密钥格式 ===\n');

    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            'qiniu_access_key',
            'qiniu_secret_key',
            'qiniu_bucket',
            'qiniu_domain',
            'qiniu_region',
            'qiniu_path_format',
          ],
        },
      },
    });

    console.log(`找到 ${settings.length} 个配置项\n`);

    settings.forEach(setting => {
      console.log(`配置项: ${setting.key}`);
      
      if (setting.value) {
        console.log(`值长度: ${setting.value.length}`);
        console.log(`前20个字符: ${setting.value.substring(0, 20)}...`);
        
        // 检查是否是新格式(包含冒号)
        if (setting.value.includes(':')) {
          const parts = setting.value.split(':');
          if (parts.length === 2 && /^[0-9a-f]+$/i.test(parts[0]) && /^[0-9a-f]+$/i.test(parts[1])) {
            console.log('格式: 新格式 (IV:加密数据)');
            console.log(`IV长度: ${parts[0].length / 2} 字节`);
            console.log(`加密数据长度: ${parts[1].length / 2} 字节`);
          } else {
            console.log('格式: 包含冒号但不是标准格式');
          }
        } else {
          console.log('格式: 可能是旧格式或明文');
        }
      } else {
        console.log('值: null');
      }
      
      console.log('---\n');
    });

    console.log('\n=== 建议 ===');
    console.log('如果密钥不是新格式(IV:加密数据),请重新保存配置');
    console.log('新格式示例: 32位hex:加密后的hex数据');
    
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkKeys();

