/**
 * 入库记录服务端数据获取函数
 * 用于 Next.js 15.4 Server Components
 */

import { getInboundRecords, parseInboundQueryParams } from './inbound-handlers';

export async function getInboundRecordsServer(searchParams: URLSearchParams) {
  // 解析查询参数
  const queryData = parseInboundQueryParams(searchParams);

  // 获取入库记录列表
  return await getInboundRecords(queryData);
}
