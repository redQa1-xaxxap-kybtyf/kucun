'use client';

import { useCallback, type ReactNode } from 'react';
import type { FieldErrors, Path, UseFormReturn } from 'react-hook-form';
import { ZodError } from 'zod';

import type { ToastProps } from '@/components/ui/toast';
import { logger } from '@/lib/utils/console-logger';

type BlurHandler = (...args: unknown[]) => unknown;

export type BlurHandlerFactory<FormValues> = (
  name?: Path<FormValues>,
  handler?: BlurHandler
) => (...args: unknown[]) => void;

export interface ValidationIssue {
  path?: string | null;
  message: string;
}

interface UseFormErrorHandlingOptions<FormValues> {
  form: UseFormReturn<FormValues>;
  toast?: (props: ToastProps) => void;
  scrollBehavior?: ScrollBehavior;
  defaultToastTitle?: ReactNode;
  defaultToastDescription?: ReactNode;
}

interface ToastOptionOverrides {
  title?: ReactNode;
  description?: ReactNode;
  variant?: ToastProps['variant'];
}

interface FirstErrorResult {
  path?: string;
  message?: string;
}

const normalizePath = (path?: string | null): string | undefined => {
  if (!path || path === 'root') {
    return undefined;
  }
  return path.replace(/\[(\d+)\]/g, '.$1').replace(/^\./, '');
};

function isPromise(value: unknown): value is Promise<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Promise<unknown>).then === 'function'
  );
}

function handleBlurError(error: unknown) {
  if (error instanceof ZodError) {
    return;
  }
  logger.error('useFormErrorHandling', 'notifyBlur failed', error);
}

export function useFormErrorHandling<FormValues>(
  options: UseFormErrorHandlingOptions<FormValues>
) {
  const {
    form,
    toast,
    scrollBehavior = 'smooth',
    defaultToastTitle = '表单存在未填写的必填项',
    defaultToastDescription = '请检查标红字段后再次提交。',
  } = options;

  const scrollToError = useCallback(
    (rawPath?: string | null) => {
      const path = normalizePath(rawPath);
      if (!path || typeof document === 'undefined') {
        return;
      }
      requestAnimationFrame(() => {
        const selector = `[name="${path}"]`;
        const element = document.querySelector(selector) as HTMLElement | null;
        element?.scrollIntoView({ behavior: scrollBehavior, block: 'center' });
      });
    },
    [scrollBehavior]
  );

  const focusField = useCallback(
    (rawPath?: string | null) => {
      const path = normalizePath(rawPath);
      if (!path) {
        return;
      }
      try {
        form.setFocus(path as Path<FormValues>);
      } catch {
        // 某些虚拟字段无法被聚焦，忽略错误
      }
      scrollToError(path);
    },
    [form, scrollToError]
  );

  const getFirstError = useCallback(
    (errors?: FieldErrors<FormValues>): FirstErrorResult => {
      if (!errors) {
        return {};
      }

      const visit = (
        node: unknown,
        segments: Array<string | number>
      ): FirstErrorResult => {
        if (!node) {
          return {};
        }

        if (Array.isArray(node)) {
          for (let index = 0; index < node.length; index += 1) {
            const child = node[index];
            const result = visit(child, [...segments, index]);
            if (result.path || result.message) {
              return result;
            }
          }
          return {};
        }

        if (typeof node === 'object') {
          const message = (node as { message?: string }).message;
          if (message) {
            return {
              path: segments.join('.'),
              message,
            };
          }

          for (const [key, value] of Object.entries(
            node as Record<string, unknown>
          )) {
            const result = visit(value, [...segments, key]);
            if (result.path || result.message) {
              return result;
            }
          }
        }

        return {};
      };

      return visit(errors, []);
    },
    []
  );

  const notifyBlur = useCallback<BlurHandlerFactory<FormValues>>(
    (name?: Path<FormValues>, handler?: BlurHandler) =>
      (...args: unknown[]) => {
        if (handler) {
          try {
            const result = handler(...args);
            if (isPromise(result)) {
              result.catch(handleBlurError);
            }
          } catch (error) {
            handleBlurError(error);
          }
        }

        if (name) {
          const triggerResult = form.trigger(name);
          if (
            triggerResult &&
            typeof (triggerResult as Promise<boolean>).catch === 'function'
          ) {
            (triggerResult as Promise<boolean>).catch(handleBlurError);
          }
        }
      },
    [form]
  );

  const showValidationToast = useCallback(
    (errors?: FieldErrors<FormValues>, overrides?: ToastOptionOverrides) => {
      if (!toast || !errors) {
        return;
      }

      const { path, message } = getFirstError(errors);
      if (path) {
        focusField(path);
      }

      toast({
        title: overrides?.title ?? defaultToastTitle,
        description:
          overrides?.description ?? message ?? defaultToastDescription,
        variant: overrides?.variant ?? 'destructive',
      });
    },
    [
      defaultToastDescription,
      defaultToastTitle,
      focusField,
      getFirstError,
      toast,
    ]
  );

  const applyServerValidationErrors = useCallback(
    (issues?: ValidationIssue[] | null): string | undefined => {
      if (!issues?.length) {
        return undefined;
      }

      let firstMessage: string | undefined;
      let firstPath: string | undefined;

      issues.forEach(issue => {
        const normalized = normalizePath(issue.path);
        if (normalized) {
          form.setError(normalized as Path<FormValues>, {
            type: 'server',
            message: issue.message,
          });
          if (!firstPath) {
            firstPath = normalized;
            firstMessage = issue.message;
          }
        } else if (!firstMessage) {
          firstMessage = issue.message;
        }
      });

      if (firstPath) {
        focusField(firstPath);
      }

      return firstMessage;
    },
    [focusField, form]
  );

  return {
    notifyBlur,
    focusField,
    scrollToError,
    showValidationToast,
    applyServerValidationErrors,
    getFirstError,
    normalizeFieldPath: normalizePath,
  } as const;
}
