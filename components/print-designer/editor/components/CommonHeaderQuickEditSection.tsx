'use client';

import { Building2, ExternalLink, LocateFixed, Type } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PrintCompanyProfile } from '@/lib/print-designer/company-profile';
import type {
  DesignElement,
  PlaceholderElement,
  TextElement,
} from '@/lib/print-designer/schemas';
import { cn } from '@/lib/utils';

import { useDesignerStore } from '../stores';

import { FieldPicker } from './FieldPicker';

const EMPTY_ELEMENTS: DesignElement[] = [];

interface CommonHeaderQuickEditSectionProps {
  companyProfile?: PrintCompanyProfile | null;
}

function formatElementLocation(element: DesignElement) {
  return `X ${element.position.x.toFixed(1)} / Y ${element.position.y.toFixed(1)}`;
}

function findTitleElement(elements: DesignElement[]): TextElement | null {
  const textElements = elements.filter(
    element => element.type === 'text'
  ) as TextElement[];

  if (textElements.length === 0) {
    return null;
  }

  const scoredElements = textElements.map(element => {
    let score = 0;
    const content = element.content.trim();

    if (element.position.y <= 24) score += 4;
    if (element.style.textAlign === 'center') score += 5;
    if (element.style.fontWeight === 'bold') score += 3;
    if (element.style.fontSize >= 16) score += 5;
    if (element.size.width >= 50) score += 2;
    if (element.position.x >= 40) score += 1;
    if (/单|订单|发货|入库|出库|退货|报告/.test(content)) score += 6;
    if (content.length > 0 && content.length <= 24) score += 2;

    return { element, score };
  });

  const bestMatch = scoredElements.sort((a, b) => b.score - a.score)[0];
  return bestMatch && bestMatch.score >= 6 ? bestMatch.element : null;
}

function findCompanyNameElement(
  elements: DesignElement[]
): PlaceholderElement | null {
  const placeholders = elements.filter(
    element => element.type === 'placeholder'
  ) as PlaceholderElement[];

  const exactMatch = placeholders.find(
    element => element.field === 'company.name'
  );
  if (exactMatch) {
    return exactMatch;
  }

  const scoredElements = placeholders.map(element => {
    let score = 0;

    if (element.field.startsWith('company.')) score += 6;
    if (element.label.includes('公司')) score += 4;
    if (element.field.includes('name')) score += 2;
    if (element.position.x <= 30) score += 2;
    if (element.position.y <= 20) score += 2;
    if (element.style.fontWeight === 'bold') score += 1;

    return { element, score };
  });

  const bestMatch = scoredElements.sort((a, b) => b.score - a.score)[0];
  return bestMatch && bestMatch.score >= 6 ? bestMatch.element : null;
}

export function CommonHeaderQuickEditSection({
  companyProfile,
}: CommonHeaderQuickEditSectionProps) {
  const router = useRouter();
  const template = useDesignerStore(s => s.template);
  const selectElement = useDesignerStore(s => s.selectElement);
  const updateElement = useDesignerStore(s => s.updateElement);

  const elements = template?.elements ?? EMPTY_ELEMENTS;
  const templateType = template?.type ?? 'sales-order';
  const titleElement = useMemo(() => findTitleElement(elements), [elements]);
  const companyNameElement = useMemo(
    () => findCompanyNameElement(elements),
    [elements]
  );

  const companyNameValue =
    companyProfile === undefined
      ? '正在读取系统公司信息...'
      : companyProfile === null
        ? '未读取到系统公司名称'
        : companyProfile.name?.trim() || '未设置公司名称';

  if (!template) {
    return null;
  }

  return (
    <section
      className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-stone-50 p-3"
      data-testid="common-header-quick-edit"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-stone-900">
            常用抬头快捷编辑
          </h4>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div className="rounded-lg border border-stone-200 bg-white/90 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-stone-700">
            <Type className="h-3.5 w-3.5" />
            单据标题
          </div>
          <div className="mt-2 space-y-2">
            <Label
              htmlFor="quick-edit-title"
              className="text-xs text-stone-600"
            >
              标题内容
            </Label>
            <Input
              id="quick-edit-title"
              value={titleElement?.content ?? ''}
              onChange={event => {
                if (!titleElement) {
                  return;
                }

                updateElement(titleElement.id, {
                  content: event.target.value,
                });
              }}
              placeholder="当前模板未识别到标题元素"
              disabled={!titleElement}
              className="h-9"
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-stone-500">
                {titleElement
                  ? `已定位顶部标题文本，位置 ${formatElementLocation(titleElement)}`
                  : '未识别到主标题。'}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0"
                onClick={() => titleElement && selectElement(titleElement.id)}
                disabled={!titleElement}
              >
                <LocateFixed className="h-3.5 w-3.5" />
                定位标题
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white/90 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-stone-700">
            <Building2 className="h-3.5 w-3.5" />
            公司名称
          </div>
          <div className="mt-2 space-y-2">
            <Label
              htmlFor="quick-edit-company-name"
              className="text-xs text-stone-600"
            >
              系统公司名称
            </Label>
            <Input
              id="quick-edit-company-name"
              value={companyNameValue}
              readOnly
              className={cn(
                'h-9',
                companyProfile === undefined && 'text-stone-500'
              )}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => router.push('/settings/basic')}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                前往基本设置
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() =>
                  companyNameElement && selectElement(companyNameElement.id)
                }
                disabled={!companyNameElement}
              >
                <LocateFixed className="h-3.5 w-3.5" />
                定位公司名称字段
              </Button>
              {companyNameElement ? (
                <FieldPicker
                  templateType={templateType}
                  currentField={companyNameElement.field}
                  onSelect={field =>
                    updateElement(companyNameElement.id, {
                      field: field.path,
                      label: field.label,
                    })
                  }
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                  >
                    更换绑定字段
                  </Button>
                </FieldPicker>
              ) : null}
            </div>
            <p className="text-[11px] text-stone-500">
              {companyNameElement
                ? `当前绑定字段：${companyNameElement.field}，位置 ${formatElementLocation(companyNameElement)}`
                : '未识别到公司名称字段。'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
