import { generateTestDataSet } from '@/lib/api/handlers/seed-data';
import { withAuth } from '@/lib/auth/api-helpers';
import { successResponse } from '@/lib/api/response';
import { logger } from '@/lib/logger';

/**
 * 生成测试数据
 *
 * 商业/生产环境安全要求：
 * - 默认关闭，必须显式设置 ENABLE_TEST_DATA_API=true 才能使用。
 * - 仅 admin 可调用。
 * - 如果 NODE_ENV=production，还需要二次确认变量，避免误把测试数据写入正式账套。
 */
export const POST = withAuth(async (_request, { user }) => {
  const enabled =
    process.env.ENABLE_TEST_DATA_API === 'true' ||
    process.env.ENABLE_TEST_DATA_API === '1';

  const productionConfirmed =
    process.env.ENABLE_TEST_DATA_API_PRODUCTION_CONFIRM ===
    'I_UNDERSTAND_THIS_CREATES_TEST_DATA';

  if (
    !enabled ||
    (process.env.NODE_ENV === 'production' && !productionConfirmed)
  ) {
    logger.warn('seed-test-data', '测试数据接口被拒绝调用', {
      userId: user.id,
      nodeEnv: process.env.NODE_ENV,
      enabled,
      productionConfirmed,
    });

    return Response.json(
      { success: false, error: 'Not Found' },
      { status: 404 }
    );
  }

  const result = await generateTestDataSet();

  return successResponse(
    result,
    201,
    `测试数据生成成功：${result.categories}个分类，${result.products}个产品，${result.variants}个变体，${result.customers}个客户，${result.suppliers}个供应商，${result.inventory}条库存记录`
  );
}, { requireAdmin: true });
