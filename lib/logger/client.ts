/**
 * Client-side logging utilities.
 * Provides a thin wrapper around the server logging API so that
 * browser components avoid importing server-only dependencies.
 */

interface ClientErrorPayload {
  module: string;
  message: string;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
    digest?: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Report an error from the browser to the server logging endpoint.
 * Falls back to console logging when the request fails.
 */
export async function logClientError(
  module: string,
  message: string,
  error: unknown,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  // eslint-disable-next-line no-console
  console.error(`[${module}] ${message}`, error);

  const payload: ClientErrorPayload = {
    module,
    message,
    error: normalizeError(error),
    metadata: {
      url: window.location.href,
      ...metadata,
    },
  };

  try {
    await fetch('/api/logs/report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch (requestError) {
    // eslint-disable-next-line no-console
    console.error('Failed to report client error', requestError, payload);
  }
}

function normalizeError(error: unknown) {
  if (!error) {
    return undefined;
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      digest: (error as Error & { digest?: string }).digest,
    };
  }

  if (typeof error === 'object') {
    try {
      return JSON.parse(JSON.stringify(error));
    } catch {
      return { message: String(error) };
    }
  }

  return { message: String(error) };
}
