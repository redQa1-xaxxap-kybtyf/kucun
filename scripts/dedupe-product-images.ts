/**
 * 产品图片去重脚本（物理去重）
 *
 * 背景：历史上小程序创建产品时可能把同一张图重复写入 products.images(JSON)。
 * 本脚本会对 products.images 内的图片数组按 `type|url` 去重，并重排 order。
 *
 * 使用：
 * - 预览（默认，不写库）：npx tsx scripts/dedupe-product-images.ts
 * - 实际执行写库：        npx tsx scripts/dedupe-product-images.ts --apply
 * - 只处理某个产品：      npx tsx scripts/dedupe-product-images.ts --apply --productId=<id>
 * - 限制处理数量：        npx tsx scripts/dedupe-product-images.ts --apply --limit=200
 * - 调整批大小：          npx tsx scripts/dedupe-product-images.ts --apply --batchSize=200
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

type AnyImage = string | Record<string, unknown>;

function parseFlagValue(args: string[], key: string): string | undefined {
  const prefix = `${key}=`;
  const found = args.find(a => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const n = value ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function normalizeType(value: unknown): 'main' | 'effect' {
  return value === 'effect' ? 'effect' : 'main';
}

function normalizeUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function dedupeImages(raw: unknown): {
  ok: boolean;
  changed: boolean;
  images: unknown[];
  removed: number;
  reason?: string;
} {
  if (!Array.isArray(raw)) {
    return {
      ok: false,
      changed: false,
      images: [],
      removed: 0,
      reason: 'not-array',
    };
  }

  const seen = new Set<string>();
  const result: unknown[] = [];
  let removed = 0;

  (raw as AnyImage[]).forEach((item, originalIndex) => {
    if (typeof item === 'string') {
      const url = normalizeUrl(item);
      const type: 'main' | 'effect' = 'main';
      if (!url) {
        removed++;
        return;
      }
      const key = `${type}|${url}`;
      if (seen.has(key)) {
        removed++;
        return;
      }
      seen.add(key);
      result.push({ url, type, order: result.length });
      return;
    }

    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      removed++;
      return;
    }

    const obj = item as Record<string, unknown>;
    const url = normalizeUrl(obj.url);
    const type = normalizeType(obj.type);
    if (!url) {
      removed++;
      return;
    }

    const key = `${type}|${url}`;
    if (seen.has(key)) {
      removed++;
      return;
    }
    seen.add(key);

    // 保留首个出现的其它字段（如 alt），但覆盖 url/type/order
    result.push({
      ...obj,
      url,
      type,
      order: result.length,
    });
  });

  // 是否变化：长度变化 或 order 需要重排 或 过滤掉非法项
  let changed = removed > 0 || result.length !== raw.length;
  if (!changed) {
    // 即使长度没变，也可能存在 order 不连续/不一致，这里做一次轻量检查
    for (let i = 0; i < result.length; i++) {
      const it = result[i] as Record<string, unknown>;
      if (it.order !== i) {
        changed = true;
        break;
      }
    }
  }

  return { ok: true, changed, images: result, removed };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
产品图片去重脚本（物理去重）

用法：
  npx tsx scripts/dedupe-product-images.ts                # 预览（不写库）
  npx tsx scripts/dedupe-product-images.ts --apply        # 写库执行
  npx tsx scripts/dedupe-product-images.ts --productId=<id> [--apply]
  npx tsx scripts/dedupe-product-images.ts --limit=200 [--apply]
  npx tsx scripts/dedupe-product-images.ts --batchSize=200 [--apply]
`);
    return;
  }
  const apply = args.includes('--apply');
  const productId = parseFlagValue(args, '--productId');
  const batchSize = toPositiveInt(parseFlagValue(args, '--batchSize'), 200);
  const limit = toPositiveInt(
    parseFlagValue(args, '--limit'),
    Number.MAX_SAFE_INTEGER
  );

  const prisma = new PrismaClient();

  let scanned = 0;
  let parseFailed = 0;
  let wouldUpdate = 0;
  let updated = 0;
  let totalRemoved = 0;

  console.log('='.repeat(80));
  console.log(`🧹 产品图片去重（${apply ? '写库模式' : '预览模式'}）`);
  if (productId) console.log(`仅处理 productId=${productId}`);
  console.log('='.repeat(80));

  try {
    if (productId) {
      const p = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, code: true, images: true },
      });

      if (!p) {
        console.error(`❌ 未找到产品: ${productId}`);
        process.exitCode = 1;
        return;
      }

      const imagesJson = p.images;
      if (!imagesJson || !String(imagesJson).trim()) {
        console.log('ℹ️ 该产品 images 为空，无需处理');
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(String(imagesJson));
      } catch (e) {
        console.error('❌ images JSON 解析失败，跳过', e);
        process.exitCode = 1;
        return;
      }

      const r = dedupeImages(parsed);
      if (!r.ok) {
        console.log(`⚠️ images 不是数组，跳过（code=${p.code}）`);
        return;
      }

      scanned = 1;
      totalRemoved += r.removed;

      if (!r.changed) {
        console.log(`✅ 无重复/无需调整（code=${p.code}）`);
        return;
      }

      wouldUpdate = 1;
      console.log(`🔎 将更新 1 条产品（code=${p.code}），移除 ${r.removed} 项`);

      if (!apply) return;

      await prisma.product.update({
        where: { id: p.id },
        data: { images: r.images.length > 0 ? JSON.stringify(r.images) : null },
      });
      updated = 1;
      console.log('✅ 已写入更新');
      return;
    }

    let cursor: { id: string } | undefined;
    while (scanned < limit) {
      const take = Math.min(batchSize, limit - scanned);

      const products = await prisma.product.findMany({
        where: {
          images: { not: null },
        },
        select: { id: true, code: true, images: true },
        orderBy: { id: 'asc' },
        take,
        ...(cursor ? { cursor, skip: 1 } : {}),
      });

      if (products.length === 0) break;

      for (const p of products) {
        scanned++;
        const imagesJson = p.images;
        if (!imagesJson || !String(imagesJson).trim()) {
          continue;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(String(imagesJson));
        } catch (_e) {
          parseFailed++;
          continue;
        }

        const r = dedupeImages(parsed);
        if (!r.ok) {
          continue;
        }

        totalRemoved += r.removed;
        if (!r.changed) {
          continue;
        }

        wouldUpdate++;

        if (!apply) {
          // 预览模式只统计，避免刷屏
          continue;
        }

        try {
          await prisma.product.update({
            where: { id: p.id },
            data: {
              images: r.images.length > 0 ? JSON.stringify(r.images) : null,
            },
          });
          updated++;
        } catch (e) {
          console.error(`❌ 更新失败 code=${p.code} id=${p.id}`, e);
        }
      }

      cursor = { id: products[products.length - 1].id };
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(`\n${'-'.repeat(80)}`);
  console.log(`扫描产品: ${scanned}`);
  console.log(`JSON解析失败: ${parseFailed}`);
  console.log(`需要更新: ${wouldUpdate}`);
  console.log(`已更新: ${updated}`);
  console.log(`累计移除重复/非法项: ${totalRemoved}`);
  console.log('-'.repeat(80));

  if (!apply && wouldUpdate > 0) {
    console.log('\n提示：确认无误后用 --apply 执行写库。');
  }
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error('❌ 脚本执行失败:', err);
  process.exitCode = 1;
});
