'use strict';
// 认证服务
// 封装所有认证相关的 API 请求
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __generator =
  (this && this.__generator) ||
  function (thisArg, body) {
    var _ = {
        label: 0,
        sent: function () {
          if (t[0] & 1) throw t[1];
          return t[1];
        },
        trys: [],
        ops: [],
      },
      f,
      y,
      t,
      g = Object.create(
        (typeof Iterator === 'function' ? Iterator : Object).prototype
      );
    return (
      (g.next = verb(0)),
      (g['throw'] = verb(1)),
      (g['return'] = verb(2)),
      typeof Symbol === 'function' &&
        (g[Symbol.iterator] = function () {
          return this;
        }),
      g
    );
    function verb(n) {
      return function (v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f) throw new TypeError('Generator is already executing.');
      while ((g && ((g = 0), op[0] && (_ = 0)), _))
        try {
          if (
            ((f = 1),
            y &&
              (t =
                op[0] & 2
                  ? y['return']
                  : op[0]
                    ? y['throw'] || ((t = y['return']) && t.call(y), 0)
                    : y.next) &&
              !(t = t.call(y, op[1])).done)
          )
            return t;
          if (((y = 0), t)) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (
                !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                (op[0] === 6 || op[0] === 2)
              ) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.authService = void 0;
var api_1 = require('../config/api');
var request_1 = require('../utils/request');
/**
 * 认证服务类
 */
var AuthService = /** @class */ (function () {
  function AuthService() {}
  /**
   * 用户登录
   */
  AuthService.prototype.login = function (credentials) {
    return __awaiter(this, void 0, void 0, function () {
      var response, expiresAt, error_1;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            _a.trys.push([0, 2, , 3]);
            return [
              4 /*yield*/,
              (0, request_1.post)(api_1.API_ENDPOINTS.AUTH.LOGIN, credentials, {
                needAuth: false,
              }),
              // 保存Token和用户信息
            ];
          case 1:
            response = _a.sent();
            // 保存Token和用户信息
            if (response.token) {
              wx.setStorageSync(api_1.TOKEN_KEY, response.token);
              wx.setStorageSync('user_info', response.user);
              // 保存Token过期时间（如果有）
              if (response.expiresIn) {
                expiresAt = Date.now() + response.expiresIn * 1000;
                wx.setStorageSync('token_expires_at', expiresAt);
              }
            }
            return [2 /*return*/, response];
          case 2:
            error_1 = _a.sent();
            console.error('登录失败:', error_1);
            throw error_1;
          case 3:
            return [2 /*return*/];
        }
      });
    });
  };
  /**
   * 用户注册
   */
  AuthService.prototype.register = function (data) {
    return __awaiter(this, void 0, void 0, function () {
      var response, error_2;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            _a.trys.push([0, 2, , 3]);
            return [
              4 /*yield*/,
              (0, request_1.post)(api_1.API_ENDPOINTS.AUTH.REGISTER, data, {
                needAuth: false,
              }),
              // 注册成功后自动保存Token
            ];
          case 1:
            response = _a.sent();
            // 注册成功后自动保存Token
            if (response.token) {
              wx.setStorageSync(api_1.TOKEN_KEY, response.token);
              wx.setStorageSync('user_info', response.user);
            }
            return [2 /*return*/, response];
          case 2:
            error_2 = _a.sent();
            console.error('注册失败:', error_2);
            throw error_2;
          case 3:
            return [2 /*return*/];
        }
      });
    });
  };
  /**
   * 退出登录
   */
  AuthService.prototype.logout = function () {
    return __awaiter(this, void 0, void 0, function () {
      return __generator(this, function (_a) {
        try {
          // 可选：调用后端登出接口
          // await post(API_ENDPOINTS.AUTH.LOGOUT)
          // 清除本地存储
          wx.removeStorageSync(api_1.TOKEN_KEY);
          wx.removeStorageSync('user_info');
          wx.removeStorageSync('token_expires_at');
          // 跳转到登录页
          wx.reLaunch({
            url: '/pages/auth/login',
          });
        } catch (error) {
          console.error('退出登录失败:', error);
          // 即使失败也清除本地数据
          wx.removeStorageSync(api_1.TOKEN_KEY);
          wx.removeStorageSync('user_info');
          wx.reLaunch({
            url: '/pages/auth/login',
          });
        }
        return [2 /*return*/];
      });
    });
  };
  /**
   * 检查是否已登录
   */
  AuthService.prototype.isLoggedIn = function () {
    var token = wx.getStorageSync(api_1.TOKEN_KEY);
    if (!token) {
      return false;
    }
    // 检查Token是否过期
    var expiresAt = wx.getStorageSync('token_expires_at');
    if (expiresAt && Date.now() > expiresAt) {
      // Token已过期，清除
      this.clearAuth();
      return false;
    }
    return true;
  };
  /**
   * 获取当前用户信息
   */
  AuthService.prototype.getCurrentUser = function () {
    try {
      return wx.getStorageSync('user_info');
    } catch (error) {
      return null;
    }
  };
  /**
   * 获取Token
   */
  AuthService.prototype.getToken = function () {
    try {
      return wx.getStorageSync(api_1.TOKEN_KEY);
    } catch (error) {
      return null;
    }
  };
  /**
   * 清除认证信息
   */
  AuthService.prototype.clearAuth = function () {
    wx.removeStorageSync(api_1.TOKEN_KEY);
    wx.removeStorageSync('user_info');
    wx.removeStorageSync('token_expires_at');
  };
  /**
   * 检查并跳转登录页
   */
  AuthService.prototype.checkAuthAndRedirect = function () {
    if (!this.isLoggedIn()) {
      wx.reLaunch({
        url: '/pages/auth/login',
      });
      return false;
    }
    return true;
  };
  return AuthService;
})();
// 导出单例
exports.authService = new AuthService();
exports.default = exports.authService;
