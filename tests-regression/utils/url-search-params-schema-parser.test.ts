import { z } from 'zod';

import {
  getDefaultParams,
  parseFromUrl,
  parseSchema,
  validateParams,
} from '@/hooks/url-search-params/schema-parser';

describe('url-search-params/schema-parser', () => {
  test('config schema: parseFromUrl + validateParams', () => {
    const schema = {
      page: { type: 'number', default: 1, min: 1, max: 99 },
      limit: { type: 'number', default: 50, min: 1, max: 100 },
      search: { type: 'string', default: '' },
      lowStock: { type: 'boolean', default: false },
      sortOrder: {
        type: 'enum',
        values: ['asc', 'desc'] as const,
        default: 'desc',
      },
    } as const;

    const configs = parseSchema(schema);
    expect(getDefaultParams(configs)).toEqual({
      page: 1,
      limit: 50,
      search: '',
      lowStock: false,
      sortOrder: 'desc',
    });

    const parsed = parseFromUrl(
      new URLSearchParams(
        'page=0&limit=200&search=abc&lowStock=true&sortOrder=asc'
      ),
      configs
    );

    // number min/max clamp
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(100);
    expect(parsed.search).toBe('abc');
    expect(parsed.lowStock).toBe(true);
    expect(parsed.sortOrder).toBe('asc');

    expect(validateParams(parsed, schema).success).toBe(true);
    expect(validateParams({ ...parsed, page: 0 }, schema).success).toBe(false);
    expect(
      validateParams({ ...parsed, sortOrder: 'oops' as any }, schema).success
    ).toBe(false);
  });

  test('zod schema: parseSchema + validateParams', () => {
    const schema = z.object({
      page: z.number().int().positive().default(1),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
      categoryId: z.string().optional(),
    });

    const configs = parseSchema(schema);
    expect(configs.page).toEqual({ type: 'number', default: 1 });
    expect(configs.sortOrder).toEqual({
      type: 'enum',
      values: ['asc', 'desc'],
      default: 'desc',
    });
    expect(configs.categoryId).toEqual({ type: 'string', default: undefined });

    const ok = validateParams(
      { page: 2, sortOrder: 'asc', categoryId: undefined },
      schema
    );
    expect(ok).toEqual({
      success: true,
      data: { page: 2, sortOrder: 'asc', categoryId: undefined },
    });

    const bad = validateParams({ page: 0, sortOrder: 'desc' } as any, schema);
    expect(bad.success).toBe(false);
    expect(bad.error).toContain('page:');
  });
});

