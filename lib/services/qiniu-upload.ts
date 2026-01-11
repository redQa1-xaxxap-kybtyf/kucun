// cspell:words qiniu Qiniu
import qiniu from 'qiniu';

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
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

// 配置缓存
let cachedConfig: QiniuConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
const QINIU_SETTING_KEYS = [
  'qiniu_access_key',
  'qiniu_secret_key',
  'qiniu_bucket',
  'qiniu_domain',
  'qiniu_region',
  'qiniu_path_format',
] as const;

/**
 * 上传结果接口
 */
export interface UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

export interface DirectUploadParamsResult {
  success: boolean;
  uploadToken?: string;
  uploadHost?: string;
  fallbackUploadHosts?: string[];
  key?: string;
  url?: string;
  domain?: string;
  error?: string;
}

/**
 * 获取七牛云配置（带缓存）
 */
async function getQiniuConfig(): Promise<QiniuConfig | null> {
  try {
    const now = Date.now();

    // 检查缓存是否有效
    if (cachedConfig && now - cacheTimestamp < CACHE_TTL) {
      logger.debug('qiniu', 'Using cached Qiniu config');
      return cachedConfig;
    }

    logger.info('qiniu', 'Fetching Qiniu config from database');
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [...QINIU_SETTING_KEYS],
        },
      },
      select: {
        key: true,
        value: true,
      },
      take: QINIU_SETTING_KEYS.length,
    });

    const config: Partial<QiniuConfig> = {};

    settings.forEach(setting => {
      switch (setting.key) {
        case 'qiniu_access_key':
          if (setting.value) {
            config.accessKey = decrypt(setting.value);
            logger.debug('qiniu', 'AccessKey decrypted', {
              length: config.accessKey.length,
            });
          }
          break;
        case 'qiniu_secret_key':
          if (setting.value) {
            config.secretKey = decrypt(setting.value);
            logger.debug('qiniu', 'SecretKey decrypted', {
              length: config.secretKey.length,
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
      logger.error('qiniu', 'Qiniu config incomplete', undefined, {
        hasAccessKey: !!config.accessKey,
        hasSecretKey: !!config.secretKey,
        hasBucket: !!config.bucket,
        hasDomain: !!config.domain,
      });
      return null;
    }

    logger.info('qiniu', 'Qiniu config loaded successfully', {
      bucket: config.bucket,
      domain: config.domain,
      region: config.region || 'z0',
    });

    // 更新缓存
    cachedConfig = config as QiniuConfig;
    cacheTimestamp = now;

    return config as QiniuConfig;
  } catch (error) {
    logger.error('qiniu', 'Failed to get Qiniu config', error);
    return null;
  }
}

/**
 * 清除配置缓存（用于配置更新后）
 */
export function clearQiniuConfigCache(): void {
  cachedConfig = null;
  cacheTimestamp = 0;
  logger.info('qiniu', 'Qiniu config cache cleared');
}

/**
 * 获取七牛云区域配置
 */
function getQiniuZone(region: string = 'z0'): qiniu.conf.Zone {
  const zoneMap: Record<string, qiniu.conf.Zone> = {
    z0: qiniu.zone.Zone_z0, // 华东-浙江
    z1: qiniu.zone.Zone_z1, // 华北-河北
    z2: qiniu.zone.Zone_z2, // 华南-广东
    na0: qiniu.zone.Zone_na0, // 北美-洛杉矶
    as0: qiniu.zone.Zone_as0, // 亚太-新加坡
    'cn-east-1': qiniu.zone.Zone_z0, // 华东-浙江（别名）
    'cn-north-1': qiniu.zone.Zone_z1, // 华北-河北（别名）
    'cn-south-1': qiniu.zone.Zone_z2, // 华南-广东（别名）
    'cn-east-2':
      (qiniu.zone as unknown as Record<string, qiniu.conf.Zone>)
        .Zone_cn_east_2 ?? qiniu.zone.Zone_z0, // 华东-安徽
    'up-cn-east-2':
      (qiniu.zone as unknown as Record<string, qiniu.conf.Zone>)
        .Zone_cn_east_2 ?? qiniu.zone.Zone_z0,
  };

  return zoneMap[region] || qiniu.zone.Zone_z0;
}

function getQiniuUploadHosts(region?: string): string[] {
  // 七牛官方推荐的通用上传入口（会根据 token/region 自动路由）
  // https://developer.qiniu.com/kodo/1289/qiniu-api-domain
  // 小程序侧需将这些域名加入"request 合法域名"白名单，否则会被拦截。
  const universal = ['https://up.qiniup.com', 'https://upload.qiniup.com'];

  // 区域专用上传域名（优先使用，更稳定）
  const regionalMap: Record<string, string[]> = {
    z0: ['https://up-z0.qiniup.com', 'https://upload-z0.qiniup.com'],
    z1: ['https://up-z1.qiniup.com', 'https://upload-z1.qiniup.com'],
    z2: ['https://up-z2.qiniup.com', 'https://upload-z2.qiniup.com'],
    na0: ['https://up-na0.qiniup.com', 'https://upload-na0.qiniup.com'],
    as0: ['https://up-as0.qiniup.com', 'https://upload-as0.qiniup.com'],
    'cn-east-1': ['https://up-z0.qiniup.com', 'https://upload-z0.qiniup.com'],
    'cn-north-1': ['https://up-z1.qiniup.com', 'https://upload-z1.qiniup.com'],
    'cn-south-1': ['https://up-z2.qiniup.com', 'https://upload-z2.qiniup.com'],
    'cn-east-2': ['https://up-cn-east-2.qiniup.com'],
    'up-cn-east-2': ['https://up-cn-east-2.qiniup.com'],
  };

  const regional = region ? regionalMap[region] || [] : [];
  // 优先使用区域专用域名（更稳定），然后才是通用域名作为备用
  const all = [...regional, ...universal];
  return Array.from(new Set(all));
}

function deriveQiniuKeyFromUrl(
  url: string,
  config: QiniuConfig
): string | null {
  try {
    const fileUrl = new URL(url);
    const domainUrl = new URL(config.domain);

    if (fileUrl.host !== domainUrl.host) {
      return null;
    }

    const domainPath = domainUrl.pathname.replace(/\/+$/, '') || '/';
    let filePath = decodeURIComponent(fileUrl.pathname);

    if (domainPath !== '/' && filePath.startsWith(domainPath)) {
      filePath = filePath.slice(domainPath.length);
    }

    return filePath.replace(/^\/+/, '') || null;
  } catch (error) {
    logger.debug('qiniu', 'Failed to derive key from URL', {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function extractQiniuKeysFromUrls(
  urls: Array<string | null | undefined>
): Promise<string[]> {
  const config = await getQiniuConfig();
  if (!config) {
    return [];
  }

  const keys = urls
    .map(url => (url ?? '').trim())
    .filter(Boolean)
    .map(url => deriveQiniuKeyFromUrl(url, config))
    .filter((key): key is string => typeof key === 'string' && key.length > 0);

  return Array.from(new Set(keys));
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
 * 为“客户端直传七牛”生成上传参数（token/key/uploadHost/url）。
 * - uploadHost 给小程序的 wx.uploadFile 使用
 * - url/key 保存到业务数据中
 */
export async function createQiniuDirectUploadParams(
  fileName: string,
  type: string = 'product'
): Promise<DirectUploadParamsResult> {
  try {
    const config = await getQiniuConfig();
    if (!config) {
      return {
        success: false,
        error: '七牛云配置未设置或不完整，请联系管理员配置存储服务',
      };
    }

    const key = generateFilePath(fileName, type, config.pathFormat);
    const uploadToken = generateUploadToken(config, key);
    const domain = config.domain.replace(/\/+$/, '');
    const url = `${domain}/${key}`;

    const hosts = getQiniuUploadHosts(config.region);

    return {
      success: true,
      uploadToken,
      uploadHost: hosts[0],
      fallbackUploadHosts: hosts.slice(1),
      key,
      url,
      domain,
    };
  } catch (error) {
    logger.error('qiniu', 'Failed to create direct upload params', error);
    return {
      success: false,
      error: `生成上传参数失败: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
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

    logger.info('qiniu', 'Uploading file to Qiniu', {
      fileName,
      type,
      bucket: config.bucket,
      region: config.region,
      key,
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
            logger.error('qiniu', 'Upload failed', respErr);
            resolve({
              success: false,
              error: `上传失败: ${respErr.message}`,
            });
            return;
          }

          if (respInfo.statusCode === 200) {
            // 确保domain末尾没有斜杠，避免双斜杠问题
            const domain = config.domain.replace(/\/+$/, '');
            const url = `${domain}/${key}`;
            logger.info('qiniu', 'Upload successful', { key, url });
            resolve({
              success: true,
              url,
              key,
            });
          } else {
            const bodyError =
              respBody && typeof respBody === 'object' && 'error' in respBody
                ? String(respBody.error)
                : null;
            logger.error('qiniu', 'Upload failed', undefined, {
              statusCode: respInfo.statusCode,
              body: respBody,
            });
            resolve({
              success: false,
              error: bodyError
                ? `上传失败: ${bodyError} (HTTP ${respInfo.statusCode})`
                : `上传失败: HTTP ${respInfo.statusCode}`,
            });
          }
        }
      );
    });
  } catch (error) {
    logger.error('qiniu', 'Upload exception', error);
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
      logger.error('qiniu', 'Config not found, cannot delete file');
      return false;
    }

    logger.info('qiniu', 'Deleting file from Qiniu', { key });

    const mac = new qiniu.auth.digest.Mac(config.accessKey, config.secretKey);
    const qiniuConfig = new qiniu.conf.Config({
      zone: getQiniuZone(config.region),
    });

    const bucketManager = new qiniu.rs.BucketManager(mac, qiniuConfig);

    return new Promise(resolve => {
      bucketManager.delete(config.bucket, key, (err, respBody, respInfo) => {
        if (err) {
          logger.error('qiniu', 'File deletion failed', err, { key });
          resolve(false);
          return;
        }

        if (respInfo.statusCode === 200) {
          logger.info('qiniu', 'File deleted successfully', { key });
          resolve(true);
        } else {
          logger.error('qiniu', 'File deletion failed', undefined, {
            statusCode: respInfo.statusCode,
            body: respBody,
            key,
          });
          resolve(false);
        }
      });
    });
  } catch (error) {
    logger.error('qiniu', 'File deletion exception', error, { key });
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

    logger.info('qiniu', 'Testing Qiniu connection', {
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
            logger.error('qiniu', 'Connection test failed', err);
            resolve({
              success: false,
              message: `连接失败: ${err.message}`,
            });
            return;
          }

          if (respInfo.statusCode === 200) {
            logger.info('qiniu', 'Connection test successful');
            resolve({
              success: true,
              message: '七牛云连接测试成功',
            });
          } else if (respInfo.statusCode === 401) {
            logger.error('qiniu', 'Authentication failed', undefined, {
              statusCode: 401,
            });
            resolve({
              success: false,
              message: '连接失败: Access Key 或 Secret Key 不正确',
            });
          } else if (respInfo.statusCode === 631) {
            logger.error('qiniu', 'Bucket not found', undefined, {
              statusCode: 631,
            });
            resolve({
              success: false,
              message: '连接失败: 存储空间不存在',
            });
          } else {
            logger.error('qiniu', 'Connection test failed', undefined, {
              statusCode: respInfo.statusCode,
            });
            resolve({
              success: false,
              message: `连接失败: HTTP ${respInfo.statusCode}`,
            });
          }
        }
      );
    });
  } catch (error) {
    logger.error('qiniu', 'Connection test exception', error);
    return {
      success: false,
      message: `连接异常: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}
