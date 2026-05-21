import { randomBytes } from 'crypto';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import {
  checkRateLimit,
  getRateLimiter,
  RateLimitType,
} from '@/lib/rate-limit';
import { getVisibleMiniProgramOwnProductSnapshots } from '@/lib/services/miniprogram-catalog-service';
import { parseProductImages } from '@/lib/utils/product-transforms';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const GOODS_REQUEST_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const GOODS_REQUEST_RATE_LIMIT_MAX = 30;
const GOODS_REQUEST_ENDPOINT_LIMIT_KEY = 'endpoint:miniprogram-goods-requests';
const goodsRequestRateBuckets = new Map<
  string,
  { windowStart: number; count: number }
>();

const itemSchema = z
  .object({
    productId: z.string().uuid().optional().nullable(),
    temporaryProductId: z.string().uuid().optional().nullable(),
    productSource: z.enum(['own', 'external']).default('own'),
    productCode: z.string().trim().min(1, '产品编码不能为空').max(120),
    productName: z.string().trim().min(1, '产品名称不能为空').max(150),
    specification: z.string().trim().max(500).optional().nullable(),
    unit: z.string().trim().max(32).optional().nullable(),
    thumbnailUrl: z.string().trim().max(2048).optional().nullable(),
    quantity: z.coerce.number().int().min(1).max(99999),
    remarks: z.string().trim().max(255).optional().nullable(),
  })
  .superRefine((item, ctx) => {
    if (item.productSource === 'own' && !item.productId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['productId'],
        message: '请选择有效产品',
      });
    }

    if (item.productSource === 'external' && !item.temporaryProductId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['temporaryProductId'],
        message: '请选择有效调货产品',
      });
    }
  });

const createGoodsRequestSchema = z.object({
  customerName: z.string().trim().max(100).optional().nullable(),
  customerPhone: z
    .string()
    .trim()
    .min(5, '请填写联系电话')
    .max(50, '联系电话过长'),
  contactAddress: z.string().trim().max(255).optional().nullable(),
  remarks: z.string().trim().max(1000).optional().nullable(),
  items: z.array(itemSchema).min(1, '请至少选择一个产品').max(100),
});

const lookupTokenSchema = z
  .string()
  .trim()
  .min(16, '报货记录凭证格式不正确')
  .max(96, '报货记录凭证格式不正确')
  .regex(/^[A-Za-z0-9_-]+$/, '报货记录凭证格式不正确');

function privateNoStoreJson(data: unknown, init?: ResponseInit) {
  const response = NextResponse.json(data, init);
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  return response;
}

function compactNullableText(value?: string | null) {
  const text = value?.trim();
  return text ? text : null;
}

function normalizeRateLimitText(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 120);
}

function normalizeRateLimitPhone(value: string) {
  return value.replace(/[^\dA-Za-z+]/g, '').toLowerCase() || 'anonymous';
}

function buildGoodsRequestRateLimitKey(data: CreateGoodsRequestInput | null) {
  if (!data) return 'goods-request:invalid';

  const itemKeys = data.items
    .map(item => {
      const source = item.productSource;
      const id = source === 'own' ? item.productId : item.temporaryProductId;
      if (id) return `${source}:${id}`;

      return [
        source,
        normalizeRateLimitText(item.productCode),
        normalizeRateLimitText(item.productName),
      ].join(':');
    })
    .sort()
    .join('|')
    .slice(0, 1000);

  return [
    'goods-request',
    normalizeRateLimitPhone(data.customerPhone),
    itemKeys || 'no-items',
  ].join(':');
}

function hitGoodsRequestRateLimit(key: string) {
  const now = Date.now();

  if (goodsRequestRateBuckets.size > 1000) {
    for (const [bucketKey, bucket] of goodsRequestRateBuckets.entries()) {
      if (now - bucket.windowStart > GOODS_REQUEST_RATE_LIMIT_WINDOW_MS) {
        goodsRequestRateBuckets.delete(bucketKey);
      }
    }
  }

  const bucket = goodsRequestRateBuckets.get(key);
  if (
    !bucket ||
    now - bucket.windowStart > GOODS_REQUEST_RATE_LIMIT_WINDOW_MS
  ) {
    goodsRequestRateBuckets.set(key, { windowStart: now, count: 1 });
    return false;
  }

  bucket.count += 1;
  return bucket.count > GOODS_REQUEST_RATE_LIMIT_MAX;
}

