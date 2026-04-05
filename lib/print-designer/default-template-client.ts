import type { PrintTemplate, TemplateType } from '@/lib/print-designer/schemas';

type DefaultTemplateResponse = {
  success: boolean;
  data?: PrintTemplate | null;
  error?: string;
};

export async function fetchDefaultTemplate(
  templateType: TemplateType
): Promise<DefaultTemplateResponse> {
  try {
    const response = await fetch(
      `/api/print-templates/default?type=${encodeURIComponent(templateType)}`,
      {
        credentials: 'include',
        cache: 'no-store',
      }
    );

    const payload = (await response.json().catch(() => null)) as
      | DefaultTemplateResponse
      | null;

    if (!response.ok) {
      return {
        success: false,
        error: payload?.error ?? '获取默认模板失败',
      };
    }

    return (
      payload ?? {
        success: false,
        error: '获取默认模板失败',
      }
    );
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取默认模板失败',
    };
  }
}
