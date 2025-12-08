'use strict';
// 产品服务
// 封装所有产品相关的 API 请求
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
exports.productService = void 0;
var api_1 = require('../config/api');
var request_1 = require('../utils/request');
/**
 * 产品服务类
 */
var ProductService = /** @class */ (function () {
  function ProductService() {}
  /**
   * 获取产品列表
   */
  ProductService.prototype.getProducts = function () {
    return __awaiter(this, arguments, void 0, function (params) {
      var queryParams, response, items;
      var _a, _b, _c, _d, _e, _f, _g;
      if (params === void 0) {
        params = {};
      }
      return __generator(this, function (_h) {
        switch (_h.label) {
          case 0:
            queryParams = {
              page: params.page || 1,
              limit: params.limit || 10,
              search: params.search,
              categoryId: params.categoryId,
              status: params.status,
              sortBy: params.sortBy || 'createdAt',
              sortOrder: params.sortOrder || 'desc',
              includeInventory: params.includeInventory !== false, // 默认包含库存
              includeStatistics: params.includeStatistics || false,
              includeBatchSpecs: params.includeBatchSpecs || false,
            };
            return [
              4 /*yield*/,
              (0, request_1.get)(
                api_1.API_ENDPOINTS.PRODUCTS.LIST,
                queryParams
              ),
              // 🔧 适配后端返回格式：将 data.data 转换为 items
              // 后端返回: { data: [...], pagination: {...} }
              // 小程序期望: { items: [...], pagination: {...} }
            ];
          case 1:
            response = _h.sent();
            items = (response.data || []).map(function (product) {
              // 将后端返回的图片结构(ProductImage[])转换为小程序使用的 string[]
              var images = [];
              if (Array.isArray(product.images)) {
                images = product.images
                  .map(function (img) {
                    return typeof img === 'string'
                      ? img
                      : img && typeof img.url === 'string'
                        ? img.url
                        : '';
                  })
                  .filter(function (url) {
                    return !!url;
                  });
              }
              return __assign(__assign({}, product), { images: images });
            });
            return [
              2 /*return*/,
              {
                items: items,
                pagination: {
                  page:
                    ((_a = response.pagination) === null || _a === void 0
                      ? void 0
                      : _a.page) ||
                    params.page ||
                    1,
                  limit:
                    ((_b = response.pagination) === null || _b === void 0
                      ? void 0
                      : _b.limit) ||
                    params.limit ||
                    10,
                  total:
                    ((_c = response.pagination) === null || _c === void 0
                      ? void 0
                      : _c.total) || 0,
                  totalPages:
                    ((_d = response.pagination) === null || _d === void 0
                      ? void 0
                      : _d.totalPages) || 0,
                  hasNextPage:
                    ((_e = response.pagination) === null || _e === void 0
                      ? void 0
                      : _e.page) <
                    ((_f = response.pagination) === null || _f === void 0
                      ? void 0
                      : _f.totalPages),
                  hasPreviousPage:
                    ((_g = response.pagination) === null || _g === void 0
                      ? void 0
                      : _g.page) > 1,
                },
              },
            ];
        }
      });
    });
  };
  /**
   * 获取产品详情
   * - 适配后端返回的图片结构(ProductImage[])为小程序使用的 string[]
   */
  ProductService.prototype.getProductDetail = function (id) {
    return __awaiter(this, void 0, void 0, function () {
      var raw, images;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            return [
              4 /*yield*/,
              (0, request_1.get)(api_1.API_ENDPOINTS.PRODUCTS.DETAIL(id), {
                includeInventory: true,
                includeStatistics: true,
                includeBatchSpecs: true,
              }),
            ];
          case 1:
            raw = _a.sent();
            images = [];
            if (Array.isArray(raw.images)) {
              images = raw.images
                .map(function (img) {
                  return typeof img === 'string'
                    ? img
                    : img && typeof img.url === 'string'
                      ? img.url
                      : '';
                })
                .filter(function (url) {
                  return !!url;
                });
            }
            return [
              2 /*return*/,
              __assign(__assign({}, raw), { images: images }),
            ];
        }
      });
    });
  };
  /**
   * 搜索产品
   */
  ProductService.prototype.searchProducts = function (keyword_1) {
    return __awaiter(this, arguments, void 0, function (keyword, params) {
      if (params === void 0) {
        params = {};
      }
      return __generator(this, function (_a) {
        return [
          2 /*return*/,
          this.getProducts(__assign(__assign({}, params), { search: keyword })),
        ];
      });
    });
  };
  /**
   * 按分类获取产品
   */
  ProductService.prototype.getProductsByCategory = function (categoryId_1) {
    return __awaiter(this, arguments, void 0, function (categoryId, params) {
      if (params === void 0) {
        params = {};
      }
      return __generator(this, function (_a) {
        return [
          2 /*return*/,
          this.getProducts(
            __assign(__assign({}, params), { categoryId: categoryId })
          ),
        ];
      });
    });
  };
  /**
   * 创建产品
   * 注意：后端 productCreateSchema 要求的字段：
   * - code, name, specification, categoryId 为必填
   * - description/thickness 可选
   * - thumbnailUrl/images 为可选的图片字段
   */
  ProductService.prototype.createProduct = function (payload) {
    return __awaiter(this, void 0, void 0, function () {
      var images, order, body;
      var _a, _b;
      return __generator(this, function (_c) {
        images = [];
        order = 0;
        // 缩略图优先作为主图
        if (payload.thumbnailUrl) {
          images.push({
            url: payload.thumbnailUrl,
            type: 'main',
            order: order++,
          });
        }
        // 其他主图
        if (payload.mainImages && payload.mainImages.length > 0) {
          payload.mainImages.forEach(function (url) {
            if (!url) return;
            images.push({
              url: url,
              type: 'main',
              order: order++,
            });
          });
        }
        // 效果图
        if (payload.effectImages && payload.effectImages.length > 0) {
          payload.effectImages.forEach(function (url) {
            if (!url) return;
            images.push({
              url: url,
              type: 'effect',
              order: order++,
            });
          });
        }
        body = {
          code: payload.code,
          name: payload.name,
          specification: payload.specification,
          description:
            (_a = payload.description) !== null && _a !== void 0 ? _a : '',
          thickness: payload.thickness,
          status: 'active',
          categoryId: payload.categoryId,
          thumbnailUrl:
            (_b = payload.thumbnailUrl) !== null && _b !== void 0 ? _b : '',
          images: images,
        };
        return [
          2 /*return*/,
          (0, request_1.post)(api_1.API_ENDPOINTS.PRODUCTS.LIST, body),
        ];
      });
    });
  };
  return ProductService;
})();
// 导出单例
exports.productService = new ProductService();
exports.default = exports.productService;
