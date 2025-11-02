/* eslint-disable no-console */
// cspell: ignore shipxy chinaports vesselfinder

/**
 * 更新通用选择器配置脚本
 * 为现有站点应用智能多层级选择器
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 通用多层级选择器配置
const UNIVERSAL_SELECTORS = {
  // 搜索框选择器（按优先级排序）
  searchInputSelector: `input[type="text"], input[name*="search"], input[name*="keyword"],
    input[placeholder*="搜索"], input[placeholder*="船"], #txtKey, #keyword`,

  // 搜索按钮选择器
  searchButtonSelector: `button[type="submit"], button[class*="search"],
    input[type="submit"], button[title*="搜索"], .search-btn`,

  // 结果容器选择器
  resultContainerSelector: `table, .result-container, .search-result,
    [id*="result"], [class*="result"], main, section`,

  // 数据提取选择器（多层级）
  extractSelectors: JSON.stringify({
    status: [
      'tr:contains("状态：") + td',
      'tr:contains("Status") + td',
      'td:contains("状态") + td',
      '[data-vessel-status]',
      '.vessel-status',
      '[class*="status"]',
      'div:contains("Status") + div'
    ],
    destination: [
      'tr:contains("目的地：") + td',
      'tr:contains("Destination") + td',
      'td:contains("目的地") + td',
      '[data-destination]',
      '.destination',
      '[class*="destination"]',
      'div:contains("Destination") + div'
    ],
    estimatedArrival: [
      'tr:contains("预到时间：") + td',
      'tr:contains("ETA") + td',
      'tr:contains("预计到达") + td',
      '[data-eta]',
      '.eta',
      '[class*="eta"]',
      'div:contains("ETA") + div',
      'time[datetime]'
    ],
    updateTime: [
      'tr:contains("更新时间：") + td',
      'tr:contains("Last Update") + td',
      'td:contains("更新时间") + td',
      '[data-last-update]',
      '.last-update',
      '[class*="update"]',
      'div:contains("Last") div:contains("update")',
      'time[title*="update"]'
    ]
  })
};

/**
 * 更新所有站点为通用选择器配置
 */
