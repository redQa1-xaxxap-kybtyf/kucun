import crypto from 'crypto';

import { env, storageConfig } from '@/lib/env';

// 使用 STORAGE_ENCRYPTION_KEY 作为加密密钥（确保32字节）
// 与 API 路由保持一致
const ENCRYPTION_KEY = Buffer.from(storageConfig.encryptionKey.slice(0, 32));

const ALGORITHM = 'aes-256-cbc';

/**
 * 加密字符串（使用 IV 的安全方式）
 */
export function encrypt(text: string): string {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // 返回格式: iv:encrypted
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('加密失败:', error);
    throw new Error('数据加密失败');
  }
}

/**
 * 解密字符串（使用 STORAGE_ENCRYPTION_KEY）
 */
export function decrypt(encryptedText: string): string {
  try {
    // 检查是否是新格式（包含 IV，格式为 hex:hex）
    if (encryptedText.includes(':')) {
      const parts = encryptedText.split(':');
      // 验证是否是有效的 hex 格式
      if (
        parts.length === 2 &&
        /^[0-9a-f]+$/i.test(parts[0]) &&
        /^[0-9a-f]+$/i.test(parts[1])
      ) {
        try {
          const iv = Buffer.from(parts[0], 'hex');
          const encrypted = parts[1];
          const decipher = crypto.createDecipheriv(
            ALGORITHM,
            ENCRYPTION_KEY,
            iv
          );

          let decrypted = decipher.update(encrypted, 'hex', 'utf8');
          decrypted += decipher.final('utf8');

          console.log('使用新格式解密成功');
          return decrypted;
        } catch (error) {
          console.warn('新格式解密失败:', error);
          // 新格式解密失败,可能是明文,直接返回
          return encryptedText;
        }
      }
    }

    // 如果不是新格式,可能是明文,直接返回
    console.warn('未检测到加密格式,返回原文(可能是明文)');
    return encryptedText;
  } catch (error) {
    console.error('解密失败:', error);
    // 解密失败时返回原文（可能是未加密的数据）
    return encryptedText;
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
