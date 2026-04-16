import { type NextRequest, NextResponse } from 'next/server';

import { resolveParams } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import { updateManualDamageLedger } from '@/lib/services/manual-damage-ledger-service';
import { updateManualDamageLedgerSchema } from '@/lib/validations/manual-damage-ledger';

export const PATCH = withAuth(
  async (
    request: NextRequest,
    context: {
      user: {
        id: string;
      };
      params?: Promise<Record<string, string>> | Record<string, string>;
    }
  ) => {
    const { id } = await resolveParams(context.params);
    const body = await request.json();
    const validatedData = updateManualDamageLedgerSchema.parse(body);

    try {
      const ledger = await updateManualDamageLedger(
        id,
        validatedData,
        context.user.id
      );

      return NextResponse.json({
        success: true,
        data: ledger,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '更新手工报损台账失败';
      const status = message.includes('不存在') ? 404 : 400;

      return NextResponse.json(
        {
          success: false,
          error: message,
        },
        { status }
      );
    }
  },
  { permissions: ['inventory:adjust'] }
);
