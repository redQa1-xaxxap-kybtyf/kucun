'use client';

import { useEffect } from 'react';

/**
 * 监听 ChunkLoadError 并强制刷新页面，避免页面卡在空白状态。
 * 只在客户端安装一次即可。
 */
export default function ChunkLoadRecovery(): null {
  useEffect(() => {
    const handleError = (error: unknown) => {
      const message =
        typeof error === 'string'
          ? error
          : error instanceof Error
            ? error.message
            : (error as { message?: string })?.message;

      if (message && message.includes('ChunkLoadError')) {
        const url = new URL(window.location.href);
        url.searchParams.set('_', Date.now().toString());
        window.location.replace(url.toString());
      }
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      handleError(event.reason);
    };

    const onErrorEvent = (event: ErrorEvent) => {
      handleError(event.error ?? event.message);
    };

    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onErrorEvent);

    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onErrorEvent);
    };
  }, []);

  return null;
}
