import type { CSSProperties } from 'react';

const paletteSteps = Array.from({ length: 10 }, (_, index) => index + 1);

const paletteGroups = [
  {
    label: 'Primary',
    prefix: 'primary',
    description: '品牌主色，供按钮、链接、选中态和重点强调使用。',
  },
  {
    label: 'Success',
    prefix: 'success',
    description: '成功、完成、已对账等正向业务状态。',
  },
  {
    label: 'Warning',
    prefix: 'warning',
    description: '预警、即将到期、待处理等提醒状态。',
  },
  {
    label: 'Error',
    prefix: 'error',
    description: '失败、逾期、异常、风险状态。',
  },
  {
    label: 'Info',
    prefix: 'info',
    description: '处理中、流程中、中性信息提示。',
  },
  {
    label: 'Purple',
    prefix: 'purple',
    description: '辅助强调、已访问链接、次级主题视觉。',
  },
  {
    label: 'Cyan',
    prefix: 'cyan',
    description: '分析、统计、辅助数据可视化场景。',
  },
] as const;

const legacyAliases = [
  ['primary-50', 'primary-1'],
  ['primary-100', 'primary-2'],
  ['primary-400', 'primary-5'],
  ['primary-500', 'primary-6'],
  ['primary-600', 'primary-7'],
  ['purple-100', 'purple-2'],
  ['purple-400', 'purple-5'],
  ['purple-500', 'purple-6'],
  ['cyan-100', 'cyan-2'],
  ['cyan-400', 'cyan-5'],
  ['cyan-500', 'cyan-6'],
  ['success-100', 'success-2'],
  ['success-400', 'success-5'],
  ['success-500', 'success-6'],
  ['warning-100', 'warning-2'],
  ['warning-400', 'warning-5'],
  ['warning-500', 'warning-6'],
  ['error-100', 'error-2'],
  ['error-400', 'error-5'],
  ['error-500', 'error-6'],
  ['info-100', 'info-2'],
  ['info-400', 'info-5'],
  ['info-500', 'info-6'],
] as const;

const semanticSections = [
  {
    title: 'Primary States',
    description: '供按钮、选中、轻背景和边框等交互状态复用。',
    items: [
      ['color-primary', '主色'],
      ['color-primary-hover', '悬停'],
      ['color-primary-active', '按下'],
      ['color-primary-selected', '选中背景'],
      ['color-primary-disabled', '禁用'],
      ['color-primary-border', '强调边框'],
      ['color-primary-bg', '浅背景'],
      ['color-primary-bg-hover', '浅背景悬停'],
    ],
  },
  {
    title: 'Link & Focus',
    description: '供文本链接、visited、focus-visible 和 halo 使用。',
    items: [
      ['color-link', '默认链接'],
      ['color-link-hover', '链接悬停'],
      ['color-link-active', '链接按下'],
      ['color-link-visited', 'visited'],
      ['color-focus-ring', 'focus ring'],
      ['color-focus-shadow', 'focus halo'],
    ],
  },
  {
    title: 'Table States',
    description: '供表格 hover、selected、stripe、header 和 border 使用。',
    items: [
      ['color-table-row-hover', '行悬停'],
      ['color-table-row-selected', '行选中'],
      ['color-table-row-striped', '斑马纹'],
      ['color-table-border', '表格边框'],
      ['color-table-header-bg', '表头背景'],
    ],
  },
  {
    title: 'Status Badges',
    description: '供徽标、标签和轻量状态提示使用。',
    items: [
      ['color-status-processing-bg', '处理中背景'],
      ['color-status-processing-fg', '处理中前景'],
      ['color-status-success-bg', '成功背景'],
      ['color-status-success-fg', '成功前景'],
      ['color-status-warning-bg', '预警背景'],
      ['color-status-warning-fg', '预警前景'],
      ['color-status-error-bg', '错误背景'],
      ['color-status-error-fg', '错误前景'],
      ['color-status-default-bg', '默认背景'],
      ['color-status-default-fg', '默认前景'],
    ],
  },
] as const;

