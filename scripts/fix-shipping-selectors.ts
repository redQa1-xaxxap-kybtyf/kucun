/* eslint-disable no-console */

// cSpell:ignore shipxy SHIPXY

/**
 * 修复运输站点选择器配置脚本
 * 将数据库中的错误选择器更新为正确的选择器
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 船舶网站专用选择器配置
const SHIPXY_SELECTORS = {
  url: 'https://www.shipxy.com/',
  searchInputSelector: '#txtKey',
  searchButtonSelector: '',
  resultContainerSelector: 'table',
  extractSelectors: JSON.stringify({
    status: '#si_shipStatus',
    destination: '#si_dest',
    estimatedArrival: '#si__eta',
    updateTime: '#si_updateTime',
  }),
};

async function fixShippingSelectors() {
  console.log('🔧 开始修复运输站点选择器配置...');

  try {
    const shipxySites = await prisma.shippingSite.findMany({
      where: {
        OR: [
          { url: { contains: 'shipxy.com' } },
          { name: { contains: '船讯' } },
        ],
      },
    });

    console.log(`📋 找到 ${shipxySites.length} 个shipxy相关站点`);

    // 2. 更新shipxy站点配置
    for (const site of shipxySites) {
      console.log(`🔄 更新站点: ${site.name}`);

      await prisma.shippingSite.update({
        where: { id: site.id },
        data: {
          searchInputSelector: SHIPXY_SELECTORS.searchInputSelector,
          searchButtonSelector: SHIPXY_SELECTORS.searchButtonSelector,
          resultContainerSelector: SHIPXY_SELECTORS.resultContainerSelector,
          extractSelectors: SHIPXY_SELECTORS.extractSelectors,
        },
      });

      console.log(`✅ 已更新: ${site.name}`);
    }

    // 3. 查找所有使用错误通用选择器的站点
    const sitesWithWrongSelectors = await prisma.shippingSite.findMany({
      where: {
        OR: [
          { searchInputSelector: { contains: 'input[name*="search"]' } },
          { searchInputSelector: { contains: 'input[name*="keyword"]' } },
          { searchInputSelector: { contains: 'input[name*="tracking"]' } },
        ],
      },
    });

    console.log(`📋 找到 ${sitesWithWrongSelectors.length} 个使用错误选择器的站点`);

    // 4. 为这些站点生成更智能的选择器
    for (const site of sitesWithWrongSelectors) {
      console.log(`🔄 智能修复站点: ${site.name}`);

      // 基于URL推断更好的选择器
      let searchInputSelector = '#txtKey'; // 默认船舶网站选择器
      let searchButtonSelector = ''; // 默认使用回车键
      let resultContainerSelector = 'table'; // 默认表格容器

      if (site.url.includes('sf-express.com') || site.name.includes('顺丰')) {
        searchInputSelector = 'input[name="trackingNo"]';
        searchButtonSelector = 'button.search-btn';
        resultContainerSelector = '.tracking-result';
      } else if (site.url.includes('zto.com') || site.name.includes('中通')) {
        searchInputSelector = '#txtBill';
        searchButtonSelector = '#btnQuery';
        resultContainerSelector = '.result-area';
      } else if (site.url.includes('yto.net.cn') || site.name.includes('圆通')) {
        searchInputSelector = 'input[name="mailNo"]';
        searchButtonSelector = '.query-btn';
        resultContainerSelector = '.trace-list';
      }

      // 生成通用的��取选择器
      const extractSelectors = JSON.stringify({
        status: '[class*="status"], .status, td:contains("状态") + td',
        destination: '[class*="destination"], .location, td:contains("目的地") + td',
        estimatedArrival: '[class*="arrival"], [class*="eta"], td:contains("预到") + td',
        updateTime: '[class*="update"], [class*="time"], td:contains("更新") + td',
      });

      await prisma.shippingSite.update({
        where: { id: site.id },
        data: {
          searchInputSelector,
          searchButtonSelector,
          resultContainerSelector,
          extractSelectors,
        },
      });

      console.log(`✅ 已智能修复: ${site.name}`);
    }

    console.log('🎉 运输站点选择器配置修复完成！');

    // 5. 显示修复统计
    const totalSites = await prisma.shippingSite.count();
    const activeSites = await prisma.shippingSite.count({
      where: { status: 'active' }
    });

    console.log(`📊 修复统计:`);
    console.log(`   - 总站点数: ${totalSites}`);
    console.log(`   - 活跃站点: ${activeSites}`);
    console.log(`   - 修复站点: ${shipxySites.length + sitesWithWrongSelectors.length}`);

  } catch (error) {
    console.error('❌ 修复过程中出现错误:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  fixShippingSelectors()
    .then(() => {
      console.log('✅ 脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 脚本执行失败:', error);
      process.exit(1);
    });
}

export { fixShippingSelectors };
