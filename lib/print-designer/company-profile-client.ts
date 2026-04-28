import type { BasicSettings, SettingsApiResponse } from '@/lib/types/settings';

import type { PrintCompanyProfile } from './company-profile';

export async function fetchPrintCompanyProfile(): Promise<PrintCompanyProfile | null> {
  const response = await fetch('/api/settings/basic', {
    credentials: 'include',
    cache: 'no-store',
  });

  const payload =
    (await response.json().catch(() => null)) as SettingsApiResponse<BasicSettings> | null;

  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.error ?? '获取公司信息失败');
  }

  return {
    name: payload.data.companyName,
    address: payload.data.companyAddress ?? '',
    phone: payload.data.companyPhone ?? '',
    fax: '',
  };
}
