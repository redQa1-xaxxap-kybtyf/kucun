/**
 * 智能分析进度显示组件
 * 显示详细的分析阶段和进度信息
 */

'use client';

import {
    AlertCircle,
    Brain,
    CheckCircle,
    Loader2,
    Search,
    Table,
    Zap,
} from 'lucide-react';
import React from 'react';

interface AnalysisStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  description?: string;
  duration?: number;
  icon?: React.ReactNode;
}

interface AnalysisProgressProps {
  isAnalyzing: boolean;
  currentStep?: string;
  steps?: AnalysisStep[];
  error?: string | null;
  className?: string;
}

const DEFAULT_ANALYSIS_STEPS: AnalysisStep[] = [
  {
    id: 'init',
    name: '初始化分析',
    status: 'pending',
    description: '准备分析环境，验证参数',
    icon: <Brain className="h-4 w-4" />,
  },
  {
    id: 'parse',
    name: '解析网页结构',
    status: 'pending',
    description: '分析HTML文档结构，识别关键元素',
    icon: <Search className="h-4 w-4" />,
  },
  {
    id: 'identify',
    name: '识别网站类型',
    status: 'pending',
    description: '检测网站类型（船舶追踪/物流查询等）',
    icon: <Zap className="h-4 w-4" />,
  },
  {
    id: 'analyze',
    name: '分析页面结构',
    status: 'pending',
    description: '分析表单、表格和数据字段结构',
    icon: <Table className="h-4 w-4" />,
  },
  {
    id: 'recommend',
    name: '生成推荐配置',
    status: 'pending',
    description: '基于分析结果生成CSS选择器推荐',
    icon: <CheckCircle className="h-4 w-4" />,
  },
];

type ResolveStepStatusOptions = {
  steps: AnalysisStep[];
  isAnalyzing: boolean;
  currentStep?: string;
  error?: string | null;
};

function resolveStepStatuses({
  steps,
  isAnalyzing,
  currentStep,
  error,
}: ResolveStepStatusOptions): AnalysisStep[] {
  const currentIndex = currentStep
    ? steps.findIndex(step => step.id === currentStep)
    : -1;

  return steps.map((step, stepIndex) => {
    let status = step.status;

    if (!isAnalyzing && currentIndex >= 0 && stepIndex <= currentIndex) {
      status = 'completed';
    } else if (isAnalyzing && currentStep === step.id) {
      status = 'running';
    } else if (error && currentIndex >= 0 && stepIndex <= currentIndex) {
      status = 'error';
    }

    return { ...step, status };
  });
}

function getStepColor(status: AnalysisStep['status']) {
  switch (status) {
    case 'running':
      return 'text-[hsl(var(--color-info))] bg-[hsl(var(--color-info-light))] border-[hsl(var(--color-info-light))]';
    case 'completed':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'error':
      return 'text-red-600 bg-red-50 border-red-200';
    default:
      return 'text-gray-500 bg-gray-50 border-gray-200';
  }
}

function getStepIcon(step: AnalysisStep) {
  const { status } = step;

  if (status === 'running') {
    return (
      <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--color-info))]" />
    );
  }

  if (status === 'completed') {
    return <CheckCircle className="h-4 w-4 text-green-600" />;
  }

  if (status === 'error') {
    return <AlertCircle className="h-4 w-4 text-red-600" />;
  }

  return (
    step.icon ?? (
      <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
    )
  );
}

const AnalysisStepItem = ({
  step,
  isAnalyzing,
}: {
  step: AnalysisStep;
  isAnalyzing: boolean;
}) => (
  <div
    className={`flex items-center gap-3 rounded-lg border p-2 transition-all duration-300 ${getStepColor(step.status)}`}
  >
    <div className="flex-shrink-0">{getStepIcon(step)}</div>

    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">{step.name}</p>
        {step.duration && (
          <span className="text-xs text-gray-500">({step.duration}ms)</span>
        )}
      </div>
      {step.description && (
        <p className="mt-1 text-xs text-gray-600">{step.description}</p>
      )}
    </div>

    {isAnalyzing && step.status === 'running' && (
      <div className="max-w-20 flex-1">
        <div className="h-1 overflow-hidden rounded-full bg-gray-200">
          <div className="h-full w-3/5 animate-pulse bg-[hsl(var(--color-info))]" />
        </div>
      </div>
    )}
  </div>
);

