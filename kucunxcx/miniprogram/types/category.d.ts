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
  productCount?: number; // 产品数量
  _count?: {
    products?: number; // Prisma count 字段
  };
  children?: Category[]; // 子分类
  createdAt: string;
  updatedAt: string;
}
