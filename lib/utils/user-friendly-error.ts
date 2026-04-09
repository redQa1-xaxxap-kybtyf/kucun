const FIELD_LABELS: Record<string, string> = {
  id: '编号',
  name: '名称',
  code: '编码',
  sku: 'SKU',
  phone: '联系电话',
  mobile: '手机号',
  email: '邮箱地址',
  address: '地址',
  contactperson: '联系人',
  customerid: '客户',
  supplierid: '供应商',
  productid: '产品',
  variantid: '产品规格',
  categoryid: '分类',
  userid: '用户',
  orderid: '订单',
  ordernumber: '单号',
  salesorderid: '销售单',
  returnorderid: '退货单',
  batchnumber: '批次号',
  batchno: '批次号',
  barcode: '条码',
  specification: '规格',
  bankaccount: '银行账号',
  taxnumber: '税号',
  paymentdate: '付款日期',
  orderdate: '单据日期',
  region: '地区',
  shippingcompany: '船公司',
  containernumber: '柜号',
  createdat: '创建时间',
  updatedat: '更新时间',
};

const EXACT_ERROR_MESSAGE_MAP: Record<string, string> = {
  BadRequest: '请求数据有误，请检查后重试',
  'Bad Request': '请求数据有误，请检查后重试',
  Unauthorized: '登录状态已失效，请重新登录',
  Forbidden: '没有权限执行此操作',
  'Not Found': '未找到相关数据，请刷新后重试',
  'Internal Server Error': '服务器开小差了，请稍后重试',
  'Unknown error': '发生未知错误，请稍后重试',
  'Customer ID is required': '缺少客户标识，请刷新页面后重试',
  'Supplier ID is required': '缺少供应商标识，请刷新页面后重试',
  'Failed to fetch': '网络连接异常，请检查网络后重试',
  'fetch failed': '网络连接异常，请检查网络后重试',
  MISSING_FIELDS: '请填写完整信息后再提交',
  INVALID_FORMAT: '输入格式不正确，请检查后重试',
  CAPTCHA_SESSION_MISSING: '验证码已失效，请重新获取',
  CAPTCHA_INCORRECT: '验证码错误，请重新输入',
  TOO_MANY_ATTEMPTS: '操作过于频繁，请稍后再试',
  INVALID_CREDENTIALS: '用户名或密码错误，请检查后重试',
  SERVER_ERROR: '服务器开小差了，请稍后重试',
};

const HTTP_STATUS_MESSAGE_MAP: Record<number, string> = {
  400: '请求数据有误，请检查后重试',
  401: '登录状态已失效，请重新登录',
  403: '没有权限执行此操作',
  404: '未找到相关数据，请刷新后重试',
  408: '请求超时，请稍后重试',
  409: '数据已存在或状态冲突，请检查后重试',
  422: '提交的数据校验未通过，请检查后重试',
  429: '操作过于频繁，请稍后再试',
  500: '服务器开小差了，请稍后重试',
  502: '服务暂时不可用，请稍后重试',
  503: '服务暂时不可用，请稍后重试',
  504: '服务响应超时，请稍后重试',
};

type ErrorPayloadRecord = Record<string, unknown>;

function containsChinese(message: string): boolean {
  return /[\u4e00-\u9fff]/.test(message);
}

function cleanupMessage(message: string): string {
  return message.replace(/\s+/g, ' ').trim();
}

