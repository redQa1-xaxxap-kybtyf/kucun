export interface PrintCompanyProfile {
  name?: string;
  address?: string;
  phone?: string;
  fax?: string;
}

export function applyCompanyProfileToPreviewData(
  data: Record<string, unknown>,
  companyProfile?: PrintCompanyProfile | null
): Record<string, unknown> {
  if (!companyProfile) {
    return data;
  }

  const currentCompany =
    data.company && typeof data.company === 'object' && !Array.isArray(data.company)
      ? (data.company as Record<string, unknown>)
      : {};

  return {
    ...data,
    company: {
      ...currentCompany,
      ...(companyProfile.name !== undefined ? { name: companyProfile.name } : {}),
      ...(companyProfile.address !== undefined
        ? { address: companyProfile.address }
        : {}),
      ...(companyProfile.phone !== undefined ? { phone: companyProfile.phone } : {}),
      ...(companyProfile.fax !== undefined ? { fax: companyProfile.fax } : {}),
    },
  };
}