async function updateUniversalSelectors() {
  console.log('🔧 开始更新通用选择器配置...');

  try {
    // 1. 获取所有站点
    const allSites = await prisma.shippingSite.findMany();
    console.log(`📋 找到 ${allSites.length} 个站点`);

    // 2. 批量更新站点配置
    let updateCount = 0;

    for (const site of allSites) {
      console.log(`🔄 更新站点: ${site.name} (${site.url})`);

      await prisma.shippingSite.update({
        where: { id: site.id },
        data: {
          searchInputSelector: UNIVERSAL_SELECTORS.searchInputSelector,
          searchButtonSelector: UNIVERSAL_SELECTORS.searchButtonSelector,
          resultContainerSelector: UNIVERSAL_SELECTORS.resultContainerSelector,
          extractSelectors: UNIVERSAL_SELECTORS.extractSelectors,
          updatedAt: new Date(),
        },
      });

      console.log(`✅ 已更新: ${site.name}`);
      updateCount++;
    }

    console.log(`🎉 通用选择器配置更新完成！`);
    console.log(`📊 更新统计:`);
    console.log(`   - 总站点数: ${allSites.length}`);
    console.log(`   - 更新站点: ${updateCount}`);

  } catch (error) {
    console.error('❌ 更新��程中出现错误:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 智能检测网站类型并优化选择器
 */
async function optimizeSelectorsBySiteType() {
  console.log('🧠 开始智能优化选择器...');

  try {
    const sites = await prisma.shippingSite.findMany();

    for (const site of sites) {
      const url = site.url.toLowerCase();
      const optimizedSelectors = { ...UNIVERSAL_SELECTORS };

      // 根据网站类型优化选择器
      if (url.includes('shipxy.com')) {
        // shipxy.com 特定优化
        optimizedSelectors.searchInputSelector = '#txtKey, input[placeholder*="船舶"]';
        optimizedSelectors.searchButtonSelector = ''; // shipxy.com使用Enter键
        optimizedSelectors.resultContainerSelector = 'table, #shipAIS';
      } else if (url.includes('chinaports.com')) {
        // chinaports.com 特定优化
        optimizedSelectors.searchInputSelector = 'input[placeholder*="船名"]';
        optimizedSelectors.searchButtonSelector = 'button';
      } else if (url.includes('vesselfinder.com')) {
        // vesselfinder.com 特定优化
        optimizedSelectors.searchInputSelector = 'input[type="search"]';
        optimizedSelectors.resultContainerSelector = '.vessel-details, .result-container';
      }

      // 更新站点配置
      await prisma.shippingSite.update({
        where: { id: site.id },
        data: {
          searchInputSelector: optimizedSelectors.searchInputSelector,
          searchButtonSelector: optimizedSelectors.searchButtonSelector,
          resultContainerSelector: optimizedSelectors.resultContainerSelector,
          extractSelectors: optimizedSelectors.extractSelectors,
        },
      });

      console.log(`✅ 已优化: ${site.name} (${site.url})`);
    }

    console.log('🎉 选择器智能优化完成！');

  } catch (error) {
    console.error('❌ 优化过程中出现错误:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 验证选择器配置
 */
async function validateSelectors() {
  console.log('✅ 开始验证选择器配置...');

  try {
    const sites = await prisma.shippingSite.findMany({
      select: {
        id: true,
        name: true,
        url: true,
        searchInputSelector: true,
        searchButtonSelector: true,
        resultContainerSelector: true,
        extractSelectors: true,
      },
    });

    let validCount = 0;
    let invalidCount = 0;

    for (const site of sites) {
      try {
        // 验证提取选择器JSON格式
        JSON.parse(site.extractSelectors);

        // 验证选择器基本语法
        const basicSelectors = [
          site.searchInputSelector,
          site.searchButtonSelector,
          site.resultContainerSelector
        ];

        let isValid = true;
        for (const selector of basicSelectors) {
          if (!isValidSelector(selector)) {
            isValid = false;
            break;
          }
        }

        if (isValid) {
          validCount++;
          console.log(`✅ 有效配置: ${site.name}`);
        } else {
          invalidCount++;
          console.log(`❌ 无效配置: ${site.name}`);
        }
      } catch (error) {
        invalidCount++;
        console.log(`❌ 配置错误: ${site.name} - ${error}`);
      }
    }

    console.log(`📊 验证结果:`);
    console.log(`   - 有效配置: ${validCount}`);
    console.log(`   - 无效配置: ${invalidCount}`);
    console.log(`   - 总配置数: ${sites.length}`);

  } catch (error) {
    console.error('❌ 验证过程中出现错误:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 基本的选择器验证
 */
function isValidSelector(selector: string): boolean {
  try {
    if (!selector || selector.trim() === '') {
      return true; // 空选择器是允许的
    }

    // 基本的CSS选择器验证
    const validPattern = /^[#.]?[\w-]+(\s*[>+~\s]+[#.]?[\w-]+)*(\s*\[[\w-]+([\"']?)[^\"']*\1\])*(\s*:[\w-]+)*$/;

    // 支持逗号分隔的多选择器
    const selectors = selector.split(',').map(s => s.trim());

    return selectors.every(s => validPattern.test(s) || s.includes(':contains('));
  } catch {
    return false;
  }
}

// 主执行函数
async function main() {
  const action = process.argv[2];

  switch (action) {
    case 'update':
      await updateUniversalSelectors();
      break;
    case 'optimize':
      await optimizeSelectorsBySiteType();
      break;
    case 'validate':
      await validateSelectors();
      break;
    case 'all':
      console.log('🚀 执行完整的配置更新流程...');
      await updateUniversalSelectors();
      await optimizeSelectorsBySiteType();
      await validateSelectors();
      break;
    default:
      console.log('用法:');
      console.log('  node update-universal-selectors.js update   - 更新通用选择器');
      console.log('  node update-universal-selectors.js optimize - 智能优化选择器');
      console.log('  node update-universal-selectors.js validate - 验证选择器配置');
      console.log('  node update-universal-selectors.js all      - 执行完整流程');
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main()
    .then(() => {
      console.log('✅ 脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 脚本执行失败:', error);
      process.exit(1);
    });
}

export { updateUniversalSelectors, optimizeSelectorsBySiteType, validateSelectors };
