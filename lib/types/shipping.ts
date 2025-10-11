/**
 * 运输查询系统类型定义
 */

// 运输站点状态
export type ShippingSiteStatus = 'active' | 'inactive';

// 查询状态
export type QueryStatus = 'pending' | 'success' | 'failed';

// 数据提取选择器配置
export interface ExtractSelectors {
  status: string; // 状态选择器
  destination: string; // 目的地选择器
  estimatedArrival: string; // 预计到达时间选择器
  updateTime: string; // 更新时间选择器
}

// 运输站点配置
export interface ShippingSite {
  id: string;
  name: string;
  url: string;
  description?: string;
  searchInputSelector: string;
  searchButtonSelector: string;
  resultContainerSelector: string;
  extractSelectors: string; // JSON字符串
  status: ShippingSiteStatus;
  createdAt: string;
  updatedAt: string;
}

// 运输站点创建输入
export interface ShippingSiteCreateInput {
  name: string;
  url: string;
  description?: string;
  searchInputSelector: string;
  searchButtonSelector: string;
  resultContainerSelector: string;
  extractSelectors: ExtractSelectors;
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
