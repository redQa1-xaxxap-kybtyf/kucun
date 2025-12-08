'use strict';
// 网络请求封装
// 统一处理微信小程序的 wx.request
var __assign =
  (this && this.__assign) ||
  function () {
    __assign =
      Object.assign ||
      function (t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s)
            if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
      };
    return __assign.apply(this, arguments);
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.request = request;
exports.get = get;
exports.post = post;
exports.put = put;
exports.del = del;
exports.patch = patch;
var api_1 = require('../config/api');
/**
 * 构建完整 URL（带查询参数）
 */
function buildURL(url, params) {
  if (!params || Object.keys(params).length === 0) {
    return url;
  }
  var queryString = Object.entries(params)
    .filter(function (_a) {
      var _ = _a[0],
        value = _a[1];
      return value !== undefined && value !== null;
    })
    .map(function (_a) {
      var key = _a[0],
        value = _a[1];
      return ''
        .concat(encodeURIComponent(key), '=')
        .concat(encodeURIComponent(String(value)));
    })
    .join('&');
  return queryString ? ''.concat(url, '?').concat(queryString) : url;
}
/**
 * 规范化请求头
 * - 过滤掉 undefined / null
 * - 确保值为字符串（微信小程序要求 header 值为 string）
 */
function normalizeHeaders(headers) {
  var result = {};
  for (var _i = 0, _a = Object.keys(headers); _i < _a.length; _i++) {
    var key = _a[_i];
    var value = headers[key];
    if (value === undefined || value === null) continue;
    result[key] = String(value);
  }
  return result;
}
/**
 * 获取存储的 Token
 */
function getToken() {
  try {
    return wx.getStorageSync(api_1.TOKEN_KEY);
  } catch (error) {
    console.error('获取 Token 失败:', error);
    return null;
  }
}
/**
 * 统一请求方法
 */
function request(config) {
  return new Promise(function (resolve, reject) {
    var url = config.url,
      _a = config.method,
      method = _a === void 0 ? 'GET' : _a,
      data = config.data,
      params = config.params,
      _b = config.headers,
      headers = _b === void 0 ? {} : _b,
      _c = config.timeout,
      timeout = _c === void 0 ? api_1.apiConfig.timeout : _c,
      _d = config.needAuth,
      needAuth = _d === void 0 ? true : _d;
    // 构建完整 URL
    var fullURL = api_1.apiConfig.baseURL + buildURL(url, params);
    // 构建请求头（过滤 undefined/null，保证值为字符串）
    var requestHeaders = normalizeHeaders(
      __assign(__assign({}, api_1.DEFAULT_HEADERS), headers)
    );
    // 如果需要认证，添加 Token
    if (needAuth) {
      var token = getToken();
      if (token) {
        requestHeaders['Authorization'] = 'Bearer '.concat(token);
      }
    }
    // 显示加载提示
    wx.showLoading({
      title: '加载中...',
      mask: true,
    });
    // 发起请求
    var requestOptions = {
      url: fullURL,
      method: method,
      data: data,
      header: requestHeaders,
      success: function (res) {
        // HTTP 状态码检查
        if (res.statusCode >= 200 && res.statusCode < 300) {
          var raw = res.data;
          // 兼容两种返回格式：
          // 1) 标准格式：{ success, data, error, message }
          // 2) 直接返回业务数据（数组 / 对象 / 原始类型）
          if (raw && typeof raw === 'object' && 'success' in raw) {
            var response = raw;
            if (response.success) {
              // 如果有 data 字段，返回 data；否则返回整个 response
              resolve(response.data !== undefined ? response.data : response);
            } else {
              var error = response.error || response.message || '请求失败';
              wx.showToast({
                title: error,
                icon: 'none',
                duration: 2000,
              });
              reject(new Error(error));
            }
          } else {
            // 非标准格式：直接将后端返回的数据透传给调用方
            resolve(raw);
          }
        } else if (res.statusCode === 401) {
          // 未认证 - 跳转登录页
          wx.showToast({
            title: '请先登录',
            icon: 'none',
          });
          // 清除 token
          wx.removeStorageSync(api_1.TOKEN_KEY);
          // 跳转登录页（根据实际路径调整）
          wx.redirectTo({
            url: '/pages/auth/login',
          });
          reject(new Error('未认证'));
        } else if (res.statusCode === 403) {
          // 无权限
          wx.showToast({
            title: '无权访问',
            icon: 'none',
          });
          reject(new Error('无权限'));
        } else {
          // 其他错误
          var errorMsg = '\u8BF7\u6C42\u5931\u8D25 ('.concat(
            res.statusCode,
            ')'
          );
          wx.showToast({
            title: errorMsg,
            icon: 'none',
          });
          reject(new Error(errorMsg));
        }
      },
      fail: function (error) {
        console.error('请求失败:', error);
        // 判断错误类型
        var errorMessage = '网络请求失败';
        if (error.errMsg) {
          if (error.errMsg.includes('timeout')) {
            errorMessage = '请求超时';
          } else if (error.errMsg.includes('fail')) {
            errorMessage = '网络连接失败';
          }
        }
        wx.showToast({
          title: errorMessage,
          icon: 'none',
          duration: 2000,
        });
        reject(new Error(errorMessage));
      },
      complete: function () {
        // 始终关闭加载中提示，避免遗漏
        wx.hideLoading();
      },
    };
    // 仅在配置了超时时间时设置，避免传入 undefined
    if (typeof timeout === 'number' && timeout > 0) {
      requestOptions.timeout = timeout;
    }
    wx.request(requestOptions);
  });
}
/**
 * GET 请求
 */
function get(url, params, config) {
  return request(__assign({ url: url, method: 'GET', params: params }, config));
}
/**
 * POST 请求
 */
function post(url, data, config) {
  return request(__assign({ url: url, method: 'POST', data: data }, config));
}
/**
 * PUT 请求
 */
function put(url, data, config) {
  return request(__assign({ url: url, method: 'PUT', data: data }, config));
}
/**
 * DELETE 请求
 */
function del(url, config) {
  return request(__assign({ url: url, method: 'DELETE' }, config));
}
/**
 * PATCH 请求
 */
function patch(url, data, config) {
  return request(__assign({ url: url, method: 'PATCH', data: data }, config));
}
