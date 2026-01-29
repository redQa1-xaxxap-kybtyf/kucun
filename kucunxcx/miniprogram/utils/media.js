'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.appendMiniTokenForLocalUploads = appendMiniTokenForLocalUploads;
const api_1 = require('../config/api');
/**
 * 小程序 <image> 无法设置 header，本地兜底图片通过 /api/uploads/... 提供时，
 * 需要在 URL 上追加 mt=token（服务端会校验）。
 *
 * 注意：如果 URL 已包含 t/mt 参数，则不重复追加。
 */
function appendMiniTokenForLocalUploads(url) {
  if (!url) return url;
  // 仅处理本地兜底图片
  if (!url.includes('/api/uploads/')) return url;
  // 已有短期 token（t）或 mini token（mt）时不再追加
  if (/[?&](t|mt)=/.test(url)) return url;
  try {
    const token = wx.getStorageSync(api_1.TOKEN_KEY);
    if (!token) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}mt=${encodeURIComponent(token)}`;
  } catch (_error) {
    return url;
  }
}
