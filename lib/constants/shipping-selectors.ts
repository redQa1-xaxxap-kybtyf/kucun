/**
 * 运输查询选择器常量库
 * SOLID-S: 单一职责 - 提供常用的CSS选择器配置
 * DRY: 避免重复定义常用选择器
 */

export const SHIPPING_SELECTORS = {
  // 搜索输入框选择器
  searchInput: [
    // 基础选择器
    '#txtKey',
    'input[name="keyword"]',
    'input[name="search"]',
    'input[name="query"]',
    'input[name="tracking"]',
    'input[name="bill"]',
    'input[name="trackingNo"]',
    'input[name="container"]',
    'input[name="mmsi"]',
    'input[name="vessel"]',

    // ID选择器
    '#trackingNo',
    '#search',
    '#keyword',
    '#query',
    '#bill',
    '#tracking',
    '#containerNumber',
    '#mmsiNumber',

    // 类型选择器
    'input[type="search"]',
    'input[type="text"]',

    // 类选择器
    '.search-input',
    '.search-box',
    '.tracking-input',
    '.query-input',
    '.form-control',
    '.input-text',
    '.search-field',

    // 占位符选择器
    'input[placeholder*="搜索"]',
    'input[placeholder*="查询"]',
    'input[placeholder*="track"]',
    'input[placeholder*="单号"]',
    'input[placeholder*="运单"]',
    'input[placeholder*="集装箱"]',
    'input[placeholder*="MMSI"]',
    'input[placeholder*="船名"]',
    'input[placeholder*="输入"]',
    'input[placeholder*="请输入"]',

    // 数据属性选择器
    'input[data-testid*="search"]',
    'input[data-testid*="tracking"]',
    'input[data-cy*="search"]',
    'input[data-cy*="input"]',
    '[data-purpose="search"]',
    '[data-purpose="tracking"]',

    // 结构选择器
    '.search-box input',
    '.search-form input',
    '.query-form input',
    '.tracking-form input',
    'form input[type="text"]:first-of-type',
    '.search-container input:first-child',
  ],

  // 搜索按钮选择器
  searchButton: [
    // 基础按钮选择器
    'button.search-btn',
    'button[type="submit"]',
    'input[type="submit"]',
    '#searchBtn',
    '#btnQuery',
    '#queryBtn',
    '#submit',

    // 类选择器
    '.btn-primary',
    '.btn-search',
    '.search-btn',
    '.query-btn',
    '.submit-btn',
    '.search-button',
    '.query-button',

    // 文本内容选择器（需要特殊处理）
    'button[class*="search"]',
    'button[class*="query"]',
    'button[class*="submit"]',
    'input[value*="查询"]',
    'input[value*="搜索"]',
    'input[value*="Search"]',
    'input[value*="Track"]',

    // 图标按钮
    '.search-icon',
    '.icon-search',
    '.fa-search',
    '.search-icon-container',

    // 数据属性选择器
    'button[data-testid*="search"]',
    'button[data-testid*="submit"]',
    'button[data-cy*="search"]',
    'button[data-cy*="submit"]',
    '[data-action="search"]',
    '[data-purpose="search"]',

    // 结构选择器
    '.search-box button',
    '.search-form button',
    '.query-form button',
    '.search-container button',
    'form button[type="submit"]',
    '.input-group button',
  ],

  // 结果容器选择器
  resultContainer: [
    // 基础容器
    '#shipAIS',
    '#results',
    '#result',
    '#content',
    '#data',

    // 表格容器
    'table',
    '.table',
    '.data-table',
    '.result-table',
    '.tracking-table',
    'tbody',
    '.table-body',

    // 列表容器
    '.result-list',
    '.tracking-list',
    '.data-list',
    '.search-results',
    '.query-results',
    'ul.results',
    'ol.results',

    // 卡片容器
    '.result-card',
    '.tracking-card',
    '.data-card',
    '.info-card',
    '.result-item',
    '.tracking-item',

    // 通用容器
    '.result-container',
    '.search-result',
    '.query-result',
    '.tracking-result',
    '.content-area',
    '.data-area',
    '.info-area',
    '.main-content',
    '.detail-content',

    // 动态容器
    '.dynamic-content',
    '.ajax-content',
    '.loaded-content',
    '[data-loaded="true"]',
    '[data-content="result"]',

    // 特定网站容器
    '.trace-list',
    '.vessel-info',
    '.shipment-info',
    '.container-info',
    '.cargo-info',
    '.logistics-info',

    // 结构化容器
    '.details',
    '.information',
    '.summary',
    '.overview',
    '.status-panel',
    '.info-panel',
  ],

  // 状态字段选择器
  status: [
    // 直接选择器
    '.status',
    '.state',
    '.tracking-status',
    '.shipment-status',
    '.vessel-status',
    '.current-status',
    '#status',
    '#state',

    // 表格单元格
    'td:contains("状态") + td',
    'td:contains("State") + td',
    'td:contains("Status") + td',
    'th:contains("状态") ~ td',
    'tr td:nth-child(2)', // 假设状态在第二列

    // 列表项
    '.status-item',
    '.state-item',
    '.info-status',
    '.detail-status',

    // 卡片中的状态
    '.card .status',
    '.result-item .status',
    '.info-panel .status',

    // 数据属性
    '[data-field="status"]',
    '[data-status]',
    '[data-state]',

    // 图标状态
    '.status-icon',
    '.state-icon',
    '.icon-status',
  ],

  // 位置/目的地字段选择器
  destination: [
    // 直接选择器
    '.destination',
    '.location',
    '.port',
    '.current-location',
    '.destination-port',
    '.arrival-port',
    '.final-destination',
    '#destination',
    '#location',
    '#port',

    // 表格单元格
    'td:contains("目的地") + td',
    'td:contains("港口") + td',
    'td:contains("Destination") + td',
    'td:contains("Port") + td',
    'td:contains("Location") + td',
    'th:contains("目的地") ~ td',
    'th:contains("港口") ~ td',
    'tr td:nth-child(3)', // 假设位置在第三列

    // 详细位置信息
    '.route-info',
    '.path-info',
    '.itinerary',
    '.voyage-info',
    '.journey-info',

    // 数据属性
    '[data-field="destination"]',
    '[data-field="location"]',
    '[data-field="port"]',
    '[data-destination]',
    '[data-location]',
  ],

  // 时间字段选择器
  time: [
    // 直接选择器
    '.time',
    '.date',
    '.timestamp',
    '.update-time',
    '.arrival-time',
    '.departure-time',
    '.estimated-time',
    '.eta',
    '.last-update',
    '#time',
    '#date',
    '#eta',

    // 表格单元格
    'td:contains("时间") + td',
    'td:contains("日期") + td',
    'td:contains("预到") + td',
    'td:contains("更新") + td',
    'td:contains("Time") + td',
    'td:contains("Date") + td',
    'td:contains("ETA") + td',
    'td:contains("Update") + td',
    'th:contains("时间") ~ td',
    'th:contains("日期") ~ td',
    'tr td:nth-child(4)', // 假设时间在第四列

    // 相对时间
    '.relative-time',
    '.time-ago',
    '.time-diff',

    // 时间格式
    '.datetime',
    '.time-format',
    '.date-format',

    // 数据属性
    '[data-field="time"]',
    '[data-field="date"]',
    '[data-field="eta"]',
    '[data-time]',
    '[data-date]',
    '[data-timestamp]',
  ],
} as const;

