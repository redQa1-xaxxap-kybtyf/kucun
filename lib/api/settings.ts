/**
 * 系统设置API客户端
 * 使用TanStack Query进行状态管理
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  DataManagementSettings,
  SettingsResponse,
  SettingsUpdateRequest,
  SystemSettings,
} from '@/lib/types/settings';

// API基础URL
const API_BASE = '/api/settings';

// Query Keys工厂
export const settingsQueryKeys = {
  all: ['settings'] as const,
  lists: () => [...settingsQueryKeys.all, 'list'] as const,
  list: (filters: string) =>
    [...settingsQueryKeys.lists(), { filters }] as const,
  details: () => [...settingsQueryKeys.all, 'detail'] as const,
  detail: (category: string) =>
    [...settingsQueryKeys.details(), category] as const,
  overview: () => [...settingsQueryKeys.all, 'overview'] as const,
};

// API函数

/**
 * 获取完整系统设置
 */
export async function getSystemSettings(): Promise<SettingsResponse> {
  const response = await fetch(`${API_BASE}`);

  if (!response.ok) {
    throw new Error(`获取系统设置失败: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 获取特定分类的设置
 */
export async function getCategorySettings(
  category:
    | 'basic'
    | 'userManagement'
    | 'business'
    | 'interface'
    | 'notifications'
    | 'dataManagement'
): Promise<SettingsResponse> {
  const response = await fetch(`${API_BASE}/${category}`);

  if (!response.ok) {
    throw new Error(`获取${category}设置失败: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 更新系统设置
 */
export async function updateSettings(
  updateRequest: SettingsUpdateRequest
): Promise<SettingsResponse> {
  const response = await fetch(`${API_BASE}/${updateRequest.category}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updateRequest.data),
  });

  if (!response.ok) {
    throw new Error(`更新设置失败: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 重置设置为默认值
 */
export async function resetSettings(
  category:
    | 'basic'
    | 'userManagement'
    | 'business'
    | 'interface'
    | 'notifications'
    | 'dataManagement'
): Promise<SettingsResponse> {
  const response = await fetch(`${API_BASE}/${category}/reset`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`重置设置失败: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 导出设置配置
 */
export async function exportSettings(): Promise<Blob> {
  const response = await fetch(`${API_BASE}/export`);

  if (!response.ok) {
    throw new Error(`导出设置失败: ${response.statusText}`);
  }

  return response.blob();
}

/**
 * 导入设置配置
 */
export async function importSettings(file: File): Promise<SettingsResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/import`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`导入设置失败: ${response.statusText}`);
  }

  return response.json();
}

// React Query Hooks

/**
 * 获取完整系统设置Hook
 */
export function useSystemSettings() {
  return useQuery({
    queryKey: settingsQueryKeys.overview(),
    queryFn: getSystemSettings,
    staleTime: 5 * 60 * 1000, // 5分钟
    gcTime: 10 * 60 * 1000, // 10分钟
  });
}

/**
 * 获取特定分类设置Hook
 */
export function useCategorySettings(
  category:
    | 'basic'
    | 'userManagement'
    | 'business'
    | 'interface'
    | 'notifications'
    | 'dataManagement'
) {
  return useQuery({
    queryKey: settingsQueryKeys.detail(category),
    queryFn: () => getCategorySettings(category),
    staleTime: 5 * 60 * 1000, // 5分钟
    gcTime: 10 * 60 * 1000, // 10分钟
  });
}

/**
 * 更新设置Hook
 */
export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSettings,
    onSuccess: (data, variables) => {
      // 更新相关查询缓存
      queryClient.invalidateQueries({
        queryKey: settingsQueryKeys.detail(variables.category),
      });
      queryClient.invalidateQueries({
        queryKey: settingsQueryKeys.overview(),
      });
    },
    onError: () => {
      // 错误处理由调用方负责
    },
  });
}

/**
 * 重置设置Hook
 */
export function useResetSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: resetSettings,
    onSuccess: (data, category) => {
      // 更新相关查询缓存
      queryClient.invalidateQueries({
        queryKey: settingsQueryKeys.detail(category),
      });
      queryClient.invalidateQueries({
        queryKey: settingsQueryKeys.overview(),
      });
    },
    onError: () => {
      // 错误处理由调用方负责
    },
  });
}

/**
 * 导出设置Hook
 */
