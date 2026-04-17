export type DataManagementAction = 'reset_trial' | 'cleanup_test';

const DATA_MANAGEMENT_CONFIRM_TEXTS: Record<
  DataManagementAction,
  {
    primary: string;
    aliases: string[];
  }
> = {
  reset_trial: {
    primary: '重置',
    aliases: ['重置', '重置试用', '重置试用数据', '一键重置试用数据'],
  },
  cleanup_test: {
    primary: '清理',
    aliases: ['清理', '清理测试', '清理测试数据', '清理数据'],
  },
};

export function normaliseDataManagementConfirmText(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[\s\u200B-\u200D\uFEFF]+/g, '')
    .trim();
}

export function getDataManagementPrimaryConfirmText(
  action: DataManagementAction
) {
  return DATA_MANAGEMENT_CONFIRM_TEXTS[action].primary;
}

export function getDataManagementConfirmTextExamples(
  action: DataManagementAction
) {
  return DATA_MANAGEMENT_CONFIRM_TEXTS[action].aliases.slice(0, 2);
}

export function isValidDataManagementConfirmText(
  action: DataManagementAction,
  value: string
) {
  const normalisedInput = normaliseDataManagementConfirmText(value);

  if (!normalisedInput) {
    return false;
  }

  return DATA_MANAGEMENT_CONFIRM_TEXTS[action].aliases.some(
    alias =>
      normaliseDataManagementConfirmText(alias) === normalisedInput
  );
}
