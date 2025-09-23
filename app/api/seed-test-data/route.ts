import { generateTestDataSet } from '@/lib/api/handlers/seed-data';
import { withErrorHandling } from '@/lib/api/middleware';
import { successResponse } from '@/lib/api/response';

/**
 * 生成测试数据
 */
export const POST = withErrorHandling(async () => {
  const result = await generateTestDataSet();

  return successResponse(
    result,
    201,
    `测试数据生成成功：${result.categories}个分类，${result.products}个产品，${result.variants}个变体，${result.customers}个客户，${result.suppliers}个供应商，${result.inventory}条库存记录`
  );
});
