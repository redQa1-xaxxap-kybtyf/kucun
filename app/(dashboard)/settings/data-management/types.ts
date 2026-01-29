export type SystemMode = 'trial' | 'production';

export type DataManagementAction = 'reset_trial' | 'cleanup_test';

export type PreviewItem = {
  id: string;
  label: string;
  count: number;
  amountSum?: number;
};

export type Preview = {
  action: DataManagementAction;
  systemMode: SystemMode;
  totals: { count: number; amountSum: number };
  items: PreviewItem[];
  generatedAt: string;
};

export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed';

export type TaskStage = 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6';

export type Task = {
  id: string;
  action: DataManagementAction;
  status: TaskStatus;
  stage: TaskStage | null;
  requestedBy: string;
  preview: Preview | null;
  result: unknown | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiSuccess<T> = { success: true; data: T };
export type ApiFailure = { success: false; error: string; details?: unknown };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
