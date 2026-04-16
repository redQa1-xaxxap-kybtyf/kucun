'use client';

import { useEffect } from 'react';

const CHUNK_RELOAD_GUARD_KEY = '__chunk_reload_once__';
const CHUNK_RELOAD_GUARD_TTL_MS = 10_000;

export function isChunkLoadFailureMessage(error: unknown): boolean {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : (error as { message?: string })?.message;

  if (!message) {
    return false;
  }

  return [
    'ChunkLoadError',
    'Loading chunk',
    'failed to fetch dynamically imported module',
  ].some(keyword => message.toLowerCase().includes(keyword.toLowerCase()));
}

/**
 * 监听 ChunkLoadError 并强制刷新页面，避免页面卡在空白状态。
 * 只在客户端安装一次即可。
 */
export default function ChunkLoadRecovery(): null {
  useEffect(() => {
    const clearGuardTimer = window.setTimeout(() => {
      sessionStorage.removeItem(CHUNK_RELOAD_GUARD_KEY);
    }, CHUNK_RELOAD_GUARD_TTL_MS);

    const handleError = (error: unknown) => {
      if (!isChunkLoadFailureMessage(error)) {
        return;
      }

      const currentPath = `${window.location.pathname}${window.location.search}`;
      if (sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY) === currentPath) {
        return;
      }

      sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, currentPath);
      const url = new URL(window.location.href);
      url.searchParams.set('_', Date.now().toString());
      window.location.replace(url.toString());
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
      window.clearTimeout(clearGuardTimer);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onErrorEvent);
    };
  }, []);

  return null;
}
