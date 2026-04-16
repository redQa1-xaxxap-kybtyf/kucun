export function sanitizeReturnTo(returnTo: string | null | undefined) {
  const normalized = returnTo?.trim();

  if (!normalized || !normalized.startsWith('/') || normalized.startsWith('//')) {
    return undefined;
  }

  return normalized;
}

export function withReturnTo(path: string, returnTo?: string) {
  const safeReturnTo = sanitizeReturnTo(returnTo);

  if (!safeReturnTo) {
    return path;
  }

  const separator = path.includes('?') ? '&' : '?';
  const searchParams = new URLSearchParams({ returnTo: safeReturnTo });

  return `${path}${separator}${searchParams.toString()}`;
}

export function getCurrentPathWithSearch() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return `${window.location.pathname}${window.location.search}`;
}

function sanitizeQueryParam(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function buildQuickReturnPath(
  salesOrderId: string,
  options?: {
    customerId?: string;
    returnTo?: string;
  }
) {
  const params = new URLSearchParams({
    salesOrderId,
  });

  const customerId = sanitizeQueryParam(options?.customerId);
  if (customerId) {
    params.set('customerId', customerId);
  }

  return withReturnTo(`/return-orders/create?${params.toString()}`, options?.returnTo);
}

export function readQuickReturnPrefill(
  searchParams: Pick<URLSearchParams, 'get'> | null | undefined
) {
  return {
    salesOrderId: sanitizeQueryParam(searchParams?.get('salesOrderId')),
    customerId: sanitizeQueryParam(searchParams?.get('customerId')),
    returnTo: sanitizeReturnTo(searchParams?.get('returnTo')),
  };
}
