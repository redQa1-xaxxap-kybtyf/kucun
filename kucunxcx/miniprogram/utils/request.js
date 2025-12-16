"use strict";
// 网络请求封装
// 统一处理微信小程序的 wx.request
Object.defineProperty(exports, "__esModule", { value: true });
exports.hideGlobalLoading = hideGlobalLoading;
exports.showGlobalLoading = showGlobalLoading;
exports.request = request;
exports.get = get;
exports.post = post;
exports.put = put;
exports.del = del;
exports.patch = patch;
const api_1 = require("../config/api");
/**
 * 全局 loading 计数器
 * 用于管理多个并发请求/上传时的 loading 状态，避免「showLoading/hideLoading 必须配对」警告
 */
let loadingCount = 0;
let loadingVisible = false;
let loadingTitle = '加载中...';
let loadingMask = true;
/**
 * 显示全局 loading（支持计数）
 */
function showGlobalLoading(options) {
    const title = options && typeof options.title === 'string' && options.title.trim()
        ? options.title.trim()
        : '加载中...';
    const mask = options && typeof options.mask === 'boolean' ? options.mask : true;
    loadingCount++;
    loadingTitle = title;
    loadingMask = mask;
    if (!loadingVisible) {
        loadingVisible = true;
        wx.showLoading({ title: loadingTitle, mask: loadingMask });
        return;
    }
    try {
        wx.showLoading({ title: loadingTitle, mask: loadingMask });
    }
    catch (_a) {
        // ignore
    }
}
/**
 * 隐藏全局 loading（支持计数）
 */
function hideGlobalLoading() {
    if (loadingCount <= 0) {
        loadingCount = 0;
        return;
    }
    loadingCount--;
    if (loadingCount === 0 && loadingVisible) {
        loadingVisible = false;
        wx.hideLoading();
    }
}
/**
 * 构建完整 URL（带查询参数）
 */
function buildURL(url, params) {
    if (!params || Object.keys(params).length === 0) {
        return url;
    }
    const queryString = Object.entries(params)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&');
    return queryString ? `${url}?${queryString}` : url;
}
/**
 * 规范化请求头
 * - 过滤掉 undefined / null
 * - 确保值为字符串（微信小程序要求 header 值为 string）
 */
function normalizeHeaders(headers) {
    const result = {};
    for (const key of Object.keys(headers)) {
        const value = headers[key];
        if (value === undefined || value === null)
            continue;
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
    }
    catch (error) {
        console.error('获取 Token 失败:', error);
        return null;
    }
}
/**
 * 统一请求方法
 */
