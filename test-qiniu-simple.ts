/**
 * 简单测试七牛云上传功能
 */

import { testQiniuConnection, uploadToQiniu } from './lib/services/qiniu-upload';

async function testQiniuUpload() {
  try {
    console.log('🧪 开始测试七牛云上传功能...\n');

    // 1. 测试连接
    console.log('1. 测试七牛云连接...');
    const connectionResult = await testQiniuConnection();

    if (connectionResult.success) {
      console.log('✅ 七牛云连接测试成功！');
      console.log('   - 消息:', connectionResult.message);
    } else {
      console.log('❌ 七牛云连接测试失败：', connectionResult.message);
      
      if (connectionResult.message.includes('七牛云配置未设置')) {
        console.log('\n💡 解决方案：');
        console.log('   1. 登录系统管理员账户');
        console.log('   2. 进入 系统设置 > 存储配置');
        console.log('   3. 配置七牛云存储参数：');
        console.log('      - Access Key: 你的七牛云Access Key');
        console.log('      - Secret Key: 你的七牛云Secret Key');
        console.log('      - 存储空间: 你的七牛云Bucket名称');
        console.log('      - 访问域名: 你的七牛云CDN域名');
        console.log('      - 存储区域: 选择合适的区域（如华东-浙江）');
        return;
      }
    }

    // 2. 测试上传（如果连接成功）
    if (connectionResult.success) {
      console.log('\n2. 测试上传到七牛云...');
      
      // 创建一个简单的测试图片（1x1像素的PNG）
      const pngData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg==';
      const testImageBuffer = Buffer.from(pngData, 'base64');
      console.log('✓ 创建测试图片成功 (1x1 PNG, 大小:', testImageBuffer.length, 'bytes)');

      const uploadResult = await uploadToQiniu(testImageBuffer, 'test-image.png', 'product');

      if (uploadResult.success) {
        console.log('✅ 七牛云上传成功！');
        console.log('   - URL:', uploadResult.url);
        console.log('   - Key:', uploadResult.key);
      } else {
        console.log('❌ 七牛云上传失败：', uploadResult.error);
      }
    }

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
  }
}

// 运行测试
testQiniuUpload().then(() => {
  console.log('\n🏁 测试完成');
}).catch(error => {
  console.error('💥 测试失败:', error);
});
