interface RequestLike {
  headers: Headers;
  nextUrl?: URL;
  url?: string;
}

interface RequestOriginOptions {
  fallbackOrigin?: string | null;
  trustForwardedHeaders?: boolean;
  preferFallbackOrigin?: boolean;
}

interface ForwardedValues {
  host?: string;
  proto?: string;
}

function normalizeForwardedValue(value?: string) {
  if (!value) {
    return undefined;
  }

  return value.trim().replace(/^"|"$/g, '');
}

function parseForwardedHeader(headerValue?: string | null): ForwardedValues {
  if (!headerValue) {
    return {};
  }

  const firstEntry = headerValue.split(',')[0]?.trim();
  if (!firstEntry) {
    return {};
  }

  const values: ForwardedValues = {};

  firstEntry.split(';').forEach(part => {
    const [rawKey, rawValue] = part.split('=');
    const key = rawKey?.trim().toLowerCase();
    const value = normalizeForwardedValue(rawValue);

    if (!key || !value) {
      return;
    }

    if (key === 'host') {
      values.host = value;
    }

    if (key === 'proto') {
      values.proto = value.toLowerCase();
    }
  });

  return values;
}

function parseFallbackOrigin(fallbackOrigin?: string | null) {
  if (!fallbackOrigin) {
    return null;
  }

  try {
    return new URL(fallbackOrigin);
  } catch {
    return null;
  }
}

function getTrustedForwardedProtocol(request: RequestLike) {
  const forwardedProto = request.headers
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim()
    ?.toLowerCase();

  if (forwardedProto) {
    return forwardedProto;
  }

  const parsedForwarded = parseForwardedHeader(request.headers.get('forwarded'));
  return parsedForwarded.proto;
}

function getTrustedForwardedHost(request: RequestLike) {
  const forwardedHost = request.headers
    .get('x-forwarded-host')
    ?.split(',')[0]
    ?.trim();

  if (forwardedHost) {
    return forwardedHost;
  }

  const parsedForwarded = parseForwardedHeader(request.headers.get('forwarded'));
  return parsedForwarded.host;
}

export function getRequestProtocol(
  request: RequestLike,
  options: RequestOriginOptions = {}
): string {
  const fallbackUrl = parseFallbackOrigin(options.fallbackOrigin);

  if (options.preferFallbackOrigin && fallbackUrl) {
    return fallbackUrl.protocol.replace(':', '').toLowerCase();
  }

  if (options.trustForwardedHeaders) {
    const forwardedProto = getTrustedForwardedProtocol(request);
    if (forwardedProto) {
      return forwardedProto;
    }
  }

  if (request.nextUrl) {
    return request.nextUrl.protocol.replace(':', '').toLowerCase();
  }

  if (request.url) {
    return new URL(request.url).protocol.replace(':', '').toLowerCase();
  }

  if (fallbackUrl) {
    return fallbackUrl.protocol.replace(':', '').toLowerCase();
  }

  return 'http';
}

export function getRequestHost(
  request: RequestLike,
  options: RequestOriginOptions = {}
): string | undefined {
  const fallbackUrl = parseFallbackOrigin(options.fallbackOrigin);

  if (options.preferFallbackOrigin && fallbackUrl) {
    return fallbackUrl.host;
  }

  if (options.trustForwardedHeaders) {
    const forwardedHost = getTrustedForwardedHost(request);
    if (forwardedHost) {
      return forwardedHost;
    }
  }

  const host = request.headers.get('host')?.split(',')[0]?.trim();
  if (host) {
    return host;
  }

  if (request.nextUrl?.host) {
    return request.nextUrl.host;
  }

  return fallbackUrl?.host;
}

export function getRequestOrigin(
  request: RequestLike,
  options: RequestOriginOptions = {}
): string {
  const fallbackUrl = parseFallbackOrigin(options.fallbackOrigin);

  if (options.preferFallbackOrigin && fallbackUrl) {
    return fallbackUrl.origin;
  }

  const protocol = getRequestProtocol(request, options);
  const host = getRequestHost(request, options);

  if (host) {
    return `${protocol}://${host}`;
  }

  if (fallbackUrl) {
    return fallbackUrl.origin;
  }

  if (request.nextUrl) {
    return request.nextUrl.origin;
  }

  if (request.url) {
    return new URL(request.url).origin;
  }

  return 'http://localhost';
}
