'use client';

import * as React from 'react';

interface UseListSearchControllerOptions {
  committedValue?: string;
  onCommit: (value: string | undefined) => void;
  debounceMs?: number;
  normalize?: (value: string) => string | undefined;
}

function defaultNormalize(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function useListSearchController({
  committedValue,
  onCommit,
  debounceMs = 300,
  normalize = defaultNormalize,
}: UseListSearchControllerOptions) {
  const [searchInput, setSearchInput] = React.useState(committedValue ?? '');
  const [isDebouncing, setIsDebouncing] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingCommit = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancelPendingCommit = React.useCallback(() => {
    clearPendingCommit();
    setIsDebouncing(false);
  }, [clearPendingCommit]);

  React.useEffect(() => {
    setSearchInput(committedValue ?? '');
  }, [committedValue]);

  const commitValue = React.useCallback(
    (rawValue: string) => {
      const normalizedNext = normalize(rawValue);
      const normalizedCommitted = normalize(committedValue ?? '');

      if (normalizedNext === normalizedCommitted) {
        setSearchInput(normalizedNext ?? '');
        setIsDebouncing(false);
        return;
      }

      startTransition(() => {
        onCommit(normalizedNext);
      });
    },
    [committedValue, normalize, onCommit]
  );

  const handleSearchChange = React.useCallback(
    (nextValue: string) => {
      setSearchInput(nextValue);
      cancelPendingCommit();

      if (!normalize(nextValue)) {
        commitValue(nextValue);
        return;
      }

      setIsDebouncing(true);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setIsDebouncing(false);
        commitValue(nextValue);
      }, debounceMs);
    },
    [cancelPendingCommit, commitValue, debounceMs, normalize]
  );

  React.useEffect(
    () => () => {
      clearPendingCommit();
    },
    [clearPendingCommit]
  );

  return {
    searchInput,
    isSearching: isDebouncing || isPending,
    handleSearchChange,
    cancelPendingCommit,
    clearSearch: React.useCallback(() => handleSearchChange(''), [
      handleSearchChange,
    ]),
    setSearchInput,
  };
}
