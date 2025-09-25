'use client';

import { Wifi, WifiOff } from 'lucide-react';

import { useWebSocketContext } from '@/components/providers/websocket-provider';
import { Badge } from '@/components/ui/badge';

export function ConnectionStatus() {
  const { isConnected } = useWebSocketContext();

  return (
    <Badge variant={isConnected ? 'default' : 'destructive'} className="gap-1">
      {isConnected ? (
        <>
          <Wifi className="h-3 w-3" />
          已连接
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          连接中...
        </>
      )}
    </Badge>
  );
}
