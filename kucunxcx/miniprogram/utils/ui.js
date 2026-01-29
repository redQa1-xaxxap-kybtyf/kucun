'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.getEnableBackdropBlur = getEnableBackdropBlur;
const ANDROID_BLUR_BENCHMARK_MIN = 30;
let cachedEnableBackdropBlur;
function getEnableBackdropBlur() {
  if (cachedEnableBackdropBlur !== undefined) {
    return cachedEnableBackdropBlur;
  }
  try {
    const deviceInfo =
      typeof wx.getDeviceInfo === 'function' ? wx.getDeviceInfo() : null;
    let platform = deviceInfo?.platform;
    let benchmarkLevel =
      typeof deviceInfo?.benchmarkLevel === 'number'
        ? deviceInfo.benchmarkLevel
        : undefined;
    // 兜底：在不支持 getDeviceInfo 的基础库上，尝试用 getSystemInfoSync（已弃用，但仅在兜底时使用）
    if (!platform || benchmarkLevel === undefined) {
      try {
        const systemInfo = wx.getSystemInfoSync();
        platform = platform || systemInfo.platform;
        if (
          benchmarkLevel === undefined &&
          typeof systemInfo.benchmarkLevel === 'number'
        ) {
          benchmarkLevel = systemInfo.benchmarkLevel;
        }
      } catch (_error) {
        // ignore
      }
    }
    // iOS / DevTools：默认开启，Android：仅高性能设备开启
    if (platform === 'android') {
      cachedEnableBackdropBlur =
        (benchmarkLevel ?? -1) >= ANDROID_BLUR_BENCHMARK_MIN;
      return cachedEnableBackdropBlur;
    }
    cachedEnableBackdropBlur = true;
    return cachedEnableBackdropBlur;
  } catch (_error) {
    // 获取设备信息失败时，保守兜底：开启（避免页面样式异常）
    cachedEnableBackdropBlur = true;
    return cachedEnableBackdropBlur;
  }
}
