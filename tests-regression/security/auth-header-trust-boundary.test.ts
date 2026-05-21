import type { NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { getAuthVerificationHeaderValue } from '@/lib/auth/trusted-headers';

function createRequest(headers: Record<string, string> = {}): NextRequest {
  return {
    method: 'GET',
    headers: new Headers(headers),
    nextUrl: {
      origin: 'http://localhost:3000',
      pathname: '/api/logs',
    },
  } as unknown as NextRequest;
}

describe('auth header trust boundary', () => {
  it('拒绝客户端伪造的身份头', async () => {
    const handler = jest.fn(() => Response.json({ success: true }));
    const route = withAuth(handler, { requireAdmin: true });

    const response = await route(
      createRequest({
        'x-user-id': 'admin-123',
        'x-user-username': 'fake-admin',
        'x-user-role': 'admin',
      })
    );

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: '未授权访问：认证来源无效',
    });
  });

  it('允许中间件注入的可信身份头进入处理函数', async () => {
    const handler = jest.fn((_request, { user }) =>
      Response.json({ success: true, userId: user.id })
    );
    const route = withAuth(handler, { requireAdmin: true });

    const response = await route(
      createRequest({
        'x-auth-verified': getAuthVerificationHeaderValue(),
        'x-user-id': 'admin-123',
        'x-user-username': 'admin',
        'x-user-role': 'admin',
      })
    );

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({
      success: true,
      userId: 'admin-123',
    });
  });
});
