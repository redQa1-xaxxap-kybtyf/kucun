/**
 * 生成 Redis 认证参数：
 * - 仅在显式提供密码且 URL 中未内嵌密码时注入 password
 * - 避免重复认证参数导致的连接噪音
 */
export function getRedisAuthOptions(
  redisUrl: string,
  password?: string
): { password?: string } {
  const normalizedPassword = password?.trim();
  if (!normalizedPassword) {
    return {};
  }

  // 常见模板占位符不应作为真实密码参与连接
  if (/^your[-_ ]?redis[-_ ]?password$/i.test(normalizedPassword)) {
    return {};
  }

  try {
    const parsed = new URL(redisUrl);
    if (parsed.password) {
      return {};
    }
  } catch {
    // URL 解析失败时保守回退：沿用显式密码
  }

  return { password: normalizedPassword };
}