/**
 * 网站特定的选择器配置
 */
export const WEBSITE_SPECIFIC_SELECTORS = {
  // 船舶查询网站
  shipxy: {
    searchInput: '#txtKey',
    searchButton: '.search-btn',
    resultContainer: '#shipAIS',
    fields: {
      mmsi: 'td:contains("MMSI：") + td',
      shipStatus: 'td:contains("状态：") + td',
      destination: 'td:contains("目的地：") + td',
      eta: 'td:contains("预到时间：") + td',
      updateTime: 'td:contains("更新时间：") + td',
    }
  },

  // 顺丰快递
  sfexpress: {
    searchInput: 'input[name="trackingNo"]',
    searchButton: 'button.search-btn',
    resultContainer: '.tracking-result',
    fields: {
      status: '.waybill-status',
      location: '.current-city',
      estimatedTime: '.arrival-time',
    }
  },

  // 中通快递
  zto: {
    searchInput: 'input[name="code"]',
    searchButton: '.search-btn',
    resultContainer: '.waybill-tracking',
    fields: {
      status: '.status-info',
      location: '.location-info',
      time: '.time-info',
    }
  },

  // 通用物流网站
  generic: {
    searchInput: 'input[type="text"]',
    searchButton: 'button[type="submit"]',
    resultContainer: '.result-container',
    fields: {
      status: '.status',
      location: '.location',
      time: '.time',
    }
  }
} as const;

/**
 * 选择器模板
 */
export const SELECTOR_TEMPLATES = {
  // 表格模板
  table: {
    container: 'table',
    status: 'td:contains("状态") + td',
    location: 'td:contains("位置") + td',
    time: 'td:contains("时间") + td',
  },

  // 列表模板
  list: {
    container: '.result-list',
    status: '.status',
    location: '.location',
    time: '.time',
  },

  // 卡片模板
  card: {
    container: '.result-card',
    status: '.card-status',
    location: '.card-location',
    time: '.card-time',
  },

  // 详情面板模板
  panel: {
    container: '.detail-panel',
    status: '.panel-status',
    location: '.panel-location',
    time: '.panel-time',
  }
} as const;

/**
 * 常用选择器组合
 */
export const COMMON_SELECTOR_COMBINATIONS = {
  // 基础组合
  basic: {
    searchInput: SHIPPING_SELECTORS.searchInput.slice(0, 5),
    searchButton: SHIPPING_SELECTORS.searchButton.slice(0, 5),
    resultContainer: SHIPPING_SELECTORS.resultContainer.slice(0, 5),
  },

  // 全面组合
  comprehensive: {
    searchInput: SHIPPING_SELECTORS.searchInput,
    searchButton: SHIPPING_SELECTORS.searchButton,
    resultContainer: SHIPPING_SELECTORS.resultContainer,
  },

  // 轻量组合
  lightweight: {
    searchInput: SHIPPING_SELECTORS.searchInput.slice(0, 3),
    searchButton: SHIPPING_SELECTORS.searchButton.slice(0, 3),
    resultContainer: SHIPPING_SELECTORS.resultContainer.slice(0, 3),
  }
} as const;