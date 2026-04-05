import type { TemplateType } from '@/lib/print-designer/schemas';

export interface RecentPrintDocumentOption {
  id: string;
  label: string;
  secondary: string;
  description: string;
}

type PreviewDataResponse = {
  success: boolean;
  data?: Record<string, unknown> | null;
  error?: string;
};

type RecentDocumentsResponse = {
  success: boolean;
  data?: RecentPrintDocumentOption[];
  error?: string;
};

async function parseJsonResponse<T extends { error?: string }>(
  response: Response,
  fallbackMessage: string
): Promise<T> {
  const payload = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? fallbackMessage);
  }

  if (!payload) {
    throw new Error(fallbackMessage);
  }

  return payload;
}

export async function fetchPrintDataForTemplate(
  templateType: TemplateType,
  documentId: string
): Promise<Record<string, unknown> | null> {
  const response = await fetch(
    `/api/print-templates/preview-data?type=${encodeURIComponent(templateType)}&documentId=${encodeURIComponent(documentId)}`,
    {
      credentials: 'include',
      cache: 'no-store',
    }
  );

  const payload = await parseJsonResponse<PreviewDataResponse>(
    response,
    '获取打印数据失败'
  );

  if (!payload.success) {
    throw new Error(payload.error ?? '获取打印数据失败');
  }

  return payload.data ?? null;
}

export async function fetchRecentDocumentsForTemplate(
  templateType: TemplateType,
  limit = 10
): Promise<RecentPrintDocumentOption[]> {
  const response = await fetch(
    `/api/print-templates/recent-documents?type=${encodeURIComponent(templateType)}&limit=${encodeURIComponent(String(limit))}`,
    {
      credentials: 'include',
      cache: 'no-store',
    }
  );

  const payload = await parseJsonResponse<RecentDocumentsResponse>(
    response,
    '获取最近单据失败'
  );

  if (!payload.success) {
    throw new Error(payload.error ?? '获取最近单据失败');
  }

  return payload.data ?? [];
}