function tokenHsl(token: string) {
  return `hsl(var(--${token}))`;
}

function swatchStyle(token: string): CSSProperties {
  return {
    backgroundColor: tokenHsl(token),
  };
}

function outlineStyle(token: string): CSSProperties {
  return {
    borderColor: tokenHsl(token),
    color: tokenHsl(token),
  };
}

export default function TokensPreviewPage() {
  return (
    <div className="min-h-screen bg-[hsl(var(--color-bg-primary))] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-3xl border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] shadow-[var(--shadow-light)]">
          <div className="bg-gradient-to-r from-[hsl(var(--color-primary-bg))] via-[hsl(var(--color-bg-card))] to-[hsl(var(--color-purple-light))] px-6 py-8">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--color-text-tertiary))]">
              <span className="rounded-full border border-[hsl(var(--color-primary-border))] bg-[hsl(var(--color-primary-bg))] px-3 py-1 text-[hsl(var(--color-primary))]">
                P1-6
              </span>
              <span>Design Tokens Preview</span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[hsl(var(--color-text-primary))]">
              7 色 x 10 阶 + 全语义状态
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[hsl(var(--color-text-secondary))] sm:text-base">
              这一页只预览新增 token，不要求组件立刻切换。我们可以先在这里确认色阶、状态和旧别名映射稳定，再让后续的
              `P1-7 / P1-9 / P1-12` 逐步接入。
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-6 shadow-[var(--shadow-light)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-[hsl(var(--color-text-primary))]">
                Color Scale Matrix
              </h2>
              <p className="mt-1 text-sm text-[hsl(var(--color-text-secondary))]">
                每一行是一套完整的 `1~10` 色阶，移动端可横向滑动查看。
              </p>
            </div>
            <div className="rounded-full border border-[hsl(var(--color-border-secondary))] px-3 py-1 text-xs font-medium text-[hsl(var(--color-text-secondary))]">
              70 swatches
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-5">
            {paletteGroups.map(group => (
              <div
                key={group.prefix}
                className="rounded-2xl border border-[hsl(var(--color-border-primary))] p-4"
              >
                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-[hsl(var(--color-text-primary))]">
                      {group.label}
                    </h3>
                    <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                      {group.description}
                    </p>
                  </div>
                  <code className="text-xs text-[hsl(var(--color-text-tertiary))]">
                    --{group.prefix}-1 ~ --{group.prefix}-10
                  </code>
                </div>

                <div className="overflow-x-auto pb-2">
                  <div className="grid min-w-[860px] grid-cols-10 gap-3">
                    {paletteSteps.map(step => {
                      const token = `${group.prefix}-${step}`;

                      return (
                        <div key={token} className="space-y-2">
                          <div
                            className="h-24 rounded-2xl border border-black/5 shadow-sm"
                            style={swatchStyle(token)}
                          />
                          <div className="space-y-1">
                            <div className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                              {step}
                            </div>
                            <code className="block text-xs text-[hsl(var(--color-text-tertiary))]">
                              --{token}
                            </code>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-6 shadow-[var(--shadow-light)]">
            <h2 className="text-xl font-semibold text-[hsl(var(--color-text-primary))]">
              Semantic Tokens
            </h2>
            <p className="mt-1 text-sm text-[hsl(var(--color-text-secondary))]">
              新增语义层主要覆盖 primary 状态、表格状态、链接/focus 和徽标状态。
            </p>

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              {semanticSections.map(section => (
                <div
                  key={section.title}
                  className="rounded-2xl border border-[hsl(var(--color-border-primary))] p-4"
                >
                  <h3 className="text-base font-semibold text-[hsl(var(--color-text-primary))]">
                    {section.title}
                  </h3>
                  <p className="mt-1 text-sm text-[hsl(var(--color-text-secondary))]">
                    {section.description}
                  </p>

                  <div className="mt-4 space-y-3">
                    {section.items.map(([token, label]) => (
                      <div
                        key={token}
                        className="flex items-center gap-3 rounded-xl border border-[hsl(var(--color-border-primary))] p-3"
                      >
                        <div
                          className="h-10 w-10 shrink-0 rounded-xl border border-black/5 shadow-sm"
                          style={swatchStyle(token)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                            {label}
                          </div>
                          <code className="block truncate text-xs text-[hsl(var(--color-text-tertiary))]">
                            --{token}
                          </code>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <section className="rounded-3xl border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-6 shadow-[var(--shadow-light)]">
              <h2 className="text-xl font-semibold text-[hsl(var(--color-text-primary))]">
                Legacy Aliases
              </h2>
              <p className="mt-1 text-sm text-[hsl(var(--color-text-secondary))]">
                旧 token 继续可用，保证现有页面不需要立刻改引用。
              </p>

              <div className="mt-4 space-y-2">
                {legacyAliases.map(([legacyToken, newToken]) => (
                  <div
                    key={legacyToken}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-[hsl(var(--color-border-primary))] px-4 py-3 text-sm"
                  >
                    <code className="text-[hsl(var(--color-text-primary))]">
                      --{legacyToken}
                    </code>
                    <span className="text-[hsl(var(--color-text-tertiary))]">
                      -&gt;
                    </span>
                    <code className="text-[hsl(var(--color-text-secondary))]">
                      --{newToken}
                    </code>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-6 shadow-[var(--shadow-light)]">
              <h2 className="text-xl font-semibold text-[hsl(var(--color-text-primary))]">
                Quick Samples
              </h2>
              <p className="mt-1 text-sm text-[hsl(var(--color-text-secondary))]">
                用实际组合看一眼链接、标签和 focus 基础表现。
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <span className="rounded-full px-3 py-1.5 text-sm font-semibold text-[hsl(var(--color-status-processing-fg))]" style={swatchStyle('color-status-processing-bg')}>
                  处理中
                </span>
                <span className="rounded-full px-3 py-1.5 text-sm font-semibold text-[hsl(var(--color-status-success-fg))]" style={swatchStyle('color-status-success-bg')}>
                  已完成
                </span>
                <span className="rounded-full px-3 py-1.5 text-sm font-semibold text-[hsl(var(--color-status-warning-fg))]" style={swatchStyle('color-status-warning-bg')}>
                  待处理
                </span>
                <span className="rounded-full px-3 py-1.5 text-sm font-semibold text-[hsl(var(--color-status-error-fg))]" style={swatchStyle('color-status-error-bg')}>
                  已逾期
                </span>
              </div>

              <div className="mt-6 space-y-4">
                <a
                  href="#token-link"
                  className="inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition-colors"
                  style={outlineStyle('color-link')}
                >
                  预览链接色
                </a>

                <div className="rounded-2xl border border-[hsl(var(--color-table-border))]">
                  <div
                    className="border-b border-[hsl(var(--color-table-border))] px-4 py-3 text-sm font-medium text-[hsl(var(--color-text-primary))]"
                    style={swatchStyle('color-table-header-bg')}
                  >
                    表头背景
                  </div>
                  <div
                    className="border-b border-[hsl(var(--color-table-border))] px-4 py-3 text-sm text-[hsl(var(--color-text-secondary))]"
                    style={swatchStyle('color-table-row-hover')}
                  >
                    行悬停
                  </div>
                  <div
                    className="px-4 py-3 text-sm text-[hsl(var(--color-text-secondary))]"
                    style={swatchStyle('color-table-row-selected')}
                  >
                    行选中
                  </div>
                </div>

                <div className="rounded-2xl border border-[hsl(var(--color-border-primary))] p-4">
                  <div className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                    Focus preview
                  </div>
                  <div
                    className="mt-3 rounded-xl border px-4 py-3 text-sm text-[hsl(var(--color-text-secondary))]"
                    style={{
                      borderColor: tokenHsl('color-focus-ring'),
                      boxShadow: `0 0 0 4px ${tokenHsl('color-focus-shadow')}`,
                    }}
                  >
                    `--color-focus-ring` + `--color-focus-shadow`
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