export function useExportSettings() {
  return useMutation({
    mutationFn: exportSettings,
    onSuccess: blob => {
      // 创建下载链接
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `settings-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
    onError: () => {
      // 错误处理由调用方负责
    },
  });
}

/**
 * 导入设置Hook
 */
export function useImportSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: importSettings,
    onSuccess: () => {
      // 刷新所有设置查询
      queryClient.invalidateQueries({
        queryKey: settingsQueryKeys.all,
      });
    },
    onError: () => {
      // 错误处理由调用方负责
    },
  });
}

// 工具函数

/**
 * 获取设置值的类型安全访问器
 */
export function getSettingValue<T extends keyof SystemSettings>(
  settings: SystemSettings | undefined,
  category: T,
  key: keyof SystemSettings[T]
): SystemSettings[T][keyof SystemSettings[T]] | undefined {
  return settings?.[category]?.[key];
}

/**
 * 检查设置是否已初始化
 */
export function isSettingsInitialized(
  settings: SystemSettings | undefined
): boolean {
  return Boolean(
    settings?.basic?.companyName &&
      settings?.basic?.systemName &&
      settings?.userManagement &&
      settings?.business
  );
}

/**
 * 获取设置更新时间格式化字符串
 */
export function getSettingsLastUpdated(
  settings: SystemSettings | undefined
): string {
  if (!settings?.updatedAt) {
    return '未知';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(settings.updatedAt));
}

// 通知设置相关API函数

/**
 * 获取通知设置
 */
export async function getNotificationSettings(): Promise<SettingsResponse> {
  const response = await fetch(`${API_BASE}/notifications`);

  if (!response.ok) {
    throw new Error(`获取通知设置失败: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 更新通知设置
 */
export async function updateNotificationSettings(
  data: SettingsUpdateRequest['data']
): Promise<SettingsResponse> {
  const response = await fetch(`${API_BASE}/notifications`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`更新通知设置失败: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 通知设置查询Hook
 */
export function useNotificationSettings() {
  return useQuery({
    queryKey: settingsQueryKeys.detail('notifications'),
    queryFn: getNotificationSettings,
    staleTime: 5 * 60 * 1000, // 5分钟
    gcTime: 10 * 60 * 1000, // 10分钟
  });
}

/**
 * 通知设置更新Hook
 */
export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateNotificationSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: settingsQueryKeys.detail('notifications'),
      });
      queryClient.invalidateQueries({
        queryKey: settingsQueryKeys.overview(),
      });
    },
    onError: () => {
      // 错误处理由调用方负责
    },
  });
}

// ==================== 数据管理设置 API ====================

/**
 * 获取数据管理设置
 */
export async function getDataManagementSettings(): Promise<DataManagementSettings> {
  const response = await fetch(`${API_BASE}/data-management`);

  if (!response.ok) {
    throw new Error(`获取数据管理设置失败: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * 更新数据管理设置
 */
export async function updateDataManagementSettings(
  data: Partial<DataManagementSettings>
): Promise<SettingsResponse> {
  const response = await fetch(`${API_BASE}/data-management`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`更新数据管理设置失败: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 数据管理设置查询Hook
 */
export function useDataManagementSettings() {
  return useQuery({
    queryKey: settingsQueryKeys.detail('dataManagement'),
    queryFn: getDataManagementSettings,
    staleTime: 5 * 60 * 1000, // 5分钟
    gcTime: 10 * 60 * 1000, // 10分钟
  });
}

/**
 * 数据管理设置更新Hook
 */
export function useUpdateDataManagementSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateDataManagementSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: settingsQueryKeys.detail('dataManagement'),
      });
      queryClient.invalidateQueries({
        queryKey: settingsQueryKeys.overview(),
      });
    },
    onError: () => {
      // 错误处理由调用方负责
    },
  });
}

// ==================== 数据管理操作 API ====================

/**
 * 执行手动备份
 */
export async function executeBackup(): Promise<BackupOperation> {
  const response = await fetch(`${API_BASE}/data-management/backup`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`执行备份失败: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * 获取备份历史
 */
export async function getBackupHistory(): Promise<BackupOperation[]> {
  const response = await fetch(`${API_BASE}/data-management/backup/history`);

  if (!response.ok) {
    throw new Error(`获取备份历史失败: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * 执行数据导出
 */
export async function executeExport(options: {
  format: 'excel' | 'csv' | 'json';
  tables: string[];
  dateFrom?: Date;
  dateTo?: Date;
  includeDeleted: boolean;
}): Promise<ExportOperation> {
  const response = await fetch(`${API_BASE}/data-management/export`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    throw new Error(`执行导出失败: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * 获取导出历史
 */
export async function getExportHistory(): Promise<ExportOperation[]> {
  const response = await fetch(`${API_BASE}/data-management/export/history`);

  if (!response.ok) {
    throw new Error(`获取导出历史失败: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * 执行系统维护操作
 */
export async function executeMaintenance(
  type: 'cache_cleanup' | 'log_cleanup' | 'temp_cleanup' | 'db_optimization'
): Promise<MaintenanceOperation> {
  const response = await fetch(`${API_BASE}/data-management/maintenance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type }),
  });

  if (!response.ok) {
    throw new Error(`执行维护操作失败: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * 获取维护历史
 */
export async function getMaintenanceHistory(): Promise<MaintenanceOperation[]> {
  const response = await fetch(
    `${API_BASE}/data-management/maintenance/history`
  );

  if (!response.ok) {
    throw new Error(`获取维护历史失败: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * 获取系统性能数据
 */
export async function getSystemPerformance(): Promise<SystemPerformance[]> {
  const response = await fetch(`${API_BASE}/data-management/performance`);

  if (!response.ok) {
    throw new Error(`获取系统性能数据失败: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data;
}
