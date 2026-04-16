'use client';

import { Shield } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { SystemMode } from '../types';

interface DataManagementSwitchModeCardProps {
  systemMode: SystemMode;
  switchTargetMode: SystemMode;
  isSwitchPending: boolean;
  onOpenSwitchDialog: () => void;
}

export function DataManagementSwitchModeCard({
  systemMode,
  switchTargetMode,
  isSwitchPending,
  onOpenSwitchDialog,
}: DataManagementSwitchModeCardProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-slate-700" />
          账套模式切换（管理员）
        </CardTitle>
        <div className="text-muted-foreground text-sm">
          切换后会同步更新当前账套状态和数据管理入口，并记录本次操作。
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          当前：
          <Badge
            variant={systemMode === 'trial' ? 'secondary' : 'default'}
            className="ml-2"
          >
            {systemMode === 'trial' ? '试用' : '正式'}
          </Badge>
        </div>
        <Button
          variant="outline"
          className="h-10"
          onClick={onOpenSwitchDialog}
          disabled={isSwitchPending}
        >
          切换为{switchTargetMode === 'trial' ? '试用' : '正式'}
        </Button>
      </CardContent>
    </Card>
  );
}