function generateRequestNumber() {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const time = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');

  return `BH${date}${time}${randomBytes(2).toString('hex').toUpperCase()}`;
}

function generateLookupToken() {
  return randomBytes(24).toString('base64url');
}

function formatGoodsRequest(
  request: Awaited<ReturnType<typeof findGoodsRequestByToken>>
) {
  if (!request) return null;

  return {
    id: request.id,
    requestNumber: request.requestNumber,
    lookupToken: request.lookupToken,
    customerName: request.customerName,
    customerPhone: request.customerPhone,
    contactAddress: request.contactAddress,
    remarks: request.remarks,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    items: request.items.map(item => ({
      id: item.id,
      productId: item.productId,
      temporaryProductId: item.temporaryProductId,
      productSource: item.productSource,
      productCode: item.productCode,
      productName: item.productName,
      specification: item.specification,
      unit: item.unit,
      thumbnailUrl: item.thumbnailUrl,
      quantity: item.quantity,
      remarks: item.remarks,
    })),
  };
}

async function findGoodsRequestByToken(lookupToken: string) {
  return prisma.miniProgramGoodsRequest.findUnique({
    where: { lookupToken },
    include: {
      items: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

async function checkGoodsRequestWriteRateLimit(request: NextRequest) {
  const clientLimit = await checkRateLimit(request, RateLimitType.WRITE);
  if (clientLimit.limited) return clientLimit.response ?? null;

  const endpointLimit = await getRateLimiter(RateLimitType.GLOBAL).checkLimit(
    GOODS_REQUEST_ENDPOINT_LIMIT_KEY
  );
  if (endpointLimit.allowed) return null;

  return privateNoStoreJson(
    { success: false, error: '提交过于频繁，请稍后再试' },
    {
      status: 429,
      headers: {
        'Retry-After': String(
          Math.max(
            1,
            Math.ceil((endpointLimit.resetAt.getTime() - Date.now()) / 1000)
          )
        ),
        'X-RateLimit-Limit': String(endpointLimit.limit),
        'X-RateLimit-Remaining': String(endpointLimit.remaining),
        'X-RateLimit-Reset': endpointLimit.resetAt.toISOString(),
      },
    }
  );
}

type GoodsRequestItemInput = z.infer<typeof itemSchema>;
type CreateGoodsRequestInput = z.infer<typeof createGoodsRequestSchema>;

function firstImageUrl(imagesJson?: string | null) {
  return parseProductImages(imagesJson ?? null)[0]?.url ?? null;
}

async function buildGoodsRequestItemSnapshots(items: GoodsRequestItemInput[]) {
  const ownIds = Array.from(
    new Set(
      items
        .filter(item => item.productSource === 'own' && item.productId)
        .map(item => item.productId as string)
    )
  );
  const temporaryIds = Array.from(
    new Set(
      items
        .filter(
          item => item.productSource === 'external' && item.temporaryProductId
        )
        .map(item => item.temporaryProductId as string)
    )
  );

  const [products, temporaryProducts] = await Promise.all([
    ownIds.length
      ? getVisibleMiniProgramOwnProductSnapshots(ownIds)
      : Promise.resolve(new Map()),
    temporaryIds.length
      ? prisma.temporaryProduct.findMany({
          where: {
            id: { in: temporaryIds },
            showInMiniProgram: true,
            supplier: { status: 'active' },
          },
          select: {
            id: true,
            code: true,
            name: true,
            specification: true,
            unit: true,
            thumbnailUrl: true,
            images: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const productById = products;
  const temporaryProductById = new Map(
    temporaryProducts.map(product => [product.id, product])
  );

  return items.map(item => {
    if (item.productSource === 'own') {
      const product = productById.get(item.productId as string);
      if (!product) {
        throw new Error(`产品“${item.productName}”已下架或不存在`);
      }

      return {
        productId: product.id,
        temporaryProductId: null,
        productSource: 'own',
        productCode: product.code,
        productName: product.name,
        specification: compactNullableText(product.specification),
        unit: compactNullableText(item.unit) || product.unit || '片',
        thumbnailUrl: compactNullableText(product.thumbnailUrl),
        quantity: item.quantity,
        remarks: compactNullableText(item.remarks),
      };
    }

    const product = temporaryProductById.get(item.temporaryProductId as string);
    if (!product) {
      throw new Error(`调货产品“${item.productName}”已下架或不存在`);
    }

    return {
      productId: null,
      temporaryProductId: product.id,
      productSource: 'external',
      productCode: product.code,
      productName: product.name,
      specification: compactNullableText(product.specification),
      unit: compactNullableText(item.unit) || product.unit || '片',
      thumbnailUrl: compactNullableText(
        product.thumbnailUrl || firstImageUrl(product.images)
      ),
      quantity: item.quantity,
      remarks: compactNullableText(item.remarks),
    };
  });
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, RateLimitType.READ);
  if (rateLimitResponse.limited && rateLimitResponse.response) {
    return rateLimitResponse.response;
  }

  const lookupToken = request.nextUrl.searchParams.get('lookupToken')?.trim();

  if (!lookupToken) {
    return privateNoStoreJson(
      { success: false, error: '缺少报货记录凭证' },
      { status: 400 }
    );
  }

  const parsedLookupToken = lookupTokenSchema.safeParse(lookupToken);
  if (!parsedLookupToken.success) {
    return privateNoStoreJson(
      {
        success: false,
        error:
          parsedLookupToken.error.issues[0]?.message ||
          '报货记录凭证格式不正确',
      },
      { status: 400 }
    );
  }

  const goodsRequest = await findGoodsRequestByToken(parsedLookupToken.data);
  if (!goodsRequest) {
    return privateNoStoreJson(
      { success: false, error: '报货记录不存在' },
      { status: 404 }
    );
  }

  return privateNoStoreJson({
    success: true,
    data: formatGoodsRequest(goodsRequest),
  });
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkGoodsRequestWriteRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json().catch(() => null);
  const parsed = createGoodsRequestSchema.safeParse(body ?? {});
  const rateLimitKey = buildGoodsRequestRateLimitKey(
    parsed.success ? parsed.data : null
  );

  if (hitGoodsRequestRateLimit(rateLimitKey)) {
    return privateNoStoreJson(
      { success: false, error: '提交过于频繁，请稍后再试' },
      { status: 429 }
    );
  }

  if (!parsed.success) {
    return privateNoStoreJson(
      {
        success: false,
        error: parsed.error.issues[0]?.message || '提交内容不正确',
        details: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  const data = parsed.data;
  let itemSnapshots: Awaited<ReturnType<typeof buildGoodsRequestItemSnapshots>>;

  try {
    itemSnapshots = await buildGoodsRequestItemSnapshots(data.items);
  } catch (error) {
    return privateNoStoreJson(
      {
        success: false,
        error: error instanceof Error ? error.message : '报货产品已不可用',
      },
      { status: 400 }
    );
  }

  const goodsRequest = await prisma.miniProgramGoodsRequest.create({
    data: {
      requestNumber: generateRequestNumber(),
      lookupToken: generateLookupToken(),
      customerName: compactNullableText(data.customerName),
      customerPhone: data.customerPhone,
      contactAddress: compactNullableText(data.contactAddress),
      remarks: compactNullableText(data.remarks),
      items: {
        create: itemSnapshots,
      },
    },
    include: {
      items: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return privateNoStoreJson(
    {
      success: true,
      data: formatGoodsRequest(goodsRequest),
      message: '报货单已提交',
    },
    { status: 201 }
  );
}
