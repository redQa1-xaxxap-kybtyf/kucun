/**
 * 表单提交统一 Hook
 * 
 * 提供统一的表单提交逻辑，包括：
 * - 加载状态管理
 * - 错误处理
 * - 成功/失败反馈
 * - 自动显示 Toast
 * 
 * @see docs/FORM_HANDLING_GUIDE.md
 */

'use client';

import { useState } from 'react';

import { handleApiError, handleValidationError } from '@/lib/utils/error-handler';
import { showSuccess, showError } from '@/lib/utils/toast-helper';

/**
 * 表单提交选项
 */
export interface UseFormSubmitOptions<TData, TResult = unknown> {
  /**
   * 提交函数
   */
  onSubmit: (data: TData) => Promise<TResult>;
  
  /**
   * 成功回调
   */
  onSuccess?: (result: TResult) => void | Promise<void>;
  
  /**
   * 错误回调
   */
  onError?: (error: Error) => void;
  
  /**
   * 成功提示消息
   */
  successMessage?: string;
  
  /**
   * 错误提示消息
   */
  errorMessage?: string;
  
  /**
   * 是否显示成功 Toast
   * @default true
   */
  showSuccessToast?: boolean;
  
  /**
   * 是否显示错误 Toast
   * @default true
   */
  showErrorToast?: boolean;
  
  /**
   * 是否为验证错误
   * @default false
   */
  isValidation?: boolean;
}

/**
 * 表单提交返回值
 */
export interface UseFormSubmitReturn<TData> {
  /**
   * 提交处理函数
   */
  handleSubmit: (data: TData) => Promise<void>;
  
  /**
   * 是否正在提交
   */
  isSubmitting: boolean;
  
  /**
   * 错误信息
   */
  error: string | null;
  
  /**
   * 清除错误
   */
  clearError: () => void;
  
  /**
   * 设置错误
   */
  setError: (error: string) => void;
}

/**
 * 表单提交 Hook
 * 
 * @example
 * ```typescript
 * const { handleSubmit, isSubmitting, error } = useFormSubmit({
 *   onSubmit: async (data) => {
 *     return await createProduct(data);
 *   },
 *   onSuccess: (product) => {
 *     router.push(`/products/${product.id}`);
 *   },
 *   successMessage: '产品创建成功',
 *   errorMessage: '产品创建失败',
 * });
 * 
 * // 在表单中使用
 * <form onSubmit={form.handleSubmit(handleSubmit)}>
 *   {error && <ErrorMessage message={error} />}
 *   <Button type="submit" disabled={isSubmitting}>
 *     {isSubmitting ? '提交中...' : '提交'}
 *   </Button>
 * </form>
 * ```
 */
export function useFormSubmit<TData, TResult = unknown>({
  onSubmit,
  onSuccess,
  onError,
  successMessage = '操作成功',
  errorMessage = '操作失败',
  showSuccessToast = true,
  showErrorToast = true,
  isValidation = false,
}: UseFormSubmitOptions<TData, TResult>): UseFormSubmitReturn<TData> {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);

  const handleSubmit = async (data: TData) => {
    setIsSubmitting(true);
    setErrorState(null);

    try {
      const result = await onSubmit(data);
      
      // 显示成功 Toast
      if (showSuccessToast) {
        showSuccess(successMessage);
      }
      
      // 调用成功回调
      if (onSuccess) {
        await onSuccess(result);
      }
    } catch (err) {
      // 处理错误
      const appError = isValidation 
        ? handleValidationError(err)
        : handleApiError(err);
      
      // 设置错误状态
      setErrorState(appError.message);
      
      // 显示错误 Toast
      if (showErrorToast) {
        showError(errorMessage, {
          description: appError.message,
        });
      }
      
      // 调用错误回调
      if (onError) {
        onError(appError);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearError = () => {
    setErrorState(null);
  };

  const setError = (errorMessage: string) => {
    setErrorState(errorMessage);
  };

  return {
    handleSubmit,
    isSubmitting,
    error,
    clearError,
    setError,
  };
}

/**
 * 简化版表单提交 Hook
 * 
 * 不显示 Toast，只返回错误状态
 * 
 * @example
 * ```typescript
 * const { handleSubmit, isSubmitting, error } = useFormSubmitSimple({
 *   onSubmit: async (data) => {
 *     return await updateProfile(data);
 *   },
 * });
 * ```
 */
export function useFormSubmitSimple<TData, TResult = unknown>(
  options: Omit<UseFormSubmitOptions<TData, TResult>, 'showSuccessToast' | 'showErrorToast'>
): UseFormSubmitReturn<TData> {
  return useFormSubmit({
    ...options,
    showSuccessToast: false,
    showErrorToast: false,
  });
}

/**
 * 验证表单提交 Hook
 * 
 * 专门用于表单验证错误处理
 * 
 * @example
 * ```typescript
 * const { handleSubmit, isSubmitting, error } = useFormSubmitValidation({
 *   onSubmit: async (data) => {
 *     return await validateAndSubmit(data);
 *   },
 *   onSuccess: () => {
 *     router.push('/success');
 *   },
 * });
 * ```
 */
export function useFormSubmitValidation<TData, TResult = unknown>(
  options: Omit<UseFormSubmitOptions<TData, TResult>, 'isValidation'>
): UseFormSubmitReturn<TData> {
  return useFormSubmit({
    ...options,
    isValidation: true,
  });
}

/**
 * 带确认的表单提交 Hook
 * 
 * 提交前需要用户确认
 * 
 * @example
 * ```typescript
 * const { handleSubmit, isSubmitting } = useFormSubmitWithConfirm({
 *   onSubmit: async (data) => {
 *     return await deleteProduct(data.id);
 *   },
 *   confirmMessage: '确定要删除这个产品吗？',
 *   successMessage: '产品已删除',
 * });
 * ```
 */
export function useFormSubmitWithConfirm<TData, TResult = unknown>(
  options: UseFormSubmitOptions<TData, TResult> & {
    confirmMessage?: string;
  }
): UseFormSubmitReturn<TData> {
  const { confirmMessage = '确定要执行此操作吗？', ...restOptions } = options;
  
  const formSubmit = useFormSubmit(restOptions);
  
  const handleSubmitWithConfirm = async (data: TData) => {
    if (window.confirm(confirmMessage)) {
      await formSubmit.handleSubmit(data);
    }
  };
  
  return {
    ...formSubmit,
    handleSubmit: handleSubmitWithConfirm,
  };
}

