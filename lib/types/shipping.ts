/**
 * 运输查询系统类型定义
 */

// 运输站点状态
export type ShippingSiteStatus = 'active' | 'inactive';

// 查询状态
export type QueryStatus = 'pending' | 'success' | 'failed';

// 数据提取字段配置（单个字段）
export interface ExtractField {
  key: string; // 字段键值（英文，如 "status"）
  label: string; // 字段显示名称（中文，如 "状态"）
  selector: string; // CSS选择器
  required: boolean; // 是否必填
  description?: string; // 字段说明
}

// 数据提取选择器配置（向后兼容的旧格式）
export interface ExtractSelectors {
  status: string; // 状态选择器
  destination: string; // 目的地选择器
  estimatedArrival: string; // 预计到达时间选择器
  updateTime: string; // 更新时间选择器
  [key: string]: string; // 支持动态字段
}

// 站点配置模板
export interface SiteTemplate {
  id: string;
  name: string; // 模板名称（如 "顺丰速运"）
  description: string; // 模板说明
  url: string; // 默认URL
  searchInputSelector: string;
  searchButtonSelector: string;
  resultContainerSelector: string;
  extractFields: ExtractField[]; // 提取字段配置
  icon?: string; // 模板图标
}

// 运输站点配置基础接口（不包含敏感信息）
export interface ShippingSiteBase {
  id: string;
  name: string;
  description?: string;
  searchInputSelector: string;
  searchButtonSelector: string;
  resultContainerSelector: string;
  extractSelectors: string; // JSON字符串
  status: ShippingSiteStatus;
  createdAt: string;
  updatedAt: string;
}

// 运输站点配置（公开版本 - 不包含 URL）
export interface ShippingSitePublic extends ShippingSiteBase {
  urlMasked?: boolean; // 标记 URL 已被隐藏
}

// 运输站点配置（管理员版本 - 包含 URL）
export interface ShippingSiteAdmin extends ShippingSiteBase {
  url: string;
}

// 运输站点配置（联合类型）
export type ShippingSite = ShippingSitePublic | ShippingSiteAdmin;

// 类型守卫：检查是否包含 URL
export function hasUrl(site: ShippingSite): site is ShippingSiteAdmin {
  return 'url' in site && typeof site.url === 'string';
}

// 运输站点创建输入
export interface ShippingSiteCreateInput {
  name: string;
  url: string;
  description?: string;
  searchInputSelector: string;
  searchButtonSelector: string;
  resultContainerSelector: string;
  extractSelectors: ExtractSelectors | ExtractField[]; // 支持两种格式
  templateId?: string; // 可选：从模板创建
}

// 运输站点更新输入
export interface ShippingSiteUpdateInput {
  name?: string;
  url?: string;
  description?: string;
  searchInputSelector?: string;
  searchButtonSelector?: string;
  resultContainerSelector?: string;
  extractSelectors?: ExtractSelectors;
  status?: ShippingSiteStatus;
}

// 运输查询记录
export interface ShippingQuery {
  id: string;
  siteId: string;
  trackingNumber: string;
  inputKeyword: string;
  status?: string;
  destination?: string;
  estimatedArrival?: string;
  lastUpdateTime?: string;
  queryStatus: QueryStatus;
  errorMessage?: string;
  queriedAt: string;
  createdAt: string;
  updatedAt: string;
  site?: ShippingSite;
}

// 运输查询输入
export interface ShippingQueryInput {
  siteId: string;
  keyword: string; // 用户输入的关键词(可能是中文)
}

// 查询结果
export interface ShippingQueryResult {
  status?: string;
  destination?: string;
  estimatedArrival?: string;
  lastUpdateTime?: string;
}

// API响应类型
export interface ShippingSitesResponse {
  data: ShippingSite[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ShippingQueriesResponse {
  data: ShippingQuery[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
