'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';

const DEFAULT_MESSAGE = '当前填写内容尚未保存，确定要离开吗？';

interface UseUnsavedChangesGuardOptions {
  enabled: boolean;
  message?: string;
}

interface NavigateWithinAppOptions {
  replace?: boolean;
}

function getCurrentHref(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function useUnsavedChangesGuard({
  enabled,
  message = DEFAULT_MESSAGE,
}: UseUnsavedChangesGuardOptions) {
  const router = useRouter();
  const currentFormHrefRef = useRef('');

  useEffect(() => {
    currentFormHrefRef.current = getCurrentHref();
  }, []);

  const confirmLeavePage = useCallback(() => {
    if (!enabled || typeof window === 'undefined') {
      return true;
    }

    return window.confirm(message);
  }, [enabled, message]);

  const navigateWithinApp = useCallback(
    (href: string, options?: NavigateWithinAppOptions) => {
      if (options?.replace) {
        router.replace(href);
        return;
      }

      router.push(href);
    },
    [router]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled]);

  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) {
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (
        anchor.target === '_blank' ||
        anchor.hasAttribute('download') ||
        anchor.getAttribute('rel') === 'external'
      ) {
        return;
      }

      const rawHref = anchor.getAttribute('href');
      if (
        !rawHref ||
        rawHref.startsWith('#') ||
        rawHref.startsWith('javascript:')
      ) {
        return;
      }

      const nextUrl = new URL(anchor.href, window.location.href);
      const currentUrl = new URL(window.location.href);

      if (nextUrl.href === currentUrl.href) {
        return;
      }

      if (nextUrl.origin !== currentUrl.origin) {
        if (!confirmLeavePage()) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (!confirmLeavePage()) {
        return;
      }

      navigateWithinApp(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`, {
        replace: true,
      });
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => {
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [confirmLeavePage, enabled, navigateWithinApp]);

  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) {
      return;
    }

    const handlePopState = () => {
      if (confirmLeavePage()) {
        return;
      }

      navigateWithinApp(currentFormHrefRef.current || getCurrentHref());
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [confirmLeavePage, enabled, navigateWithinApp]);

  return {
    confirmLeavePage,
    navigateWithinApp,
  };
}
