export const PRINT_TEMPLATE_STORAGE_UNAVAILABLE_MESSAGE =
  '当前环境缺少 print_templates 表，暂时无法保存或管理打印模板，请先完成数据库升级。';

export function isMissingPrintTemplatesTableError(error: unknown): boolean {
  const anyErr = error as {
    code?: unknown;
    message?: unknown;
    meta?: { table?: unknown; modelName?: unknown } | null;
  };

  if (anyErr?.code === 'P2021') {
    return true;
  }

  const tableName =
    typeof anyErr?.meta?.table === 'string' ? anyErr.meta.table : '';
  const message = String(anyErr?.message ?? '');

  return (
    tableName.includes('print_templates') ||
    (message.includes('does not exist') && message.includes('print_templates'))
  );
}
