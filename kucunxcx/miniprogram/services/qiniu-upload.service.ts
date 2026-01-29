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

import { post } from '../utils/request';
import { showGlobalLoading, hideGlobalLoading } from '../utils/request';
import { API_ENDPOINTS } from '../config/api';

// 上传类型
export type UploadType = 'product' | 'avatar' | 'document';
export type UploadKind = 'thumbnail' | 'main' | 'effect';

// 后端返回的上传参数
interface QiniuUploadParams {
  uploadToken: string; // 七牛上传凭证
  uploadHost: string; // 主上传域名
  fallbackUploadHosts?: string[]; // 备用上传域名
  key: string; // 文件在七牛的 key
  url: string; // 完整的 CDN 访问 URL
  domain: string; // CDN 域名
}

// 上传结果
interface UploadResult {
  key: string; // 文件 key
  url: string; // 完整 URL
  hash?: string; // 文件哈希值
}

// 上传选项
interface UploadOptions {
  type?: UploadType; // 上传类型
  kind?: UploadKind; // 图片用途（仅 type=product 时有效）
  onProgress?: (progress: number) => void; // 上传进度回调
  showLoading?: boolean; // 是否显示 loading（默认 true）
}

/**
 * 七牛云上传服务类
 */
class QiniuUploadService {
  /**
   * 从后端获取七牛云上传参数
   */
  private async getUploadParams(
    fileName: string,
    type: UploadType = 'product',
    kind?: UploadKind
  ): Promise<QiniuUploadParams> {
    try {
      // request.ts 会自动解包 { success: true, data: {...} } 中的 data
      // 所以这里直接声明返回类型为 QiniuUploadParams
      const response = await post<QiniuUploadParams>(
        API_ENDPOINTS.UPLOAD.QINIU_TOKEN,
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
  private async uploadToQiniu(
    filePath: string,
    params: QiniuUploadParams,
    onProgress?: (progress: number) => void
  ): Promise<UploadResult> {
    const { uploadToken, key, uploadHost, fallbackUploadHosts, url } = params;

    // 构建上传域名列表（主域名 + 备用域名）
    const uploadHosts = [uploadHost, ...(fallbackUploadHosts || [])]
      .filter(Boolean)
      .slice(0, 3); // 最多尝试 3 个域名

    let lastError: Error | null = null;

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
        lastError = error as Error;
        // 继续尝试下一个域名
      }
    }

    // 所有域名都失败了
    throw lastError || new Error('上传失败');
  }

  /**
   * 执行上传操作（微信小程序 uploadFile API）
   */
  private doUpload(
    uploadHost: string,
    filePath: string,
    uploadToken: string,
    key: string,
    onProgress?: (progress: number) => void
  ): Promise<{ hash?: string }> {
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
  async uploadImage(
    filePath: string,
    kind: UploadKind,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const {
      type = 'product',
      onProgress,
      showLoading: shouldShowLoading = true,
    } = options;

    try {
      // 显示加载提示
      if (shouldShowLoading) {
        showGlobalLoading({ title: '上传中...', mask: true });
      }

      // 1. 获取文件名
      const fileName = filePath.split('/').pop() || 'image.jpg';

      // 2. 从后端获取上传参数
      const params = await this.getUploadParams(fileName, type, kind);

      // 3. 上传到七牛云
      const result = await this.uploadToQiniu(filePath, params, onProgress);

      // 4. 隐藏加载提示
      if (shouldShowLoading) {
        hideGlobalLoading();
      }

      return result;
    } catch (error) {
      // 隐藏加载提示
      if (shouldShowLoading) {
        hideGlobalLoading();
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
  async chooseAndUploadImage(
    kind: UploadKind,
    count: number = 1,
    options: UploadOptions = {}
  ): Promise<UploadResult[]> {
    try {
      // 1. 选择图片
      const res = await wx.chooseImage({
        count,
        sizeType: ['compressed'], // 压缩图片
        sourceType: ['album', 'camera'],
      });

      // 2. 批量上传
      const results: UploadResult[] = [];
      const files = res.tempFilePaths;

      for (let i = 0; i < files.length; i++) {
        try {
          const result = await this.uploadImage(files[i], kind, {
            ...options,
            showLoading: true,
            onProgress: progress => {
              // 显示当前文件的上传进度
              showGlobalLoading({
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
      hideGlobalLoading();

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
      hideGlobalLoading();
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
  async uploadFiles(
    filePaths: string[],
    kind: UploadKind,
    options: UploadOptions = {}
  ): Promise<UploadResult[]> {
    if (!filePaths || filePaths.length === 0) {
      return [];
    }

    const results: UploadResult[] = [];
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
              showGlobalLoading({
                title: `上传中 ${current}/${filePaths.length} (${progress}%)`,
                mask: true,
              });
            },
          })
        )
      );
      results.push(...batchResults);
    }

    hideGlobalLoading();
    return results;
  }
}

// 导出单例
export const qiniuService = new QiniuUploadService();
export default qiniuService;
