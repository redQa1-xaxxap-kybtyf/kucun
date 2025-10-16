/**
 * MaxMind GeoLite2 数据库下载脚本
 *
 * 使用说明:
 * 1. 注册 MaxMind 账号: https://www.maxmind.com/en/geolite2/signup
 * 2. 生成 License Key: https://www.maxmind.com/en/accounts/current/license-key
 * 3. 设置环境变量: MAXMIND_LICENSE_KEY=your_license_key
 * 4. 运行脚本: npm run download-geoip
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const tar = require('tar');

// 数据目录
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'GeoLite2-City.mmdb');

// MaxMind 配置
const MAXMIND_LICENSE_KEY = process.env.MAXMIND_LICENSE_KEY;
const MAXMIND_EDITION_ID = 'GeoLite2-City';
const MAXMIND_DOWNLOAD_URL = `https://download.maxmind.com/app/geoip_download?edition_id=${MAXMIND_EDITION_ID}&license_key=${MAXMIND_LICENSE_KEY}&suffix=tar.gz`;

/**
 * 确保数据目录存在
 */
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`✅ 创建数据目录: ${DATA_DIR}`);
  }
}

/**
 * 下载 GeoLite2 数据库
 */
function downloadGeoLite2() {
  return new Promise((resolve, reject) => {
    // 检查 License Key
    if (!MAXMIND_LICENSE_KEY) {
      console.error('❌ 错误: 未设置 MAXMIND_LICENSE_KEY 环境变量');
      console.log('\n请按以下步骤操作:');
      console.log('1. 注册 MaxMind 账号: https://www.maxmind.com/en/geolite2/signup');
      console.log('2. 生成 License Key: https://www.maxmind.com/en/accounts/current/license-key');
      console.log('3. 设置环境变量: MAXMIND_LICENSE_KEY=your_license_key');
      console.log('4. 重新运行脚本\n');
      console.log('或者使用免费备用方案:');
      console.log('从 https://github.com/P3TERX/GeoLite.mmdb/releases 下载并放置到 data/ 目录\n');
      process.exit(1);
    }

    console.log('📥 开始下载 GeoLite2-City 数据库...');
    console.log(`下载地址: ${MAXMIND_DOWNLOAD_URL.replace(MAXMIND_LICENSE_KEY, '***')}`);

    const tempFile = path.join(DATA_DIR, 'GeoLite2-City.tar.gz');
    const fileStream = fs.createWriteStream(tempFile);

    https.get(MAXMIND_DOWNLOAD_URL, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`下载失败，状态码: ${response.statusCode}`));
        return;
      }

      const totalBytes = parseInt(response.headers['content-length'], 10);
      let downloadedBytes = 0;

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const progress = ((downloadedBytes / totalBytes) * 100).toFixed(2);
        process.stdout.write(`\r下载进度: ${progress}% (${(downloadedBytes / 1024 / 1024).toFixed(2)} MB / ${(totalBytes / 1024 / 1024).toFixed(2)} MB)`);
      });

      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        console.log('\n✅ 下载完成');
        resolve(tempFile);
      });
    }).on('error', (err) => {
      fs.unlinkSync(tempFile);
      reject(err);
    });
  });
}

/**
 * 解压数据库文件
 */
async function extractDatabase(tarFile) {
  console.log('📦 解压数据库文件...');

  try {
    // 解压 tar.gz
    await tar.x({
      file: tarFile,
      cwd: DATA_DIR,
    });

    // 查找 .mmdb 文件
    const files = fs.readdirSync(DATA_DIR);
    const geoDir = files.find(f => f.startsWith('GeoLite2-City_'));

    if (!geoDir) {
      throw new Error('未找到解压后的数据库目录');
    }

    const mmdbPath = path.join(DATA_DIR, geoDir, 'GeoLite2-City.mmdb');

    if (!fs.existsSync(mmdbPath)) {
      throw new Error('未找到 .mmdb 文件');
    }

    // 移动到目标位置
    if (fs.existsSync(DB_FILE)) {
      fs.unlinkSync(DB_FILE);
    }
    fs.renameSync(mmdbPath, DB_FILE);

    // 清理临时文件
    fs.unlinkSync(tarFile);
    fs.rmSync(path.join(DATA_DIR, geoDir), { recursive: true, force: true });

    console.log(`✅ 解压完成: ${DB_FILE}`);

    // 显示文件信息
    const stats = fs.statSync(DB_FILE);
    console.log(`📊 数据库大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📅 更新时间: ${stats.mtime.toLocaleString('zh-CN')}`);

  } catch (error) {
    throw new Error(`解压失败: ${error.message}`);
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log('🌍 MaxMind GeoLite2 数据库下载工具\n');

    ensureDataDir();

    // 检查是否已存在数据库
    if (fs.existsSync(DB_FILE)) {
      const stats = fs.statSync(DB_FILE);
      const daysSinceUpdate = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

      console.log(`📂 发现现有数据库:`);
      console.log(`   文件: ${DB_FILE}`);
      console.log(`   大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   更新时间: ${stats.mtime.toLocaleString('zh-CN')}`);
      console.log(`   距今: ${daysSinceUpdate.toFixed(0)} 天\n`);

      if (daysSinceUpdate < 7) {
        console.log('✅ 数据库较新（小于7天），无需更新');
        console.log('如需强制更新，请删除现有文件后重新运行\n');
        process.exit(0);
      }
    }

    // 下载并解压
    const tarFile = await downloadGeoLite2();
    await extractDatabase(tarFile);

    console.log('\n🎉 GeoLite2 数据库安装成功！');
    console.log('💡 建议每月运行一次此脚本以更新数据库\n');

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    process.exit(1);
  }
}

// 运行脚本
main();
