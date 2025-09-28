/**
 * 测试七牛云上传功能
 */

const fs = require('fs');
const path = require('path');

// 创建一个简单的测试图片（1x1像素的PNG）
const createTestImage = () => {
  // 1x1像素的PNG图片的base64数据
  const pngData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg==';
  return Buffer.from(pngData, 'base64');
};

async function testQiniuUpload() {
  try {
    console.log('🧪 开始测试七牛云上传功能...\n');

    // 1. 检查七牛云配置
    console.log('1. 检查七牛云配置状态...');
    
    const { uploadToQiniu } = require('./lib/services/qiniu-upload.ts');
    
    // 创建测试图片
    const testImageBuffer = createTestImage();
    console.log('✓ 创建测试图片成功 (1x1 PNG, 大小:', testImageBuffer.length, 'bytes)');

    // 2. 测试上传
    console.log('\n2. 测试上传到七牛云...');
    const uploadResult = await uploadToQiniu(testImageBuffer, 'test-image.png', 'product');

    if (uploadResult.success) {
      console.log('✅ 七牛云上传成功！');
      console.log('   - URL:', uploadResult.url);
      console.log('   - Key:', uploadResult.key);
    } else {
      console.log('❌ 七牛云上传失败：', uploadResult.error);
      
      if (uploadResult.error?.includes('七牛云配置未设置')) {
        console.log('\n💡 解决方案：');
        console.log('   1. 登录系统管理员账户');
        console.log('   2. 进入 系统设置 > 存储配置');
        console.log('   3. 配置七牛云存储参数：');
        console.log('      - Access Key: 你的七牛云Access Key');
        console.log('      - Secret Key: 你的七牛云Secret Key');
        console.log('      - 存储空间: 你的七牛云Bucket名称');
        console.log('      - 访问域名: 你的七牛云CDN域名');
        console.log('      - 存储区域: 选择合适的区域（如华东-浙江）');
      }
    }

    // 3. 测试连接
    console.log('\n3. 测试七牛云连接...');
    const { testQiniuConnection } = require('./lib/services/qiniu-upload.ts');
    const connectionResult = await testQiniuConnection();

    if (connectionResult.success) {
      console.log('✅ 七牛云连接测试成功！');
      console.log('   - 消息:', connectionResult.message);
    } else {
      console.log('❌ 七牛云连接测试失败：', connectionResult.message);
    }

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
    
    if (error.message.includes('Cannot find module')) {
      console.log('\n💡 可能的原因：');
      console.log('   - TypeScript文件需要编译或使用ts-node运行');
      console.log('   - 缺少必要的依赖包');
      console.log('\n🔧 建议解决方案：');
      console.log('   1. 确保已安装qiniu包: npm install qiniu');
      console.log('   2. 确保项目已正确构建');
    }
  }
}

// 运行测试
testQiniuUpload().then(() => {
  console.log('\n🏁 测试完成');
}).catch(error => {
  console.error('💥 测试失败:', error);
});