export function AnalysisProgress({
  isAnalyzing,
  currentStep,
  steps = [],
  error,
  className = '',
}: AnalysisProgressProps) {
  const analysisSteps = steps.length > 0 ? steps : DEFAULT_ANALYSIS_STEPS;
  const updatedSteps = resolveStepStatuses({
    steps: analysisSteps,
    isAnalyzing,
    currentStep,
    error,
  });

  if (!isAnalyzing && !currentStep && !error) {
    return null;
  }

  return (
    <div className={`space-y-3 rounded-lg border bg-white p-4 ${className}`}>
      <div className="flex items-center gap-2">
        {isAnalyzing ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--color-info))]" />
            <h3 className="font-medium text-gray-900">正在分析页面...</h3>
          </>
        ) : error ? (
          <>
            <AlertCircle className="h-5 w-5 text-red-600" />
            <h3 className="font-medium text-red-900">分析失败</h3>
          </>
        ) : (
          <>
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h3 className="font-medium text-green-900">分析完成</h3>
          </>
        )}
      </div>

      {/* 分析步骤 */}
      <div className="space-y-2">
        {updatedSteps.map(step => (
          <AnalysisStepItem
            key={step.id}
            step={step}
            isAnalyzing={isAnalyzing}
          />
        ))}
      </div>

      {/* 错误信息 */}
      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* 分析提示 */}
      {isAnalyzing && (
        <div className="mt-3 rounded-lg border border-[hsl(var(--color-info-light))] bg-[hsl(var(--color-info-light))] p-3">
          <p className="text-sm text-[hsl(var(--color-info))]">
            💡 正在使用增强智能分析算法识别页面结构，请稍候...
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * 分析进度Hook
 */
export function useAnalysisProgress() {
  const [currentStep, setCurrentStep] = React.useState<string | null>(null);
  const [steps, setSteps] = React.useState<AnalysisStep[]>([]);
  const [startTime, setStartTime] = React.useState<number | null>(null);

  const startAnalysis = (customSteps?: AnalysisStep[]) => {
    const initialSteps = customSteps || [
      {
        id: 'init',
        name: '初始化分析',
        status: 'pending' as const,
        description: '准备分析环境',
        icon: <Brain className="h-4 w-4" />,
      },
      {
        id: 'parse',
        name: '解析网页结构',
        status: 'pending' as const,
        description: '分析HTML文档结构',
        icon: <Search className="h-4 w-4" />,
      },
      {
        id: 'identify',
        name: '识别网站类型',
        status: 'pending' as const,
        description: '检测网站类型',
        icon: <Zap className="h-4 w-4" />,
      },
      {
        id: 'analyze',
        name: '分析页面结构',
        status: 'pending' as const,
        description: '分析表单和表格结构',
        icon: <Table className="h-4 w-4" />,
      },
      {
        id: 'recommend',
        name: '生成推荐配置',
        status: 'pending' as const,
        description: '生成CSS选择器推荐',
        icon: <CheckCircle className="h-4 w-4" />,
      },
    ];

    setSteps(initialSteps);
    setCurrentStep('init');
    setStartTime(Date.now());
  };

  const updateStep = (
    stepId: string,
    status: AnalysisStep['status'],
    duration?: number
  ) => {
    setSteps(prev =>
      prev.map(step =>
        step.id === stepId ? { ...step, status, duration } : step
      )
    );
    setCurrentStep(stepId);
  };

  const completeAnalysis = () => {
    if (startTime) {
      const totalDuration = Date.now() - startTime;
      setSteps(prev =>
        prev.map(step =>
          step.status === 'completed' || step.status === 'running'
            ? {
                ...step,
                status: 'completed' as const,
                duration: Math.round(totalDuration / prev.length),
              }
            : step
        )
      );
    }
    setCurrentStep('completed');
  };

  const resetAnalysis = () => {
    setCurrentStep(null);
    setSteps([]);
    setStartTime(null);
  };

  return {
    currentStep,
    steps,
    startAnalysis,
    updateStep,
    completeAnalysis,
    resetAnalysis,
  };
}
