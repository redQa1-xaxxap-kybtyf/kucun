import qiniu from 'qiniu';

import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/utils/encryption';

/**
 * 七牛云配置接口
 */
export interface QiniuConfig {
  accessKey: string;
  secretKey: string;
  bucket: string;
  domain: string;
  region?: string;
}

/**
 * 上传结果接口
 */
export interface UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

/**
 * 获取七牛云配置
 */
async function getQiniuConfig(): Promise<QiniuConfig | null> {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            'qiniu_access_key',
            'qiniu_secret_key',
            'qiniu_bucket',
            'qiniu_domain',
            'qiniu_region',
          ],
        },
      },
    });

    const config: Partial<QiniuConfig> = {};

    settings.forEach(setting => {
      switch (setting.key) {
        case 'qiniu_access_key':
          config.accessKey = setting.value ? decrypt(setting.value) : '';
          break;
        case 'qiniu_secret_key':
          config.secretKey = setting.value ? decrypt(setting.value) : '';
          break;
        case 'qiniu_bucket':
          config.bucket = setting.value || '';
          break;
        case 'qiniu_domain':
          config.domain = setting.value || '';
          break;
        case 'qiniu_region':
          config.region = setting.value || 'z0';
          break;
      }
    });

    // 验证必需的配置项
    if (
      !config.accessKey ||
      !config.secretKey ||
      !config.bucket ||
      !config.domain
    ) {
      return null;
    }

    return config as QiniuConfig;
  } catch (error) {
    console.error('获取七牛云配置失败:', error);
    return null;
  }
}

/**
 * 获取七牛云区域配置
 */
function getQiniuZone(region: string = 'z0') {
  const zoneMap: Record<string, any> = {
    z0: qiniu.zone.Zone_z0, // 华东-浙江
    z1: qiniu.zone.Zone_z1, // 华北-河北
    z2: qiniu.zone.Zone_z2, // 华南-广东
    na0: qiniu.zone.Zone_na0, // 北美-洛杉矶
    as0: qiniu.zone.Zone_as0, // 亚太-新加坡
  };

  return zoneMap[region] || qiniu.zone.Zone_z0;
}

/**
 * 生成上传凭证
 */
function generateUploadToken(config: QiniuConfig, key: string): string {
  const mac = new qiniu.auth.digest.Mac(config.accessKey, config.secretKey);

  const putPolicy = new qiniu.rs.PutPolicy({
    scope: `${config.bucket}:${key}`,
    expires: 3600, // 1小时过期
  });

  return putPolicy.uploadToken(mac);
}

/**
 * 上传文件到七牛云
 */
export async function uploadToQiniu(
  buffer: Buffer,
  fileName: string,
  type: string = 'product'
): Promise<UploadResult> {
  try {
    // 获取七牛云配置
    const config = await getQiniuConfig();
    if (!config) {
      return {
        success: false,
        error: '七牛云配置未设置或不完整，请联系管理员配置存储服务',
      };
    }

    // 生成文件key
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'jpg';
    const key = `${type}/${timestamp}_${randomString}.${fileExtension}`;

    // 生成上传凭证
    const uploadToken = generateUploadToken(config, key);

    // 配置上传参数
    const qiniuConfig = new qiniu.conf.Config({
      zone: getQiniuZone(config.region),
    });

    const formUploader = new qiniu.form_up.FormUploader(qiniuConfig);
    const putExtra = new qiniu.form_up.PutExtra();

    // 执行上传
    return new Promise(resolve => {
      formUploader.put(
        uploadToken,
        key,
        buffer,
        putExtra,
        (respErr, respBody, respInfo) => {
          if (respErr) {
            console.error('七牛云上传失败:', respErr);
            resolve({
              success: false,
              error: `上传失败: ${respErr.message}`,
            });
            return;
          }

          if (respInfo.statusCode === 200) {
            const url = `${config.domain}/${key}`;
            console.log('七牛云上传成功:', { key, url });
            resolve({
              success: true,
              url,
              key,
            });
          } else {
            console.error('七牛云上传失败:', respInfo.statusCode, respBody);
            resolve({
              success: false,
              error: `上传失败: HTTP ${respInfo.statusCode}`,
            });
          }
        }
      );
    });
  } catch (error) {
    console.error('七牛云上传异常:', error);
    return {
      success: false,
      error: `上传异常: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}

/**
 * 删除七牛云文件
 */
export async function deleteFromQiniu(key: string): Promise<boolean> {
  try {
    const config = await getQiniuConfig();
    if (!config) {
      console.error('七牛云配置未设置，无法删除文件');
      return false;
    }

    const mac = new qiniu.auth.digest.Mac(config.accessKey, config.secretKey);
    const qiniuConfig = new qiniu.conf.Config({
      zone: getQiniuZone(config.region),
    });

    const bucketManager = new qiniu.rs.BucketManager(mac, qiniuConfig);

    return new Promise(resolve => {
      bucketManager.delete(config.bucket, key, (err, respBody, respInfo) => {
        if (err) {
          console.error('七牛云删除文件失败:', err);
          resolve(false);
          return;
        }

        if (respInfo.statusCode === 200) {
          console.log('七牛云删除文件成功:', key);
          resolve(true);
        } else {
          console.error('七牛云删除文件失败:', respInfo.statusCode, respBody);
          resolve(false);
        }
      });
    });
  } catch (error) {
    console.error('七牛云删除文件异常:', error);
    return false;
  }
}

/**
 * 测试七牛云连接
 */
export async function testQiniuConnection(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const config = await getQiniuConfig();
    if (!config) {
      return {
        success: false,
        message: '七牛云配置未设置或不完整',
      };
    }

    const mac = new qiniu.auth.digest.Mac(config.accessKey, config.secretKey);
    const qiniuConfig = new qiniu.conf.Config({
      zone: getQiniuZone(config.region),
    });

    const bucketManager = new qiniu.rs.BucketManager(mac, qiniuConfig);

    return new Promise(resolve => {
      // 尝试获取存储空间信息
      bucketManager.getBucketInfo(config.bucket, (err, respBody, respInfo) => {
        if (err) {
          resolve({
            success: false,
            message: `连接失败: ${err.message}`,
          });
          return;
        }

        if (respInfo.statusCode === 200) {
          resolve({
            success: true,
            message: '七牛云连接测试成功',
          });
        } else {
          resolve({
            success: false,
            message: `连接失败: HTTP ${respInfo.statusCode}`,
          });
        }
      });
    });
  } catch (error) {
    return {
      success: false,
      message: `连接异常: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}
