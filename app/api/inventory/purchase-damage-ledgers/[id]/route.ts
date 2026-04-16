import { type NextRequest, NextResponse } from 'next/server';

import { resolveParams } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import { updatePurchaseDamageLedgerStatus } from '@/lib/services/purchase-damage-ledger-service';
import { updatePurchaseDamageLedgerSchema } from '@/lib/validations/purchase-damage-ledger';

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
    const validatedData = updatePurchaseDamageLedgerSchema.parse(body);

    try {
      const ledger = await updatePurchaseDamageLedgerStatus(
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
        error instanceof Error ? error.message : '更新破损台账失败';
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
  { permissions: ['inventory:inbound'] }
);
