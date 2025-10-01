/**
 * 测试登录功能
 */

async function testLogin() {
  const baseUrl = 'http://localhost:3003';

  console.log('🧪 测试登录功能\n');

  try {
    // 1. 获取验证码
    console.log('1️⃣ 获取验证码...');
    const captchaResponse = await fetch(`${baseUrl}/api/captcha`);
    console.log('   状态码:', captchaResponse.status);
    console.log(
      '   Content-Type:',
      captchaResponse.headers.get('content-type')
    );

    if (!captchaResponse.ok) {
      console.error('   ❌ 获取验证码失败');
      const text = await captchaResponse.text();
      console.error('   响应内容:', text.substring(0, 200));
      return;
    }

    const captchaData = await captchaResponse.json();
    console.log('   ✅ 验证码获取成功');
    console.log('   Session ID:', captchaData.sessionId);
    console.log('   SVG 长度:', captchaData.captchaImage?.length || 0);

    // 2. 验证验证码 API
    console.log('\n2️⃣ 测试验证码验证 API...');
    const verifyResponse = await fetch(`${baseUrl}/api/captcha`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: captchaData.sessionId,
        captcha: 'TEST', // 故意输入错误的验证码
      }),
    });

    console.log('   状态码:', verifyResponse.status);
    console.log('   Content-Type:', verifyResponse.headers.get('content-type'));

    const verifyData = await verifyResponse.json();
    console.log('   响应:', verifyData);

    // 3. 测试登录 API (使用 signIn 方式)
    console.log('\n3️⃣ 测试登录 API (模拟前端 signIn)...');

    // 先获取 CSRF token
    const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
    const csrfData = await csrfResponse.json();
    console.log('   CSRF Token:', csrfData.csrfToken);

    // 使用正确的验证码进行登录测试
    // 注意:我们需要知道正确的验证码才能测试成功登录
    console.log('\n   ⚠️ 注意:由于验证码是随机生成的,这个测试会失败');
    console.log('   请在浏览器中手动测试登录功能');

    console.log('\n✅ 测试完成');
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error('   错误详情:', error);
  }
}

testLogin();
