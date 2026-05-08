const DEFAULT_API_BASE_URL = 'http://localhost:3000';

export const config = {
  // 上线前改成 ERP 的 HTTPS 域名，并加入微信小程序 request 合法域名。
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL,
};

export default config;
