'use strict';
/**
 * 七牛云上传服务（官方推荐方案）
 *
 * 架构说明：
 * 1. 从后端获取 uploadToken 和上传参数
 * 2. 直接上传到七牛云（不经过业务服务器中转）
 * 3. 自动重试机制（多个上传域名）
 *
 * 使用示例：
 * const result = await qiniuService.uploadImage(filePath, 'thumbnail');
 * console.log(result.url); // 完整的 CDN URL
 */
Object.defineProperty(exports, '__esModule', { value: true });
exports.qiniuService = void 0;
const request_1 = require('../utils/request');
const request_2 = require('../utils/request');
const api_1 = require('../config/api');
/**
 * 七牛云上传服务类
 */
class QiniuUploadService {
  /**
   * 从后端获取七牛云上传参数
   */
  async getUploadParams(fileName, type = 'product', kind) {
    try {
      // request.ts 会自动解包 { success: true, data: {...} } 中的 data
      // 所以这里直接声明返回类型为 QiniuUploadParams
      const response = await (0, request_1.post)(
        api_1.API_ENDPOINTS.UPLOAD.QINIU_TOKEN,
        {
          type,
          kind,
          fileName,
        }
      );
      if (!response) {
        throw new Error('获取上传参数失败');
      }
      return response;
    } catch (error) {
      console.error('获取七牛上传参数失败:', error);
      throw new Error('获取上传凭证失败');
    }
  }
  /**
   * 上传文件到七牛云（带重试机制）
   */
  async uploadToQiniu(filePath, params, onProgress) {
    const { uploadToken, key, uploadHost, fallbackUploadHosts, url } = params;
    // 构建上传域名列表（主域名 + 备用域名）
    const uploadHosts = [uploadHost, ...(fallbackUploadHosts || [])]
      .filter(Boolean)
      .slice(0, 3); // 最多尝试 3 个域名
    let lastError = null;
    // 依次尝试上传到不同域名
    for (const host of uploadHosts) {
      try {
        const result = await this.doUpload(
          host,
          filePath,
          uploadToken,
          key,
          onProgress
        );
        // 上传成功，返回结果
        return {
          key,
          url, // 使用后端返回的完整 URL
          hash: result.hash,
        };
      } catch (error) {
        console.warn(`上传到 ${host} 失败:`, error);
        lastError = error;
        // 继续尝试下一个域名
      }
    }
    // 所有域名都失败了
    throw lastError || new Error('上传失败');
  }
  /**
   * 执行上传操作（微信小程序 uploadFile API）
   */
  doUpload(uploadHost, filePath, uploadToken, key, onProgress) {
    return new Promise((resolve, reject) => {
      const uploadTask = wx.uploadFile({
        url: uploadHost,
        filePath,
        name: 'file',
        formData: {
          token: uploadToken,
          key,
        },
        success: res => {
          // 七牛云返回 200 表示成功
          if (res.statusCode === 200) {
            try {
              const data = JSON.parse(res.data);
              resolve({
                hash: data.hash || data.etag,
              });
            } catch {
              // 解析失败但状态码是 200，仍然认为成功
              resolve({});
            }
          } else {
            // 尝试解析错误信息
            let errorMsg = '上传失败';
            try {
              const data = JSON.parse(res.data);
              errorMsg = data.error || data.message || errorMsg;
            } catch {
              // 解析失败，使用默认错误信息
            }
            reject(new Error(errorMsg));
          }
        },
        fail: error => {
          reject(new Error(error.errMsg || '上传失败'));
        },
      });
      // 上传进度监听
      if (onProgress) {
        uploadTask.onProgressUpdate(res => {
          const progress = res.progress || 0;
          onProgress(progress);
        });
      }
    });
  }
  /**
   * 上传图片（便捷方法）
   *
   * @param filePath 文件的本地路径
   * @param kind 图片用途（thumbnail/main/effect）
   * @param options 上传选项
   * @returns Promise<UploadResult>
   */
  async uploadImage(filePath, kind, options = {}) {
    const {
      type = 'product',
      onProgress,
      showLoading: shouldShowLoading = true,
    } = options;
    try {
      // 显示加载提示
      if (shouldShowLoading) {
        (0, request_2.showGlobalLoading)({ title: '上传中...', mask: true });
      }
      // 1. 获取文件名
      const fileName = filePath.split('/').pop() || 'image.jpg';
      // 2. 从后端获取上传参数
      const params = await this.getUploadParams(fileName, type, kind);
      // 3. 上传到七牛云
      const result = await this.uploadToQiniu(filePath, params, onProgress);
      // 4. 隐藏加载提示
      if (shouldShowLoading) {
        (0, request_2.hideGlobalLoading)();
      }
      return result;
    } catch (error) {
      // 隐藏加载提示
      if (shouldShowLoading) {
        (0, request_2.hideGlobalLoading)();
      }
      console.error('上传图片失败:', error);
      throw error;
    }
  }
  /**
   * 选择并上传图片（一步完成）
   *
   * @param kind 图片用途
   * @param count 最多选择几张
   * @param options 上传选项
   * @returns Promise<UploadResult[]>
   */
  async chooseAndUploadImage(kind, count = 1, options = {}) {
    try {
      // 1. 选择图片
      const res = await wx.chooseImage({
        count,
        sizeType: ['compressed'], // 压缩图片
        sourceType: ['album', 'camera'],
      });
      // 2. 批量上传
      const results = [];
      const files = res.tempFilePaths;
      for (let i = 0; i < files.length; i++) {
        try {
          const result = await this.uploadImage(files[i], kind, {
            ...options,
            showLoading: true,
            onProgress: progress => {
              // 显示当前文件的上传进度
              (0, request_2.showGlobalLoading)({
                title: `上传中 ${i + 1}/${files.length} (${progress}%)`,
                mask: true,
              });
              options.onProgress?.(progress);
            },
          });
          results.push(result);
        } catch (error) {
          console.error(`文件 ${i + 1} 上传失败:`, error);
          // 继续上传其他文件
        }
      }
      // 全部完成
      (0, request_2.hideGlobalLoading)();
      if (results.length === 0) {
        throw new Error('所有文件上传失败');
      }
      if (results.length < files.length) {
        wx.showToast({
          title: `成功上传 ${results.length}/${files.length} 张`,
          icon: 'none',
          duration: 2000,
        });
      } else {
        wx.showToast({
          title: '上传成功',
          icon: 'success',
          duration: 1500,
        });
      }
      return results;
    } catch (error) {
      (0, request_2.hideGlobalLoading)();
      wx.showToast({
        title: '上传失败',
        icon: 'none',
        duration: 2000,
      });
      throw error;
    }
  }
  /**
   * 批量上传文件（控制并发）
   *
   * @param filePaths 文件路径数组
   * @param kind 图片用途
   * @param options 上传选项
   * @returns Promise<UploadResult[]>
   */
  async uploadFiles(filePaths, kind, options = {}) {
    if (!filePaths || filePaths.length === 0) {
      return [];
    }
    const results = [];
    const CONCURRENCY = 3; // 并发数
    // 分批上传，控制并发
    for (let i = 0; i < filePaths.length; i += CONCURRENCY) {
      const batch = filePaths.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map((filePath, index) =>
          this.uploadImage(filePath, kind, {
            ...options,
            showLoading: false, // 批量上传时统一管理 loading
            onProgress: progress => {
              const current = i + index + 1;
              (0, request_2.showGlobalLoading)({
                title: `上传中 ${current}/${filePaths.length} (${progress}%)`,
                mask: true,
              });
            },
          })
        )
      );
      results.push(...batchResults);
    }
    (0, request_2.hideGlobalLoading)();
    return results;
  }
}
// 导出单例
exports.qiniuService = new QiniuUploadService();
exports.default = exports.qiniuService;
