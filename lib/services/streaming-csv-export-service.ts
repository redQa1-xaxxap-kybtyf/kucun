/**
 * 流式CSV导出服务
 *
 * 职责：
 * - 大数据集（>=50k行）流式导出，防止内存溢出
 * - 使用cursor-based pagination + Transform Stream
 * - 批量处理数据（每批1000-5000行）
 * - UTF-8 BOM支持，防止中文乱码
 */

import { Transform } from 'stream';

import { formatInTimeZone } from 'date-fns-tz';

/**
 * 流式CSV导出选项
 */
export interface StreamingCSVOptions<T> {
  /** 日期字段列表 */
  dateFields?: (keyof T)[];
  /** 数字字段列表 */
  numberFields?: (keyof T)[];
  /** 日期格式 */
  dateFormat?: string;
  /** 字段顺序 */
  fieldOrder?: (keyof T)[];
}

/**
 * CSV值转义
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // 如果包含逗号、引号、换行符，需要用引号包裹并转义内部引号
  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * 流式CSV转换器
 * 将对象数组转换为CSV行
 */
export class CSVTransformStream<
  T extends Record<string, unknown>,
> extends Transform {
  private isFirstChunk = true;
  private headers: string[] = [];
  private readonly dateFields: Set<keyof T>;
  private readonly numberFields: Set<keyof T>;
  private readonly dateFormat: string;
  private readonly fieldOrder?: (keyof T)[];

  constructor(options: StreamingCSVOptions<T> = {}) {
    super({ objectMode: true });

    this.dateFields = new Set(options.dateFields || []);
    this.numberFields = new Set(options.numberFields || []);
    this.dateFormat = options.dateFormat || 'yyyy-MM-dd HH:mm:ss';
    this.fieldOrder = options.fieldOrder;
  }

  override _transform(
    chunk: T | T[],
    encoding: string,
    callback: (error?: Error | null, data?: string) => void
  ): void {
    try {
      const rows = Array.isArray(chunk) ? chunk : [chunk];

      if (rows.length === 0) {
        callback(null, '');
        return;
      }

      let output = '';

      // 第一批数据：输出BOM和表头
      if (this.isFirstChunk) {
        this.isFirstChunk = false;

        // UTF-8 BOM（防止Excel打开时中文乱码）
        output += '\uFEFF';

        // 提取表头
        const firstRow = rows[0];
        if (firstRow) {
          this.headers = this.fieldOrder
            ? (this.fieldOrder as string[])
            : Object.keys(firstRow);

          // 输出表头行
          output += `${this.headers.map(escapeCSVValue).join(',')}\n`;
        }
      }

      // 输出数据行
      for (const row of rows) {
        const values = this.headers.map(header => {
          const value = row[header];

          // 日期字段格式化
          if (this.dateFields.has(header as keyof T)) {
            if (value instanceof Date) {
              return formatInTimeZone(value, 'Asia/Shanghai', this.dateFormat);
            }
            if (typeof value === 'string' && value) {
              try {
                const date = new Date(value);
                return formatInTimeZone(date, 'Asia/Shanghai', this.dateFormat);
              } catch {
                return value;
              }
            }
          }

          // 数字字段保持原样
          if (this.numberFields.has(header as keyof T)) {
            if (typeof value === 'number') {
              return value.toString();
            }
          }

          return escapeCSVValue(value);
        });

        output += `${values.join(',')}\n`;
      }

      callback(null, output);
    } catch (error) {
      callback(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

/**
 * 批量数据获取函数类型
 */
export type BatchFetcher<T> = (
  cursor?: string | null,
  batchSize?: number
) => Promise<{
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}>;

/**
 * 流式CSV导出服务
 */
export class StreamingCSVExportService {
  /**
   * 创建流式CSV导出流
   *
   * @param fetchBatch 批量数据获取函数
   * @param options CSV选项
   * @param batchSize 每批数据量（默认2000）
   * @returns ReadableStream
   */
  static createExportStream<T extends Record<string, unknown>>(
    fetchBatch: BatchFetcher<T>,
    options: StreamingCSVOptions<T> = {},
    batchSize = 2000
  ): ReadableStream<Uint8Array> {
    const csvTransform = new CSVTransformStream(options);

    return new ReadableStream({
      async start(controller) {
        let cursor: string | null = null;
        let hasMore = true;

        try {
          while (hasMore) {
            // 获取一批数据
            const {
              data,
              nextCursor,
              hasMore: more,
            } = await fetchBatch(cursor, batchSize);

            if (data.length > 0) {
              // 写入Transform流进行处理
              const csvChunk = await new Promise<string>((resolve, reject) => {
                let result = '';

                csvTransform._transform(
                  data,
                  'utf8',
                  (error, transformedData) => {
                    if (error) {
                      reject(error);
                    } else {
                      result = transformedData || '';
                      resolve(result);
                    }
                  }
                );
              });

              // 输出到controller
              if (csvChunk) {
                const encoder = new TextEncoder();
                controller.enqueue(encoder.encode(csvChunk));
              }
            }

            cursor = nextCursor;
            hasMore = more;

            // 避免过快循环
            if (hasMore) {
              await new Promise(resolve => setImmediate(resolve));
            }
          }

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },

      cancel() {
        // 清理资源
      },
    });
  }

  /**
   * 估算数据量并决定是否使用流式导出
   *
   * @param totalCount 总记录数
   * @returns 是否使用流式导出
   */
  static shouldUseStreaming(totalCount: number): boolean {
    // 当数据量>=50k时使用流式导出
    return totalCount >= 50000;
  }

  /**
   * 生成流式导出的Response
   *
   * @param stream ReadableStream
   * @param filename 文件名
   * @returns Response
   */
  static createStreamResponse(
    stream: ReadableStream<Uint8Array>,
    filename: string
  ): Response {
    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv;charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      },
    });
  }
}
