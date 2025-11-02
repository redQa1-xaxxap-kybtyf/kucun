/**
 * 运输查询站点预设模板
 * 提供常用物流公司的配置模板，方便快速创建
 */

import type { ExtractField, SiteTemplate } from '@/lib/types/shipping';

// 默认提取字段配置（适用于大多数物流站点）
export const DEFAULT_EXTRACT_FIELDS: ExtractField[] = [
  {
    key: 'status',
    label: '状态',
    selector: '.status',
    required: true,
    description: '货物当前状态（如：已揽收、运输中、已签收等）',
  },
  {
    key: 'location',
    label: '当前位置',
    selector: '.location',
    required: false,
    description: '货物当前所在位置',
  },
  {
    key: 'destination',
    label: '目的地',
    selector: '.destination',
    required: false,
    description: '货物目的地',
  },
  {
    key: 'estimatedArrival',
    label: '预计到达',
    selector: '.arrival-time',
    required: false,
    description: '预计到达时间',
  },
  {
    key: 'updateTime',
    label: '更新时间',
    selector: '.update-time',
    required: false,
    description: '信息最后更新时间',
  },
];

// 预设站点模板
export const SITE_TEMPLATES: SiteTemplate[] = [
  {
    id: 'sfexpress',
    name: '顺丰速运',
    description: '顺丰速运官方物流查询',
    url: 'https://www.sf-express.com/cn/sc/dynamic_function/waybill/',
    searchInputSelector: 'input[name="trackingNo"]',
    searchButtonSelector: 'button.search-btn',
    resultContainerSelector: '.tracking-result',
    extractFields: [
      {
        key: 'status',
        label: '状态',
        selector: '.waybill-status',
        required: true,
        description: '当前物流状态',
      },
      {
        key: 'currentCity',
        label: '所在城市',
        selector: '.current-city',
        required: false,
        description: '货物当前所在城市',
      },
      {
        key: 'destination',
        label: '目的地',
        selector: '.destination-address',
        required: false,
        description: '收件地址',
      },
    ],
    icon: '📦',
  },
  {
    id: 'zhongtong',
    name: '中通快递',
    description: '中通快递官方物流查询',
    url: 'https://www.zto.com/GuestService/Bill',
    searchInputSelector: '#txtBill',
    searchButtonSelector: '#btnQuery',
    resultContainerSelector: '.result-area',
    extractFields: DEFAULT_EXTRACT_FIELDS,
    icon: '🚚',
  },
  {
    id: 'yuantong',
    name: '圆通速递',
    description: '圆通速递官方物流查询',
    url: 'https://www.yto.net.cn/gw/front/trace',
    searchInputSelector: 'input[name="mailNo"]',
    searchButtonSelector: '.query-btn',
    resultContainerSelector: '.trace-list',
    extractFields: DEFAULT_EXTRACT_FIELDS,
    icon: '📮',
  },
  {
    id: 'yunda',
    name: '韵达快递',
    description: '韵达快递官方物流查询',
    url: 'https://www.yundaex.com/cn/index.php',
    searchInputSelector: '#nu',
    searchButtonSelector: '#query',
    resultContainerSelector: '.result-box',
    extractFields: DEFAULT_EXTRACT_FIELDS,
    icon: '📫',
  },
  {
    id: 'shentong',
    name: '申通快递',
    description: '申通快递官方物流查询',
    url: 'https://www.sto.cn/query',
    searchInputSelector: 'input.tracking-input',
    searchButtonSelector: 'button.query-button',
    resultContainerSelector: '.tracking-content',
    extractFields: DEFAULT_EXTRACT_FIELDS,
    icon: '📬',
  },
  {
    id: 'jd',
    name: '京东物流',
    description: '京东物流官方查询',
    url: 'https://www.jdl.com/',
    searchInputSelector: '#search-input',
    searchButtonSelector: '#search-btn',
    resultContainerSelector: '.logistics-info',
    extractFields: [
      ...DEFAULT_EXTRACT_FIELDS,
      {
        key: 'courierName',
        label: '快递员',
        selector: '.courier-name',
        required: false,
        description: '快递员姓名',
      },
      {
        key: 'courierPhone',
        label: '联系电话',
        selector: '.courier-phone',
        required: false,
        description: '快递员联系电话',
      },
    ],
    icon: '🛒',
  },
  {
    id: 'custom',
    name: '自定义站点',
    description: '从空白开始创建自定义查询站点',
    url: '',
    searchInputSelector: '',
    searchButtonSelector: '',
    resultContainerSelector: '',
    extractFields: DEFAULT_EXTRACT_FIELDS,
    icon: '⚙️',
  },
];

/**
 * 根据模板ID获取模板
 */
export function getTemplateById(id: string): SiteTemplate | undefined {
  return SITE_TEMPLATES.find(template => template.id === id);
}

/**
 * 获取所有可用模板
 */
export function getAllTemplates(): SiteTemplate[] {
  return SITE_TEMPLATES;
}
