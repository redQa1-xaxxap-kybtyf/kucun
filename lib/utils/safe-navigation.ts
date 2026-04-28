export function sanitizeInternalPath(
  value: string | null | undefined,
  fallback = '/'
) {
  const normalized = value?.trim();

  if (!normalized || !normalized.startsWith('/') || normalized.startsWith('//')) {
    return fallback;
  }

  return normalized;
}
