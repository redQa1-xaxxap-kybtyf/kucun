import {
  deleteProduct,
  getProductById,
  updateProduct,
} from '@/lib/api/handlers/products';
import { withAuth, withErrorHandling } from '@/lib/api/middleware';
import {
  errorResponse,
  notFoundResponse,
  successResponse,
  validationErrorResponse,
} from '@/lib/api/response';
import { extractRequestInfo } from '@/lib/logger';
import { productUpdateSchema } from '@/lib/validations/product';

/**
 * 获取单个产品信息
 */
export const GET = withErrorHandling(
  withAuth(async (request, context, _session) => {
    const params = await context.params;
    if (!params) {
      return errorResponse('参数缺失', 400);
    }
    const { id } = params;

    const product = await getProductById(id);
    if (!product) {
      return notFoundResponse('产品不存在');
    }

    return successResponse(product);
  })
);
/**
 * 更新产品信息
 */
export const PUT = withErrorHandling(
  withAuth(async (request, context, _session) => {
    const params = await context.params;
    if (!params) {
      return errorResponse('参数缺失', 400);
    }
    const { id } = params;
    const body = await request.json();

    // 验证请求数据
    const validationResult = productUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return validationErrorResponse(
        '产品数据格式不正确',
        validationResult.error.errors
      );
    }

    try {
      const requestInfo = extractRequestInfo(request);
      const product = await updateProduct(
        id,
        validationResult.data,
        _session.user.id,
        requestInfo.ipAddress,
        requestInfo.userAgent
      );
      return successResponse(product, 200, '产品更新成功');
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : '产品更新失败',
        400
      );
    }
  })
);

/**
 * 删除产品
 */
export const DELETE = withErrorHandling(
  withAuth(async (request, context, _session) => {
    const params = await context.params;
    if (!params) {
      return errorResponse('参数缺失', 400);
    }
    const { id } = params;

    try {
      const requestInfo = extractRequestInfo(request);
      const result = await deleteProduct(
        id,
        _session.user.id,
        requestInfo.ipAddress,
        requestInfo.userAgent
      );
      return successResponse(result, 200, '产品删除成功');
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : '产品删除失败',
        400
      );
    }
  })
);
