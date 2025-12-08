// 认证相关类型定义

/**
 * 登录请求参数
 */
export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * 登录响应
 */
export interface LoginResponse {
  success: boolean;
  token: string;
  user: UserInfo;
  expiresIn?: number;
}

/**
 * 注册请求参数
 */
export interface RegisterRequest {
  username: string;
  password: string;
  email?: string;
  phone?: string;
}

/**
 * 用户信息
 */
export interface UserInfo {
  id: string;
  username: string;
  email?: string;
  phone?: string;
  role: string;
  avatar?: string;
  createdAt: string;
}

/**
 * Token信息
 */
export interface TokenInfo {
  token: string;
  expiresAt: number;
}
