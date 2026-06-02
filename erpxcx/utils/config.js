const LOCAL_API_BASE_URL = 'http://127.0.0.1:3000';
const PRODUCTION_API_BASE_URL = 'https://kucun.0595t.com';

function getMiniProgramEnvVersion() {
  if (typeof wx === 'undefined' || typeof wx.getAccountInfoSync !== 'function') {
    return 'release';
  }

  try {
    return wx.getAccountInfoSync().miniProgram.envVersion || 'release';
  } catch (_error) {
    return 'release';
  }
}

const config = {
  // 开发版默认请求本机 ERP；体验版/正式版请求线上域名。
  // 微信开发者工具里 127.0.0.1 比 localhost 更稳定；真机预览要改成电脑局域网 IP 或线上域名。
  apiBaseUrl:
    getMiniProgramEnvVersion() === 'develop'
      ? LOCAL_API_BASE_URL
      : PRODUCTION_API_BASE_URL,
  localApiBaseUrl: LOCAL_API_BASE_URL,
  productionApiBaseUrl: PRODUCTION_API_BASE_URL,
};

module.exports = config;
