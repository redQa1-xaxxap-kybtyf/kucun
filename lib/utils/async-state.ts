/**
 * 统一异步状态工具
 *
 * 为组件和 Hook 提供统一的加载状态定义，避免出现
 * `loading`、`isLoading`、`pending` 等不一致命名。
 */

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState {
  status: AsyncStatus;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
}

interface AsyncSnapshot {
  isLoading?: boolean;
  isError?: boolean;
  isSuccess?: boolean;
}

/**
 * 根据单个快照解析异步状态
 */
export function resolveAsyncState({
  isLoading = false,
  isError = false,
  isSuccess = false,
}: AsyncSnapshot): AsyncState {
  const status: AsyncStatus = isLoading
    ? 'loading'
    : isError
      ? 'error'
      : isSuccess
        ? 'success'
        : 'idle';

  return {
    status,
    isLoading,
    isError,
    isSuccess,
  };
}

/**
 * 合并多个异步状态，常用于多个 mutation 或 query 同时影响 UI
 */
export function combineAsyncStates(states: AsyncSnapshot[]): AsyncState {
  const isLoading = states.some(state => state.isLoading);
  const isError = !isLoading && states.some(state => state.isError);
  const isSuccess =
    !isLoading && !isError && states.some(state => state.isSuccess);

  return resolveAsyncState({
    isLoading,
    isError,
    isSuccess,
  });
}
