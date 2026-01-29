import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { getDataManagementTask } from '@/lib/services/data-management/data-management-service';

export const GET = withAuth(
  async request => {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少 id 参数' },
        { status: 400 }
      );
    }

    const task = await getDataManagementTask(id);
    if (!task) {
      return NextResponse.json(
        { success: false, error: '任务不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: task });
  },
  { permissions: ['finance:manage'] }
);
