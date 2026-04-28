import { act, renderHook } from '@testing-library/react';

import { useMediaQuery } from '@/hooks/use-media-query';

type MatchMediaListener = () => void;

describe('useMediaQuery', () => {
  beforeEach(() => {
    const listeners = new Map<string, Set<MatchMediaListener>>();
    const matchState = new Map<string, boolean>();

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: matchState.get(query) ?? false,
        media: query,
        onchange: null,
        addEventListener: (_event: string, listener: MatchMediaListener) => {
          const current = listeners.get(query) ?? new Set<MatchMediaListener>();
          current.add(listener);
          listeners.set(query, current);
        },
        removeEventListener: (_event: string, listener: MatchMediaListener) => {
          listeners.get(query)?.delete(listener);
        },
        dispatchChange(nextMatches: boolean) {
          matchState.set(query, nextMatches);
          listeners.get(query)?.forEach(listener => listener());
        },
      })),
    });
  });

  test('挂载时应直接读取当前媒体查询结果，避免先回落到 false', () => {
    const query = '(max-width: 767px)';
    const mediaQuery = window.matchMedia(query) as MediaQueryList & {
      dispatchChange: (nextMatches: boolean) => void;
    };

    mediaQuery.dispatchChange(true);

    const { result } = renderHook(() => useMediaQuery(query));

    expect(result.current).toBe(true);
  });

  test('媒体查询变化时应同步更新结果', () => {
    const query = '(min-width: 1024px)';
    const mediaQuery = window.matchMedia(query) as MediaQueryList & {
      dispatchChange: (nextMatches: boolean) => void;
    };

    const { result } = renderHook(() => useMediaQuery(query));

    expect(result.current).toBe(false);

    act(() => {
      mediaQuery.dispatchChange(true);
    });

    expect(result.current).toBe(true);
  });
});
