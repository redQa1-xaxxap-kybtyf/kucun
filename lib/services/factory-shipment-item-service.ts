import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';

interface UpdateFactoryShipmentItemInboundStatusData {
  itemIds: string[];
}

/**
 * 更新厂家发货订单产品明细入库状态的 API 调用
 */
export async function updateFactoryShipmentItemInboundStatus(
  orderId: string,
  data: UpdateFactoryShipmentItemInboundStatusData
): Promise<void> {
  const response = await fetch(`/api/factory-shipments/${orderId}/inbound`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '更新自用入库状态失败');
  }
}

/**
 * 更新厂家发货订单产品明细入库状态的 Hook
 */
export function useUpdateFactoryShipmentItemInboundStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      data,
    }: {
      orderId: string;
      data: UpdateFactoryShipmentItemInboundStatusData;
    }) => updateFactoryShipmentItemInboundStatus(orderId, data),
    onSuccess: (_, { orderId }) => {
      // 刷新订单详情和列表数据
      queryClient.invalidateQueries({
        queryKey: queryKeys.factoryShipments.detail(orderId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.factoryShipments.lists(),
      });
    },
  });
}
