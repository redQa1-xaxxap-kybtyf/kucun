// app.ts

// 微信小程序运行环境默认没有 URLSearchParams
// 这里做一个非常轻量的兼容实现，避免第三方/旧代码调用时报错
if (typeof URLSearchParams === 'undefined') {
  class SimpleURLSearchParams {
    private params: [string, string][] = [];

    constructor(init?: Record<string, unknown> | string) {
      if (init && typeof init === 'object' && !Array.isArray(init)) {
        Object.keys(init).forEach(key => {
          const value = (init as Record<string, unknown>)[key];
          if (value !== undefined && value !== null) {
            this.append(key, String(value));
          }
        });
      }
    }

    append(key: string, value: string) {
      this.params.push([key, value]);
    }

    toString() {
      return this.params
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
    }
  }

  const globalObj: any =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof global !== 'undefined'
        ? global
        : typeof wx !== 'undefined'
          ? wx
          : {};

  globalObj.URLSearchParams = SimpleURLSearchParams;
}

App<IAppOption>({
  globalData: {},
  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || [];
    logs.unshift(Date.now());
    wx.setStorageSync('logs', logs);

    // 登录
    wx.login({
      success: res => {
        console.log(res.code);
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
      },
    });
  },
});
