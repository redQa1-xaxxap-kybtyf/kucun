'use client';

import * as React from 'react';

import {
  DataManagementExecuteDialog,
  DataManagementPreviewDialog,
  DataManagementSwitchModeDialog,
} from './components/DataManagementDialogs';
import { DataManagementModeCard } from './components/DataManagementModeCard';
import { DataManagementSwitchModeCard } from './components/DataManagementSwitchModeCard';
import { DataManagementTaskProgressCard } from './components/DataManagementTaskProgressCard';
import {
  useDataManagementExecute,
  useDataManagementPreview,
  useDataManagementTask,
  useSystemModeSwitch,
} from './hooks/useDataManagementPage';
import type { DataManagementAction, SystemMode } from './types';

export function DataManagementPageClient({
  systemMode,
  canSwitchMode,
}: {
  systemMode: SystemMode;
  canSwitchMode?: boolean;
}) {
  const action: DataManagementAction =
    systemMode === 'trial' ? 'reset_trial' : 'cleanup_test';
  const confirmWord = action === 'reset_trial' ? '重置' : '清理';

  const switchTargetMode: SystemMode =
    systemMode === 'trial' ? 'production' : 'trial';
  const switchConfirmWord =
    switchTargetMode === 'trial' ? '切换为试用' : '切换为正式';

  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [executeOpen, setExecuteOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState('');
  const [taskId, setTaskId] = React.useState<string | null>(null);
  const [switchOpen, setSwitchOpen] = React.useState(false);
  const [switchConfirmText, setSwitchConfirmText] = React.useState('');

  const previewMutation = useDataManagementPreview(action);

  const executeMutation = useDataManagementExecute({
    action,
    preview: previewMutation.data ?? null,
    confirmText,
    onSuccess: nextTaskId => {
      setTaskId(nextTaskId);
      setExecuteOpen(false);
      setConfirmText('');
    },
  });

  const switchModeMutation = useSystemModeSwitch({
    targetMode: switchTargetMode,
    onSuccess: _mode => {
      setSwitchOpen(false);
      setSwitchConfirmText('');
    },
  });

  const taskQuery = useDataManagementTask(taskId);

  return (
    <div className="space-y-4 sm:space-y-6">
      <DataManagementModeCard
        systemMode={systemMode}
        isPreviewPending={previewMutation.isPending}
        onPreview={() => {
          setPreviewOpen(true);
          previewMutation.mutate();
        }}
        onExecute={() => setExecuteOpen(true)}
      />

      {canSwitchMode && (
        <DataManagementSwitchModeCard
          systemMode={systemMode}
          switchTargetMode={switchTargetMode}
          isSwitchPending={switchModeMutation.isPending}
          onOpenSwitchDialog={() => setSwitchOpen(true)}
        />
      )}

      {taskId && (
        <DataManagementTaskProgressCard
          taskId={taskId}
          task={taskQuery.data}
          isLoading={taskQuery.isLoading}
          isFetching={taskQuery.isFetching}
        />
      )}

      <DataManagementPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        preview={previewMutation.data}
        isPending={previewMutation.isPending}
      />

      <DataManagementExecuteDialog
        open={executeOpen}
        onOpenChange={setExecuteOpen}
        systemMode={systemMode}
        confirmWord={confirmWord}
        confirmText={confirmText}
        onConfirmTextChange={setConfirmText}
        isExecuting={executeMutation.isPending}
        onExecute={() => executeMutation.mutate()}
      />

      <DataManagementSwitchModeDialog
        open={switchOpen}
        onOpenChange={setSwitchOpen}
        switchTargetMode={switchTargetMode}
        switchConfirmWord={switchConfirmWord}
        switchConfirmText={switchConfirmText}
        onSwitchConfirmTextChange={setSwitchConfirmText}
        isSwitching={switchModeMutation.isPending}
        onSwitch={() => switchModeMutation.mutate()}
      />
    </div>
  );
}
