/**
 * IP 地理位置功能测试脚本
 * 用于验证 MaxMind GeoLite2 集成是否正常工作
 */

import { getIpLocation, formatLocation } from '../lib/services/ip-location';

/**
 * 测试用例
 */
const testCases = [
  // 国内 IP
  { ip: '223.5.5.5', desc: '阿里云DNS' },
  { ip: '119.75.217.109', desc: '腾讯云' },
  { ip: '202.96.128.86', desc: '中国电信' },

  // 国外 IP
  { ip: '8.8.8.8', desc: 'Google DNS' },
  { ip: '1.1.1.1', desc: 'Cloudflare DNS' },
  { ip: '208.67.222.222', desc: 'OpenDNS' },

  // 内网 IP
  { ip: '192.168.1.1', desc: '局域网' },
  { ip: '10.0.0.1', desc: '内网' },
  { ip: '127.0.0.1', desc: '本地回环' },

  // 无效 IP
  { ip: 'invalid-ip', desc: '无效IP格式' },
  { ip: '', desc: '空字符串' },
];

/**
 * 运行测试
 */
async function runTests() {
  console.log('🧪 开始测试 IP 地理位置功能\n');
  console.log('='.repeat(80));

  let successCount = 0;
  let failureCount = 0;

  for (const testCase of testCases) {
    try {
      console.log(`\n📍 测试: ${testCase.desc}`);
      console.log(`   IP: ${testCase.ip || '(empty)'}`);

      const startTime = Date.now();
      const location = await getIpLocation(testCase.ip);
      const duration = Date.now() - startTime;

      if (location) {
        console.log(`   ✅ 定位成功 (耗时: ${duration}ms)`);
        console.log(`   国家: ${location.country || '-'}`);
        console.log(`   省份: ${location.province || '-'}`);
        console.log(`   城市: ${location.city || '-'}`);
        console.log(`   完整位置: ${location.fullLocation || '-'}`);
        console.log(`   格式化 (短): ${formatLocation(location, 'short')}`);
        console.log(`   格式化 (长): ${formatLocation(location, 'full')}`);
        if (location.latitude && location.longitude) {
          console.log(`   坐标: ${location.latitude}, ${location.longitude}`);
        }
        successCount++;
      } else {
        console.log(`   ⚠️  无法定位 (可能是内网IP或无效IP)`);
        failureCount++;
      }
    } catch (error) {
      console.log(
        `   ❌ 错误: ${error instanceof Error ? error.message : String(error)}`
      );
      failureCount++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 测试结果:`);
  console.log(`   总计: ${testCases.length} 个测试用例`);
  console.log(`   成功: ${successCount} 个 ✅`);
  console.log(`   失败: ${failureCount} 个 ❌`);

  if (successCount === 0) {
    console.log('\n⚠️  警告: 所有测试均未成功定位');
    console.log('   请检查是否已下载 GeoLite2 数据库:');
    console.log('   运行命令: npm run download-geoip\n');
  } else {
    console.log('\n✅ IP 地理位置功能测试完成！\n');
  }
}

// 执行测试
runTests().catch(console.error);
