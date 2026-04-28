import { csrfFetch } from '@/lib/utils/csrf';

import type { PrintTemplate } from './schemas';

export interface PrintTemplateActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PrintTemplateListItem {
  id: string;
  name: string;
  type: string;
  isDefault: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

async function parseTemplateResponse<T>(
  response: Response,
  fallbackError: string
): Promise<PrintTemplateActionResult<T>> {
  const result = (await response.json().catch(() => null)) as
    | PrintTemplateActionResult<T>
    | null;

  if (!response.ok) {
    return {
      success: false,
      error: result?.error ?? fallbackError,
    };
  }

  return result ?? { success: false, error: fallbackError };
}

export async function fetchPrintTemplates(type?: string) {
  const params = new URLSearchParams();
  if (type) {
    params.set('type', type);
  }

  const response = await fetch(
    `/api/print-templates${params.size ? `?${params.toString()}` : ''}`
  );

  return parseTemplateResponse<PrintTemplateListItem[]>(
    response,
    '加载模板列表失败'
  );
}

export async function fetchPrintTemplate(id: string) {
  const response = await fetch(`/api/print-templates/${encodeURIComponent(id)}`);
  return parseTemplateResponse<PrintTemplate>(response, '加载模板失败');
}

export async function savePrintTemplate(template: PrintTemplate) {
  const response = await csrfFetch('/api/print-templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(template),
  });

  return parseTemplateResponse<{ id: string }>(response, '保存模板失败');
}

export async function removePrintTemplate(id: string) {
  const response = await csrfFetch(
    `/api/print-templates/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    }
  );

  return parseTemplateResponse(response, '删除模板失败');
}

export async function copyPrintTemplate(id: string) {
  const response = await csrfFetch(
    `/api/print-templates/${encodeURIComponent(id)}/duplicate`,
    {
      method: 'POST',
    }
  );

  return parseTemplateResponse<{ id: string }>(response, '复制模板失败');
}

export async function markDefaultPrintTemplate(id: string, type: string) {
  const response = await csrfFetch(
    `/api/print-templates/${encodeURIComponent(id)}/set-default`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    }
  );

  return parseTemplateResponse(response, '设置默认模板失败');
}
