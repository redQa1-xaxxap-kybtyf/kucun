import {
  createFriendlyApiError,
  extractApiErrorMessage,
  formatDuplicateFieldMessage,
  getFriendlyErrorMessage,
  normalizeUserFacingErrorMessage,
} from '@/lib/utils/user-friendly-error';

describe('用户友好错误文案', () => {
  test('应将常见英文状态词翻译为中文', () => {
    expect(
      normalizeUserFacingErrorMessage('Bad Request', '创建客户失败，请稍后重试')
    ).toBe('请求数据有误，请检查后重试');

    expect(
      normalizeUserFacingErrorMessage(
        'Internal Server Error',
        '创建客户失败，请稍后重试'
      )
    ).toBe('服务器开小差了，请稍后重试');
  });

  test('应将唯一约束字段翻译为中文提示', () => {
    expect(formatDuplicateFieldMessage(['name', 'phone'])).toBe(
      '以下信息已存在：名称、联系电话，请检查后再试'
    );

    expect(
      normalizeUserFacingErrorMessage(
        'Unique constraint failed on the fields: (`phone`)',
        '创建客户失败'
      )
    ).toBe('联系电话已存在，请勿重复录入');
  });

  test('应保留后端已经返回的中文业务提示', () => {
    const rawMessage =
      '地区「华东」已存在使用手机号 13800138000 的客户，请检查后再试。';

    expect(getFriendlyErrorMessage(new Error(rawMessage), '创建客户失败')).toBe(
      rawMessage
    );
  });

  test('应从接口 payload 中提取主错误并拼接明细', () => {
    expect(
      extractApiErrorMessage(
        {
          error: '创建产品失败',
          details: [
            { message: '产品编码不能为空' },
            { message: '产品名称不能为空' },
          ],
        },
        '创建产品失败'
      )
    ).toBe('创建产品失败：产品编码不能为空；产品名称不能为空');
  });

  test('应将非 JSON 错误响应兜底为中文', async () => {
    const response = new Response('Internal Server Error', {
      status: 500,
      statusText: 'Internal Server Error',
    });

    const error = await createFriendlyApiError(response, '创建客户失败');

    expect(error.message).toBe('服务器开小差了，请稍后重试');
  });
});
