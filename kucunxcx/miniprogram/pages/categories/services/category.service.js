'use strict';
// 分类服务
// 封装所有分类相关的 API 请求
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
Object.defineProperty(exports, '__esModule', { value: true });
exports.categoryService = void 0;
const api_1 = require('../config/api');
const request_1 = require('../utils/request');
/**
 * 分类服务类
 */
class CategoryService {
  /**
   * 获取分类列表
   */
  getCategories() {
    return __awaiter(this, void 0, void 0, function* () {
      return (0, request_1.get)(
        api_1.API_ENDPOINTS.CATEGORIES.LIST,
        {
          status: 'active', // 只获取启用的分类
        },
        {
          // 分类浏览允许游客模式，不自动跳转登录
          autoRedirectOn401: false,
        }
      );
    });
  }
  /**
   * 获取分类详情
   */
  getCategoryDetail(id) {
    return __awaiter(this, void 0, void 0, function* () {
      return (0, request_1.get)(
        api_1.API_ENDPOINTS.CATEGORIES.DETAIL(id),
        undefined,
        {
          autoRedirectOn401: false,
        }
      );
    });
  }
}
// 导出单例
exports.categoryService = new CategoryService();
exports.default = exports.categoryService;
