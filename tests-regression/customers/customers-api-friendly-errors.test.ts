import { createCustomer } from '@/lib/api/customers';
import { csrfFetch } from '@/lib/utils/csrf';

jest.mock('@/lib/utils/csrf', () => ({
  csrfFetch: jest.fn(),
}));

describe('客户 API 友好错误提示', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('创建客户失败时应优先展示后端返回的中文业务错误', async () => {
    (csrfFetch as jest.Mock).mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error:
            '地区「华东」已存在使用手机号 13800138000 的客户，请检查后再试。',
        }),
        {
          status: 400,
          statusText: 'Bad Request',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    await expect(
      createCustomer({
        name: '测试客户',
        phone: '13800138000',
      })
    ).rejects.toThrow(
      '地区「华东」已存在使用手机号 13800138000 的客户，请检查后再试。'
    );
  });

  test('创建客户失败时不应直接暴露英文 statusText', async () => {
    (csrfFetch as jest.Mock).mockResolvedValue(
      new Response('', {
        status: 500,
        statusText: 'Internal Server Error',
      })
    );

    await expect(
      createCustomer({
        name: '测试客户',
      })
    ).rejects.toThrow('服务器开小差了，请稍后重试');
  });
});
