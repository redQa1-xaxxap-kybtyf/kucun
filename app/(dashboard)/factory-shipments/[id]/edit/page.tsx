import { notFound } from 'next/navigation';

import { FactoryShipmentEditClient } from '@/components/factory-shipments/factory-shipment-edit-client';
import { getFactoryShipmentOrderServer } from '@/lib/api/factory-shipments-server';

interface FactoryShipmentEditPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * 厂家发货订单编辑页面 - ERP风格
 * 符合中国ERP系统的界面标准和用户习惯
 */
export default async function FactoryShipmentEditPage({
  params,
}: FactoryShipmentEditPageProps) {
  const { id } = await params;
  const order = await getFactoryShipmentOrderServer(id);

  if (!order) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-none px-4 py-4 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <FactoryShipmentEditClient orderId={id} initialData={order} />
      </div>
    </div>
  );
}
