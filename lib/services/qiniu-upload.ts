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
  pathFormat?: string;
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
            'qiniu_path_format',
          ],
        },
      },
    });

    const config: Partial<QiniuConfig> = {};

    settings.forEach(setting => {
      switch (setting.key) {
        case 'qiniu_access_key':
          if (setting.value) {
            const decrypted = decrypt(setting.value);
            config.accessKey = decrypted;
            console.log('AccessKey 解密:', {
              encrypted: `${setting.value.substring(0, 20)}...`,
              decrypted: `${decrypted.substring(0, 10)}...`,
              length: decrypted.length,
            });
          }
          break;
        case 'qiniu_secret_key':
          if (setting.value) {
            const decrypted = decrypt(setting.value);
            config.secretKey = decrypted;
            console.log('SecretKey 解密:', {
              encrypted: `${setting.value.substring(0, 20)}...`,
              decrypted: `${decrypted.substring(0, 10)}...`,
              length: decrypted.length,
            });
          }
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
        case 'qiniu_path_format':
          config.pathFormat = setting.value || '';
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
      console.error('七牛云配置不完整:', {
        hasAccessKey: !!config.accessKey,
        hasSecretKey: !!config.secretKey,
        hasBucket: !!config.bucket,
        hasDomain: !!config.domain,
        accessKeyLength: config.accessKey?.length || 0,
        secretKeyLength: config.secretKey?.length || 0,
      });
      return null;
    }

    console.log('七牛云配置验证通过:', {
      accessKeyLength: config.accessKey.length,
      secretKeyLength: config.secretKey.length,
      bucket: config.bucket,
      domain: config.domain,
      region: config.region,
    });

    return config as QiniuConfig;
  } catch (error) {
    console.error('获取七牛云配置失败:', error);
    return null;
  }
}

/**
 * 获取七牛云区域配置
 */
function getQiniuZone(region: string = 'z0'): typeof qiniu.zone.Zone_z0 {
  const zoneMap: Record<string, typeof qiniu.zone.Zone_z0> = {
    z0: qiniu.zone.Zone_z0, // 华东-浙江
    z1: qiniu.zone.Zone_z1, // 华北-河北
    z2: qiniu.zone.Zone_z2, // 华南-广东
    na0: qiniu.zone.Zone_na0, // 北美-洛杉矶
    as0: qiniu.zone.Zone_as0, // 亚太-新加坡
  };

  return zoneMap[region] || qiniu.zone.Zone_z0;
}

/**
 * 生成文件存储路径
 * 支持的变量: {y}(年), {m}(月), {d}(日)
 * 留空表示不使用目录结构，直接存储在根目录
 */
function generateFilePath(
  fileName: string,
  _type: string,
  pathFormat?: string
): string {
  const now = new Date();
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'jpg';

  // 如果没有配置格式，直接使用时间戳+随机字符串作为文件名
  if (!pathFormat || pathFormat.trim() === '') {
    return `${timestamp}_${randomString}.${fileExtension}`;
  }

  // 替换变量
  const directory = pathFormat
    .replace(/{y}/g, now.getFullYear().toString())
    .replace(/{m}/g, (now.getMonth() + 1).toString().padStart(2, '0'))
    .replace(/{d}/g, now.getDate().toString().padStart(2, '0'));

  return `${directory}/${timestamp}_${randomString}.${fileExtension}`;
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

    // 使用配置的目录格式生成文件key
    const key = generateFilePath(fileName, type, config.pathFormat);

    console.log('七牛云上传配置:', {
      bucket: config.bucket,
      region: config.region,
      pathFormat: config.pathFormat,
      generatedKey: key,
    });

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

    console.log('开始测试七牛云连接:', {
      accessKeyPrefix: config.accessKey.substring(0, 10),
      secretKeyPrefix: config.secretKey.substring(0, 10),
      bucket: config.bucket,
      region: config.region,
    });

    const mac = new qiniu.auth.digest.Mac(config.accessKey, config.secretKey);
    const qiniuConfig = new qiniu.conf.Config();
    qiniuConfig.zone = getQiniuZone(config.region);

    const bucketManager = new qiniu.rs.BucketManager(mac, qiniuConfig);

    // 使用 listPrefix 测试连接（列举存储空间中的文件）
    return new Promise(resolve => {
      bucketManager.listPrefix(
        config.bucket,
        { limit: 1 },
        (err, respBody, respInfo) => {
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
          } else if (respInfo.statusCode === 401) {
            resolve({
              success: false,
              message: '连接失败: Access Key 或 Secret Key 不正确',
            });
          } else if (respInfo.statusCode === 631) {
            resolve({
              success: false,
              message: '连接失败: 存储空间不存在',
            });
          } else {
            resolve({
              success: false,
              message: `连接失败: HTTP ${respInfo.statusCode}`,
            });
          }
        }
      );
    });
  } catch (error) {
    return {
      success: false,
      message: `连接异常: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}