function normalizeFieldKey(field: string): string {
  return (
    field
      .trim()
      .replace(/[`"'()[\]{}]/g, '')
      .split('.')
      .pop()
      ?.replace(/[_-\s]/g, '')
      .toLowerCase() || ''
  );
}

function getFieldLabel(field: string): string {
  const normalizedField = normalizeFieldKey(field);
  return FIELD_LABELS[normalizedField] || field.replace(/[`"']/g, '').trim();
}

function replaceFieldTokens(message: string): string {
  let output = message;

  for (const [field, label] of Object.entries(FIELD_LABELS)) {
    const matcher = new RegExp(`\\b${field}\\b`, 'gi');
    output = output.replace(matcher, label);
  }

  return output;
}

function extractHttpStatus(message: string): number | null {
  const match = message.match(
    /\b(?:HTTP(?:\s+error!? status:)?\s*)?(400|401|403|404|408|409|422|429|500|502|503|504)\b/i
  );

  if (!match?.[1]) {
    return null;
  }

  return Number(match[1]);
}

function extractDuplicateFields(message: string): string[] {
  const fields = new Set<string>();

  const uniqueConstraintMatch = message.match(
    /unique constraint failed on the fields?:\s*\(([^)]+)\)/i
  );

  if (uniqueConstraintMatch?.[1]) {
    uniqueConstraintMatch[1]
      .split(',')
      .map(field => field.replace(/[`"' ]/g, '').trim())
      .filter(Boolean)
      .forEach(field => fields.add(field));
  }

  const quotedFieldMatches = message.matchAll(/[`'"]([a-zA-Z][\w.-]*)[`'"]/g);
  for (const [, field] of quotedFieldMatches) {
    fields.add(field);
  }

  return [...fields];
}

function extractMessageFromObject(payload: ErrorPayloadRecord): string | null {
  const nestedError = payload.error;

  if (typeof nestedError === 'string' && nestedError.trim()) {
    return nestedError;
  }

  if (nestedError && typeof nestedError === 'object') {
    const nestedMessage = (nestedError as ErrorPayloadRecord).message;
    if (typeof nestedMessage === 'string' && nestedMessage.trim()) {
      return nestedMessage;
    }
  }

  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message;
  }

  return null;
}

function extractDetailMessages(payload: ErrorPayloadRecord): string[] {
  const detailSources = [payload.details, payload.issues, payload.errors];

  return detailSources.flatMap(source => {
    if (!Array.isArray(source)) {
      return [];
    }

    return source
      .map(detail => {
        if (typeof detail === 'string' && detail.trim()) {
          return detail.trim();
        }

        if (detail && typeof detail === 'object') {
          const detailMessage = (detail as ErrorPayloadRecord).message;
          if (typeof detailMessage === 'string' && detailMessage.trim()) {
            return detailMessage.trim();
          }
        }

        return null;
      })
      .filter((detail): detail is string => Boolean(detail));
  });
}

function isGenericEnglishError(message: string): boolean {
  return (
    /(^|\s)(bad request|unauthorized|forbidden|not found|internal server error)(\s|$)/i.test(
      message
    ) ||
    /failed to fetch|network error|fetch failed/i.test(message) ||
    /timeout|timed out|econnaborted|etimedout/i.test(message) ||
    /unknown error/i.test(message)
  );
}

export function formatDuplicateFieldMessage(fields: string[]): string {
  const labels = fields.map(getFieldLabel).filter(Boolean);

  if (labels.length === 0) {
    return '数据已存在，请勿重复录入';
  }

  if (labels.length === 1) {
    return `${labels[0]}已存在，请勿重复录入`;
  }

  return `以下信息已存在：${labels.join('、')}，请检查后再试`;
}

export function normalizeUserFacingErrorMessage(
  message: string,
  fallback = '操作失败，请稍后重试'
): string {
  const rawMessage = cleanupMessage(message);

  if (!rawMessage) {
    return fallback;
  }

  const exactMessage = EXACT_ERROR_MESSAGE_MAP[rawMessage];
  if (exactMessage) {
    return exactMessage;
  }

  const duplicateFields = extractDuplicateFields(rawMessage);
  if (
    duplicateFields.length > 0 &&
    /unique constraint|already exists|duplicate key|duplicate entry/i.test(
      rawMessage
    )
  ) {
    return formatDuplicateFieldMessage(duplicateFields);
  }

  if (/failed to fetch|fetch failed|network error/i.test(rawMessage)) {
    return '网络连接异常，请检查网络后重试';
  }

  if (/timeout|timed out|econnaborted|etimedout|aborterror/i.test(rawMessage)) {
    return '请求超时，请稍后重试';
  }

  if (/bad request/i.test(rawMessage)) {
    return HTTP_STATUS_MESSAGE_MAP[400];
  }

  if (/\bunauthorized\b/i.test(rawMessage)) {
    return HTTP_STATUS_MESSAGE_MAP[401];
  }

  if (/\bforbidden\b/i.test(rawMessage)) {
    return HTTP_STATUS_MESSAGE_MAP[403];
  }

  if (/\bnot found\b/i.test(rawMessage)) {
    return HTTP_STATUS_MESSAGE_MAP[404];
  }

  if (/internal server error/i.test(rawMessage)) {
    return HTTP_STATUS_MESSAGE_MAP[500];
  }

  if (/permission denied|insufficient permissions/i.test(rawMessage)) {
    return '没有权限执行此操作';
  }

  const httpStatus = extractHttpStatus(rawMessage);
  if (httpStatus && HTTP_STATUS_MESSAGE_MAP[httpStatus]) {
    return HTTP_STATUS_MESSAGE_MAP[httpStatus];
  }

  if (/already exists|duplicate key|duplicate entry/i.test(rawMessage)) {
    return formatDuplicateFieldMessage(duplicateFields);
  }

  const localizedMessage = replaceFieldTokens(rawMessage)
    .replace(/\bUnknown error\b/gi, '发生未知错误')
    .replace(/\bUnknown\b/gi, '未知')
    .replace(/\bInvalid\b/gi, '无效')
    .replace(/\bUnsupported\b/gi, '不支持');

  if (containsChinese(localizedMessage)) {
    return cleanupMessage(localizedMessage);
  }

  if (isGenericEnglishError(rawMessage)) {
    return fallback;
  }

  return fallback;
}

export function getFriendlyErrorMessage(
  error: unknown,
  fallback = '操作失败，请稍后重试'
): string {
  if (error instanceof Error) {
    return normalizeUserFacingErrorMessage(error.message, fallback);
  }

  if (typeof error === 'string') {
    return normalizeUserFacingErrorMessage(error, fallback);
  }

  if (typeof error === 'object' && error !== null) {
    const message = extractMessageFromObject(error as ErrorPayloadRecord);
    if (message) {
      return normalizeUserFacingErrorMessage(message, fallback);
    }
  }

  return fallback;
}

export function extractApiErrorMessage(
  payload: unknown,
  fallback = '操作失败，请稍后重试'
): string {
  if (!payload || typeof payload !== 'object') {
    return normalizeUserFacingErrorMessage(fallback, fallback);
  }

  const payloadRecord = payload as ErrorPayloadRecord;
  const baseMessage =
    extractMessageFromObject(payloadRecord) ||
    (typeof payloadRecord.error === 'string' ? payloadRecord.error : fallback);
  const detailMessages = extractDetailMessages(payloadRecord);
  const normalizedBaseMessage = normalizeUserFacingErrorMessage(
    baseMessage,
    fallback
  );

  if (detailMessages.length === 0) {
    return normalizedBaseMessage;
  }

  const uniqueDetails = [...new Set(detailMessages)];
  const detailsText = uniqueDetails.join('；');

  if (normalizedBaseMessage.includes(detailsText)) {
    return normalizedBaseMessage;
  }

  return `${normalizedBaseMessage}：${detailsText}`;
}

export async function createFriendlyApiError(
  response: Response,
  fallback = '操作失败，请稍后重试'
): Promise<Error> {
  const fallbackMessage = response.statusText
    ? `${fallback}: ${response.statusText}`
    : `${fallback}: HTTP ${response.status}`;

  try {
    const rawText = await response.text();

    if (!rawText.trim()) {
      return new Error(
        normalizeUserFacingErrorMessage(fallbackMessage, fallback)
      );
    }

    try {
      const payload = JSON.parse(rawText);
      return new Error(extractApiErrorMessage(payload, fallback));
    } catch {
      return new Error(normalizeUserFacingErrorMessage(rawText, fallback));
    }
  } catch {
    return new Error(
      normalizeUserFacingErrorMessage(fallbackMessage, fallback)
    );
  }
}