function request(config) {
    return new Promise((resolve, reject) => {
        const { url, method = 'GET', data, params, headers = {}, timeout = api_1.apiConfig.timeout, needAuth = true, autoRedirectOn401 = true, } = config;
        // 构建完整 URL
        const fullURL = api_1.apiConfig.baseURL + buildURL(url, params);
        // 构建请求头（过滤 undefined/null，保证值为字符串）
        const requestHeaders = normalizeHeaders({
            ...api_1.DEFAULT_HEADERS,
            // 标记来源为小程序，便于后端中间件区分游客接口
            'x-client-from': 'mini-program',
            ...headers,
        });
        // 如果需要认证，添加 Token
        if (needAuth) {
            const token = getToken();
            if (token) {
                requestHeaders['Authorization'] = `Bearer ${token}`;
                // 兼容部分代理/网关可能不透传 Authorization 头的情况
                requestHeaders['x-mini-token'] = token;
            }
        }
        // 显示加载提示（全局计数器管理）
        showGlobalLoading({ title: '加载中...', mask: true });
        // 发起请求
        const requestOptions = {
            url: fullURL,
            method,
            data,
            header: requestHeaders,
            success(res) {
                // HTTP 状态码检查
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const raw = res.data;
                    // 兼容两种返回格式：
                    // 1) 标准格式：{ success, data, error, message }
                    // 2) 直接返回业务数据（数组 / 对象 / 原始类型）
                    if (raw && typeof raw === 'object' && 'success' in raw) {
                        const response = raw;
                        if (response.success) {
                            // 如果有 data 字段，返回 data；否则返回整个 response
                            resolve((response.data !== undefined
                                ? response.data
                                : response));
                        }
                        else {
                            const error = response.error || response.message || '请求失败';
                            wx.showToast({
                                title: error,
                                icon: 'none',
                                duration: 2000,
                            });
                            reject(new Error(error));
                        }
                    }
                    else {
                        // 非标准格式：直接将后端返回的数据透传给调用方
                        resolve(raw);
                    }
                }
                else if (res.statusCode === 401) {
                    // 401 特殊处理：
                    // - 对于小程序登录接口 /auth/mini-login，401 表示“用户名或密码错误”等业务错误
                    // - 对于其他接口，仍然按照“未认证”处理
                    if (url.indexOf('/auth/mini-login') !== -1) {
                        let errorMsg = '用户名或密码错误';
                        try {
                            const raw = res.data;
                            if (raw && typeof raw === 'object') {
                                const serverError = raw.error ||
                                    raw.message;
                                if (serverError && serverError.trim().length > 0) {
                                    errorMsg = serverError;
                                }
                            }
                        }
                        catch {
                            // 解析失败保留默认提示
                        }
                        wx.showToast({
                            title: errorMsg,
                            icon: 'none',
                        });
                        reject(new Error(errorMsg));
                        return;
                    }
                    // 未认证（全局接口）
                    wx.showToast({
                        title: '请先登录',
                        icon: 'none',
                    });
                    // 清除 token
                    wx.removeStorageSync(api_1.TOKEN_KEY);
                    // 根据配置决定是否自动跳转到登录页
                    if (autoRedirectOn401) {
                        wx.redirectTo({
                            url: '/pages/auth/login',
                        });
                    }
                    reject(new Error('未认证'));
                }
                else if (res.statusCode === 403) {
                    // 无权限
                    wx.showToast({
                        title: '无权访问',
                        icon: 'none',
                    });
                    reject(new Error('无权限'));
                }
                else {
                    // 其他错误（包含 400 / 422 / 500 等）
                    // 尝试解析后端返回的错误信息，优先展示具体的 error/message
                    let errorMsg = `请求失败 (${res.statusCode})`;
                    try {
                        const raw = res.data;
                        if (raw && typeof raw === 'object') {
                            const serverError = raw.error ||
                                raw.message;
                            if (serverError && serverError.trim().length > 0) {
                                errorMsg = serverError;
                            }
                        }
                    }
                    catch {
                        // 解析失败时，保留默认文案
                    }
                    wx.showToast({
                        title: errorMsg,
                        icon: 'none',
                    });
                    reject(new Error(errorMsg));
                }
            },
            fail(error) {
                const rawErrMsg = String(error?.errMsg || '');
                console.error('请求失败:', {
                    url: fullURL,
                    errMsg: rawErrMsg,
                    error,
                });
                // 判断错误类型（尽量给出可操作提示）
                let errorMessage = '网络请求失败';
                if (rawErrMsg.includes('timeout')) {
                    errorMessage = '请求超时';
                }
                else if (rawErrMsg.includes('url not in domain list')) {
                    errorMessage = '域名未配置为小程序 request 合法域名';
                }
                else if (rawErrMsg.toLowerCase().includes('ssl') ||
                    rawErrMsg.toLowerCase().includes('hand shake')) {
                    errorMessage = 'HTTPS 证书/协议异常';
                }
                else if (rawErrMsg.includes('fail')) {
                    errorMessage = '网络连接失败';
                }
                wx.showToast({
                    title: errorMessage,
                    icon: 'none',
                    duration: 2000,
                });
                reject(new Error(errorMessage));
            },
            complete() {
                // 始终关闭加载中提示（全局计数器管理）
                hideGlobalLoading();
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
    return request({
        url,
        method: 'GET',
        params,
        ...config,
    });
}
/**
 * POST 请求
 */
function post(url, data, config) {
    return request({
        url,
        method: 'POST',
        data,
        ...config,
    });
}
/**
 * PUT 请求
 */
function put(url, data, config) {
    return request({
        url,
        method: 'PUT',
        data,
        ...config,
    });
}
/**
 * DELETE 请求
 */
function del(url, config) {
    return request({
        url,
        method: 'DELETE',
        ...config,
    });
}
/**
 * PATCH 请求
 */
function patch(url, data, config) {
    return request({
        url,
        method: 'PATCH',
        data,
        ...config,
    });
}
