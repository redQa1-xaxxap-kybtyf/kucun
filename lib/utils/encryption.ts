import crypto from 'crypto';

import { env } from '@/lib/env';

// 使用 NEXTAUTH_SECRET 作为加密密钥
const ENCRYPTION_KEY = crypto
  .createHash('sha256')
  .update(env.NEXTAUTH_SECRET)
  .digest();

const _ALGORITHM = 'aes-256-gcm';

/**
 * 加密字符串
 */
export function encrypt(text: string): string {
  try {
    const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return encrypted;
  } catch (error) {
    console.error('加密失败:', error);
    throw new Error('数据加密失败');
  }
}

/**
 * 解密字符串
 */
export function decrypt(encryptedText: string): string {
  try {
    const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('解密失败:', error);
    throw new Error('数据解密失败');
  }
}

/**
 * 生成随机密钥
 */
export function generateRandomKey(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * 创建哈希
 */
export function createHash(data: string, algorithm: string = 'sha256'): string {
  return crypto.createHash(algorithm).update(data).digest('hex');
}

/**
 * 验证哈希
 */
export function verifyHash(
  data: string,
  hash: string,
  algorithm: string = 'sha256'
): boolean {
  const computedHash = createHash(data, algorithm);
  return computedHash === hash;
}

/**
 * 简单加密（用于不太敏感的数据）
 */
export function simpleEncrypt(text: string): string {
  try {
    const cipher = crypto.createCipher('aes192', env.NEXTAUTH_SECRET);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  } catch (error) {
    console.error('简单加密失败:', error);
    return text; // 如果加密失败，返回原文
  }
}

/**
 * 简单解密（用于不太敏感的数据）
 */
export function simpleDecrypt(encryptedText: string): string {
  try {
    const decipher = crypto.createDecipher('aes192', env.NEXTAUTH_SECRET);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('简单解密失败:', error);
    return encryptedText; // 如果解密失败，返回原文
  }
}
