/**
 * 登录功能端到端测试脚本
 * 使用 Playwright 进行浏览器自动化测试
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:3003';
const LOGIN_URL = `${BASE_URL}/auth/signin`;

// 测试账户
const TEST_ACCOUNTS = {
  admin: { username: 'admin', password: 'admin123456' },
  sales: { username: 'sales', password: 'sales123456' },
};

// 测试结果收集
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: [],
};

// 添加测试结果
function addTestResult(name, passed, message, screenshot = null) {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${name}`);
  } else {
    testResults.failed++;
    console.error(`❌ ${name}: ${message}`);
  }
  testResults.details.push({ name, passed, message, screenshot });
}

// 等待函数
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 主测试函数
async function runE2ETests() {
  console.log('='.repeat(80));
  console.log('登录功能端到端测试');
  console.log(`测试时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log('='.repeat(80));
  console.log('');

  let browser;
  let context;
  let page;

  try {
    // 启动浏览器
    console.log('🚀 启动浏览器...');
    browser = await chromium.launch({ headless: false });
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    page = await context.newPage();

    // 测试 1: 访问登录页面
    console.log('\n📝 测试 1: 访问登录页面');
    try {
      await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });
      await page.waitForSelector('input[name="username"]', { timeout: 5000 });
      await page.screenshot({ path: 'test-screenshots/01-login-page.png' });
      addTestResult('访问登录页面', true, '页面加载成功');
    } catch (error) {
      addTestResult('访问登录页面', false, error.message);
      throw error;
    }

    // 测试 2: 正常登录流程
    console.log('\n📝 测试 2: 正常登录流程');
    try {
      await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });
      await wait(1000);

      // 填写用户名和密码
      await page.fill('input[name="username"]', TEST_ACCOUNTS.admin.username);
      await page.fill('input[name="password"]', TEST_ACCOUNTS.admin.password);

      // 等待验证码加载
      await wait(1000);
      await page.screenshot({ path: 'test-screenshots/02-before-login.png' });

      // 获取验证码文本 (这里需要手动输入或使用 OCR)
      console.log('   ⚠️  需要手动输入验证码');
      addTestResult(
        '正常登录流程',
        false,
        '需要手动输入验证码,自动化测试无法完成'
      );
    } catch (error) {
      addTestResult('正常登录流程', false, error.message);
    }

    // 测试 3: 用户名不存在
    console.log('\n📝 测试 3: 用户名不存在');
    try {
      await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });
      await wait(1000);

      await page.fill('input[name="username"]', 'nonexistent_user');
      await page.fill('input[name="password"]', 'wrong_password');
      await page.fill('input[name="captcha"]', '1234'); // 假设验证码

      await page.screenshot({
        path: 'test-screenshots/03-before-invalid-username.png',
      });

      await page.click('button[type="submit"]');
      await wait(2000);

      await page.screenshot({
        path: 'test-screenshots/03-after-invalid-username.png',
      });

      // 检查错误提示
      const errorText = await page.textContent('.text-red-500, .text-destructive');
      if (errorText && errorText.includes('用户名或密码错误')) {
        addTestResult('用户名不存在', true, '错误提示正确');
      } else {
        addTestResult('用户名不存在', false, `错误提示不正确: ${errorText}`);
      }
    } catch (error) {
      addTestResult('用户名不存在', false, error.message);
    }

    // 测试 4: 密码错误
    console.log('\n📝 测试 4: 密码错误');
    try {
      await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });
      await wait(1000);

      await page.fill('input[name="username"]', TEST_ACCOUNTS.admin.username);
      await page.fill('input[name="password"]', 'wrong_password');
      await page.fill('input[name="captcha"]', '1234');

      await page.screenshot({
        path: 'test-screenshots/04-before-wrong-password.png',
      });

      await page.click('button[type="submit"]');
      await wait(2000);

      await page.screenshot({
        path: 'test-screenshots/04-after-wrong-password.png',
      });

      const errorText = await page.textContent('.text-red-500, .text-destructive');
      if (errorText && errorText.includes('用户名或密码错误')) {
        addTestResult('密码错误', true, '错误提示正确');
      } else {
        addTestResult('密码错误', false, `错误提示不正确: ${errorText}`);
      }
    } catch (error) {
      addTestResult('密码错误', false, error.message);
    }

    // 测试 5: 验证码错误
    console.log('\n📝 测试 5: 验证码错误');
    try {
      await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });
      await wait(1000);

      await page.fill('input[name="username"]', TEST_ACCOUNTS.admin.username);
      await page.fill('input[name="password"]', TEST_ACCOUNTS.admin.password);
      await page.fill('input[name="captcha"]', 'WRONG');

      await page.screenshot({
        path: 'test-screenshots/05-before-wrong-captcha.png',
      });

      await page.click('button[type="submit"]');
      await wait(2000);

      await page.screenshot({
        path: 'test-screenshots/05-after-wrong-captcha.png',
      });

      const errorText = await page.textContent('.text-red-500, .text-destructive');
      if (errorText && errorText.includes('验证码')) {
        addTestResult('验证码错误', true, '错误提示正确');
      } else {
        addTestResult('验证码错误', false, `错误提示不正确: ${errorText}`);
      }
    } catch (error) {
      addTestResult('验证码错误', false, error.message);
    }

    // 测试 6: 登录失败次数限制
    console.log('\n📝 测试 6: 登录失败次数限制 (5次)');
    try {
      for (let i = 1; i <= 6; i++) {
        await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });
        await wait(1000);

        await page.fill('input[name="username"]', 'test_limit_user');
        await page.fill('input[name="password"]', 'wrong_password');
        await page.fill('input[name="captcha"]', '1234');

        if (i === 6) {
          await page.screenshot({
            path: 'test-screenshots/06-before-rate-limit.png',
          });
        }

        await page.click('button[type="submit"]');
        await wait(2000);

        if (i === 6) {
          await page.screenshot({
            path: 'test-screenshots/06-after-rate-limit.png',
          });

          const errorText = await page.textContent(
            '.text-red-500, .text-destructive'
          );
          if (errorText && errorText.includes('次数过多')) {
            addTestResult('登录失败次数限制', true, '限制功能正常');
          } else {
            addTestResult(
              '登录失败次数限制',
              false,
              `错误提示不正确: ${errorText}`
            );
          }
        }
      }
    } catch (error) {
      addTestResult('登录失败次数限制', false, error.message);
    }

    // 等待查看结果
    console.log('\n⏳ 等待 5 秒以便查看结果...');
    await wait(5000);
  } catch (error) {
    console.error('\n❌ 测试执行失败:', error);
  } finally {
    // 关闭浏览器
    if (browser) {
      await browser.close();
    }
  }

  // 输出测试结果
  console.log('\n' + '='.repeat(80));
  console.log('测试结果汇总');
  console.log('='.repeat(80));
  console.log(`总测试数: ${testResults.total}`);
  console.log(`✅ 通过: ${testResults.passed}`);
  console.log(`❌ 失败: ${testResults.failed}`);
  console.log(
    `通过率: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`
  );
  console.log('\n详细结果:');
  testResults.details.forEach((result, index) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${index + 1}. ${icon} ${result.name}`);
    if (!result.passed) {
      console.log(`   原因: ${result.message}`);
    }
  });
  console.log('\n' + '='.repeat(80));
  console.log('测试完成!');
  console.log('='.repeat(80));

  return testResults;
}

// 运行测试
runE2ETests().catch(console.error);

