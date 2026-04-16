'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';

const FORM_DRAFT_VERSION = 1;

interface StoredFormDraft<TFieldValues extends FieldValues> {
  version: number;
  savedAt: string;
  values: Partial<TFieldValues>;
}

interface UseLocalFormDraftOptions<TFieldValues extends FieldValues> {
  form: UseFormReturn<TFieldValues>;
  storageKey: string;
  enabled?: boolean;
  ready?: boolean;
  debounceMs?: number;
  onRestore?: (savedAt: string) => void;
}

function serializeValues<TFieldValues extends FieldValues>(
  values: Partial<TFieldValues>
) {
  try {
    return JSON.stringify(values);
  } catch {
    return null;
  }
}

export function useLocalFormDraft<TFieldValues extends FieldValues>({
  form,
  storageKey,
  enabled = true,
  ready = true,
  debounceMs = 600,
  onRestore,
}: UseLocalFormDraftOptions<TFieldValues>) {
  const [restoredAt, setRestoredAt] = useState<string | null>(null);
  const restoreAttemptedRef = useRef(false);
  const baselineSerializedRef = useRef<string | null>(null);
  const isRestoringRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const clearDraft = useCallback(() => {
    clearPendingSave();

    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.removeItem(storageKey);
    setRestoredAt(null);
  }, [clearPendingSave, storageKey]);

  useEffect(() => {
    restoreAttemptedRef.current = false;
    baselineSerializedRef.current = null;
    isRestoringRef.current = false;
    setRestoredAt(null);
    clearPendingSave();
  }, [clearPendingSave, storageKey]);

  useEffect(
    () => () => {
      clearPendingSave();
    },
    [clearPendingSave]
  );

  useEffect(() => {
    if (!enabled || !ready || baselineSerializedRef.current !== null) {
      return;
    }

    baselineSerializedRef.current = serializeValues(form.getValues());
  }, [enabled, form, ready]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !enabled ||
      !ready ||
      restoreAttemptedRef.current
    ) {
      return;
    }

    restoreAttemptedRef.current = true;

    const rawDraft = window.localStorage.getItem(storageKey);
    if (!rawDraft) {
      return;
    }

    try {
      const parsedDraft = JSON.parse(
        rawDraft
      ) as StoredFormDraft<TFieldValues> | null;

      if (
        !parsedDraft ||
        parsedDraft.version !== FORM_DRAFT_VERSION ||
        typeof parsedDraft.savedAt !== 'string' ||
        !parsedDraft.values ||
        typeof parsedDraft.values !== 'object'
      ) {
        clearDraft();
        return;
      }

      const mergedValues = {
        ...form.getValues(),
        ...parsedDraft.values,
      } as TFieldValues;
      const mergedSerialized = serializeValues(mergedValues);

      if (
        mergedSerialized &&
        baselineSerializedRef.current === mergedSerialized
      ) {
        clearDraft();
        return;
      }

      isRestoringRef.current = true;
      form.reset(mergedValues);
      setRestoredAt(parsedDraft.savedAt);
      onRestore?.(parsedDraft.savedAt);

      queueMicrotask(() => {
        isRestoringRef.current = false;
      });
    } catch {
      clearDraft();
    }
  }, [clearDraft, enabled, form, onRestore, ready, storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !enabled || !ready) {
      return;
    }

    const subscription = form.watch(() => {
      if (isRestoringRef.current) {
        return;
      }

      clearPendingSave();

      saveTimerRef.current = setTimeout(() => {
        const latestValues = form.getValues();
        const latestSerialized = serializeValues(latestValues);

        if (!latestSerialized) {
          return;
        }

        if (
          baselineSerializedRef.current !== null &&
          latestSerialized === baselineSerializedRef.current
        ) {
          window.localStorage.removeItem(storageKey);
          setRestoredAt(null);
          return;
        }

        const payload: StoredFormDraft<TFieldValues> = {
          version: FORM_DRAFT_VERSION,
          savedAt: new Date().toISOString(),
          values: latestValues,
        };

        try {
          window.localStorage.setItem(storageKey, JSON.stringify(payload));
        } catch {
          // localStorage 超限或不可用时，静默失败，不打断录单
        }
      }, debounceMs);
    });

    return () => {
      subscription.unsubscribe();
      clearPendingSave();
    };
  }, [clearPendingSave, debounceMs, enabled, form, ready, storageKey]);

  return {
    clearDraft,
    restoredAt,
    hasRestoredDraft: restoredAt !== null,
  };
}
