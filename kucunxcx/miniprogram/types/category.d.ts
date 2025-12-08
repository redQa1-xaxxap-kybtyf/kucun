// 分类相关类型定义

import type { Status } from './common';

/**
 * 分类信息
 */
export interface Category {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: Status;
  sortOrder: number;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}
