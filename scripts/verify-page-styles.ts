/**
 * 验证页面样式脚本
 * 用于检查仓库进货页面和厂家发货页面的实际渲染样式差异
 */

import { chromium } from '@playwright/test';

async function verifyPageStyles() {
  console.log('🔍 开始验证页面样式...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. 检查厂家发货页面
    console.log('📦 检查厂家发货页面...');
    await page.goto('http://localhost:3000/factory-shipments');
    await page.waitForLoadState('networkidle');

    const factoryContainer = await page.locator('main > div').first();
    const factoryClasses = await factoryContainer.getAttribute('class');
    const factoryStyles = await factoryContainer.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        padding: computed.padding,
        paddingTop: computed.paddingTop,
        paddingRight: computed.paddingRight,
        paddingBottom: computed.paddingBottom,
        paddingLeft: computed.paddingLeft,
        margin: computed.margin,
        backgroundColor: computed.backgroundColor,
        display: computed.display,
      };
    });

    console.log('厂家发货页面容器:');
    console.log('  className:', factoryClasses);
    console.log('  计算样式:', JSON.stringify(factoryStyles, null, 2));
    console.log('');

    // 2. 检查仓库进货页面
    console.log('📥 检查仓库进货页面...');
    await page.goto('http://localhost:3000/inventory/inbound');
    await page.waitForLoadState('networkidle');

    const inboundContainer = await page.locator('main > div').first();
    const inboundClasses = await inboundContainer.getAttribute('class');
    const inboundStyles = await inboundContainer.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        padding: computed.padding,
        paddingTop: computed.paddingTop,
        paddingRight: computed.paddingRight,
        paddingBottom: computed.paddingBottom,
        paddingLeft: computed.paddingLeft,
        margin: computed.margin,
        backgroundColor: computed.backgroundColor,
        display: computed.display,
      };
    });

    console.log('仓库进货页面容器:');
    console.log('  className:', inboundClasses);
    console.log('  计算样式:', JSON.stringify(inboundStyles, null, 2));
    console.log('');

    // 3. 对比差异
    console.log('🔍 样式差异分析:');
    console.log('─'.repeat(60));

    if (factoryClasses !== inboundClasses) {
      console.log('❌ className 不一致!');
      console.log(`   厂家发货: "${factoryClasses}"`);
      console.log(`   仓库进货: "${inboundClasses}"`);
    } else {
      console.log('✅ className 一致:', factoryClasses);
    }

    console.log('');

    const styleKeys = Object.keys(factoryStyles) as Array<
      keyof typeof factoryStyles
    >;
    for (const key of styleKeys) {
      if (factoryStyles[key] !== inboundStyles[key]) {
        console.log(`❌ ${key} 不一致:`);
        console.log(`   厂家发货: ${factoryStyles[key]}`);
        console.log(`   仓库进货: ${inboundStyles[key]}`);
      }
    }

    // 4. 检查完整的 DOM 结构
    console.log('\n📋 完整 DOM 结构:');
    console.log('─'.repeat(60));

    const _factoryHTML = await page.goto(
      'http://localhost:3000/factory-shipments'
    );
    await page.waitForLoadState('networkidle');
    const factoryOuterHTML = await page
      .locator('main > div')
      .first()
      .evaluate(el => el.outerHTML.substring(0, 500));
    console.log('厂家发货页面 HTML (前500字符):');
    console.log(factoryOuterHTML);
    console.log('');

    await page.goto('http://localhost:3000/inventory/inbound');
    await page.waitForLoadState('networkidle');
    const inboundOuterHTML = await page
      .locator('main > div')
      .first()
      .evaluate(el => el.outerHTML.substring(0, 500));
    console.log('仓库进货页面 HTML (前500字符):');
    console.log(inboundOuterHTML);

    // 5. 检查是否有覆盖样式
    console.log('\n🎨 检查样式覆盖:');
    console.log('─'.repeat(60));

    await page.goto('http://localhost:3000/inventory/inbound');
    await page.waitForLoadState('networkidle');

    const styleSheets = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      const relevantRules: string[] = [];

      sheets.forEach(sheet => {
        try {
          const rules = Array.from(sheet.cssRules || []);
          rules.forEach(rule => {
            const cssText = rule.cssText;
            if (
              cssText.includes('space-y-6') ||
              cssText.includes('p-6') ||
              cssText.includes('main') ||
              cssText.includes('padding')
            ) {
              relevantRules.push(cssText);
            }
          });
        } catch (_e) {
          // 跨域样式表无法访问
        }
      });

      return relevantRules;
    });

    if (styleSheets.length > 0) {
      console.log('找到相关的 CSS 规则:');
      styleSheets.forEach((rule, index) => {
        console.log(`${index + 1}. ${rule}`);
      });
    } else {
      console.log('未找到覆盖 padding 或 space-y 的 CSS 规则');
    }

    console.log('\n✅ 验证完成!');
    console.log(
      '\n💡 提示: 浏览器窗口将保持打开，您可以手动检查页面。按 Ctrl+C 退出。'
    );

    // 保持浏览器打开，等待用户手动关闭
    await page.waitForTimeout(300000); // 5分钟
  } catch (error) {
    console.error('❌ 验证过程中出错:', error);
  } finally {
    await browser.close();
  }
}

// 运行验证
verifyPageStyles().catch(console.error);
