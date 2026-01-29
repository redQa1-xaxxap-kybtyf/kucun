// app.ts

// 微信小程序运行环境默认没有 URLSearchParams
// 这里做一个非常轻量的兼容实现，避免第三方/旧代码调用时报错
const globalObj: any =
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof wx !== 'undefined'
      ? wx
      : {};

if (typeof globalObj.URLSearchParams === 'undefined') {
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

  globalObj.URLSearchParams = SimpleURLSearchParams;
}

import type { ColumnBuildState, GenerateSchemeResponse } from './types/column';

App<IAppOption>({
  globalData: {
    // 罗马柱拼柱状态
    columnBuildState: undefined as ColumnBuildState | undefined,
    // 罗马柱方案结果
    columnSchemeResult: undefined as GenerateSchemeResponse | undefined,
  },
  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || [];
    logs.unshift(Date.now());
    wx.setStorageSync('logs', logs);

    // 登录
    wx.login({
      success: () => {
        // 预留：可在此处调用后端接口，用 res.code 换取 openId/sessionKey
      },
    });
  },
});
