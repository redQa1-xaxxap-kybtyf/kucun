/**
 * IP地理位置定位服务
 * 使用 MaxMind GeoLite2 离线数据库
 * 严格遵循全栈项目统一约定规范
 */

import fs from 'fs';
import path from 'path';

import maxmind, { type CityResponse, type Reader } from 'maxmind';

/**
 * IP地理位置信息接口
 */
export interface IpLocationInfo {
  /** 国家 */
  country: string | null;
  /** 省份/州 */
  province: string | null;
  /** 城市 */
  city: string | null;
  /** 纬度 */
  latitude: number | null;
  /** 经度 */
  longitude: number | null;
  /** 完整位置字符串 */
  fullLocation: string | null;
}

// GeoLite2 数据库路径
const DB_PATH = path.join(process.cwd(), 'data', 'GeoLite2-City.mmdb');

// 数据库读取器实例（单例模式）
let cityLookup: Reader<CityResponse> | null = null;

/**
 * 初始化 MaxMind 数据库
 * 使用懒加载模式，仅在首次使用时加载
 */
async function initDatabase(): Promise<Reader<CityResponse> | null> {
  if (cityLookup) {
    return cityLookup;
  }

  try {
    // 检查数据库文件是否存在
    if (!fs.existsSync(DB_PATH)) {
      console.warn(
        `IP定位数据库不存在: ${DB_PATH}\n` +
          `请运行 npm run download-geoip 下载数据库`
      );
      return null;
    }

    // 加载数据库
    cityLookup = await maxmind.open<CityResponse>(DB_PATH);
    console.info('✅ MaxMind GeoLite2 数据库加载成功');
    return cityLookup;
  } catch (error) {
    console.error('❌ MaxMind GeoLite2 数据库加载失败:', error);
    return null;
  }
}

/**
 * 验证IP地址格式
 * 支持 IPv4 和 IPv6
 */
function isValidIp(ip: string): boolean {
  // IPv4 正则
  const ipv4Regex = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/;
  // IPv6 正则
  const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::)$/;

  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * 过滤内网IP地址
 * 内网IP无法获取真实地理位置
 */
function isPrivateIp(ip: string): boolean {
  // 局域网IP段
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^localhost$/,
  ];

  return privateRanges.some(range => range.test(ip));
}

/**
 * 获取IP地理位置信息
 *
 * @param ip - IP地址（IPv4 或 IPv6）
 * @returns IP地理位置信息，如果无法获取则返回null
 *
 * @example
 * ```typescript
 * const location = await getIpLocation('8.8.8.8');
 * console.log(location?.fullLocation); // "美国 加利福尼亚州"
 * ```
 */
export async function getIpLocation(
  ip: string | null | undefined
): Promise<IpLocationInfo | null> {
  // 参数校验
  if (!ip || typeof ip !== 'string') {
    return null;
  }

  const trimmedIp = ip.trim();

  // IP格式验证
  if (!isValidIp(trimmedIp)) {
    console.warn(`无效的IP地址格式: ${trimmedIp}`);
    return null;
  }

  // 过滤内网IP
  if (isPrivateIp(trimmedIp)) {
    return {
      country: '内网',
      province: null,
      city: null,
      latitude: null,
      longitude: null,
      fullLocation: '内网IP',
    };
  }

  try {
    // 初始化数据库
    const db = await initDatabase();
    if (!db) {
      return null;
    }

    // 查询IP地理位置
    const result = db.get(trimmedIp);
    if (!result) {
      return null;
    }

    // 提取地理位置信息（优先使用中文）
    const country =
      result.country?.names?.['zh-CN'] || result.country?.names?.en || null;
    const province =
      result.subdivisions?.[0]?.names?.['zh-CN'] ||
      result.subdivisions?.[0]?.names?.en ||
      null;
    const city =
      result.city?.names?.['zh-CN'] || result.city?.names?.en || null;
    const latitude = result.location?.latitude ?? null;
    const longitude = result.location?.longitude ?? null;

    // 构建完整位置字符串
    const locationParts = [country, province, city].filter(Boolean);
    const fullLocation =
      locationParts.length > 0 ? locationParts.join(' ') : null;

    return {
      country,
      province,
      city,
      latitude,
      longitude,
      fullLocation,
    };
  } catch (error) {
    console.error(`获取IP地理位置失败 (${trimmedIp}):`, error);
    return null;
  }
}

/**
 * 批量获取IP地理位置信息
 *
 * @param ips - IP地址数组
 * @returns IP地理位置信息数组
 */
export async function getIpLocations(
  ips: (string | null | undefined)[]
): Promise<(IpLocationInfo | null)[]> {
  return Promise.all(ips.map(ip => getIpLocation(ip)));
}

/**
 * 格式化地理位置显示
 *
 * @param location - IP地理位置信息
 * @param format - 显示格式 ('full' | 'short')
 * @returns 格式化的位置字符串
 */
export function formatLocation(
  location: IpLocationInfo | null,
  format: 'full' | 'short' = 'short'
): string {
  if (!location) {
    return '-';
  }

  if (format === 'short') {
    // 短格式：国家 城市
    const parts = [location.country, location.city].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : '-';
  }

  // 完整格式
  return location.fullLocation || '-';
}
