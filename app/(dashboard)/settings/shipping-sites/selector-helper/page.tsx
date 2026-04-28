'use client';

import { ArrowLeft, Copy, Globe, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface SelectorOption {
  selector: string;
  type: 'css' | 'xpath';
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  pros: string[];
  cons: string[];
}

interface DetectedField {
  label: string;
  value: string;
  options: SelectorOption[];
  recommended: SelectorOption;
}

export default function SelectorHelperPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [htmlInput, setHtmlInput] = React.useState('');
  const [detectedFields, setDetectedFields] = React.useState<DetectedField[]>(
    []
  );
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [selectorType, setSelectorType] = React.useState<
    'css' | 'xpath' | 'both'
  >('both');

  // 生成选择器选项
  const generateSelectorOptions = (
    element: Element,
    valueElement: Element,
    title: string
  ): SelectorOption[] => {
    const options: SelectorOption[] = [];
    const valueClasses = Array.from(valueElement.classList);
    const valueId = valueElement.id;
    const valueName = valueElement.getAttribute('name');

    // XPath 选项 1: 使用 contains() 匹配多个 class（推荐）
    if (valueClasses.length > 0) {
      const mainClass = valueClasses[0];
      const xpath = `.//li[.//span[@title='${title}']]/span[contains(@class, '${mainClass}')]`;
      options.push({
        selector: xpath,
        type: 'xpath',
        confidence: 'high',
        reason: '使用 contains() 函数，能够匹配包含多个 class 的元素',
        pros: [
          '兼容性强：即使元素有多个 class 也能匹配',
          '稳定性好：不受 class 顺序影响',
          '推荐用于动态 class 场景',
        ],
        cons: ['XPath 语法相对复杂', '部分旧浏览器支持有限'],
      });
    }

    // XPath 选项 2: 精确匹配 class（不推荐多 class 场景）
    if (valueClasses.length === 1) {
      const xpath = `.//li[.//span[@title='${title}']]/span[@class='${valueClasses[0]}']`;
      options.push({
        selector: xpath,
        type: 'xpath',
        confidence: 'medium',
        reason: '精确匹配单个 class',
        pros: ['语法简单', '匹配精确'],
        cons: ['不适用于多 class 场景', '如果元素添加新 class 会失效'],
      });
    }

    // CSS 选项 1: 使用 ID（如果有）
    if (valueId) {
      options.push({
        selector: `#${valueId}`,
        type: 'css',
        confidence: 'high',
        reason: '编号选择最简洁且唯一',
        pros: ['最简洁', '性能最好', '唯一性强'],
        cons: ['依赖元素带有唯一编号'],
      });
    }

    // CSS 选项 2: 使用 name 属性（如果有）
    if (valueName) {
      options.push({
        selector: `[name='${valueName}']`,
        type: 'css',
        confidence: 'high',
        reason: 'name 属性通常稳定',
        pros: ['语法简单', '属性相对稳定'],
        cons: ['需要元素有 name 属性'],
      });
    }

    // CSS 选项 3: 使用 :has() 伪类（现代浏览器）
    if (valueClasses.length > 0) {
      const classSelector = valueClasses.map(c => `.${c}`).join('');
      options.push({
        selector: `li:has(span[title="${title}"]) span${classSelector}`,
        type: 'css',
        confidence: 'medium',
        reason: '使用 :has() 伪类（CSS4）',
        pros: ['CSS 原生语法', '可读性好'],
        cons: [
          '需要现代浏览器支持',
          '多 class 时选择器较长',
          '如果 class 顺序变化可能失效',
        ],
      });
    }

    // CSS 选项 4: 使用属性选择器匹配部分 class
    if (valueClasses.length > 0) {
      const mainClass = valueClasses[0];
      options.push({
        selector: `li:has(span[title="${title}"]) span[class*="${mainClass}"]`,
        type: 'css',
        confidence: 'medium',
        reason: '使用属性选择器部分匹配 class',
        pros: ['兼容多 class 场景', 'CSS 原生语法'],
        cons: ['可能匹配到不相关的元素', '性能略低于精确匹配'],
      });
    }

    return options;
  };

  // 分析 HTML 并生成选择器
  const analyzeHTML = () => {
    if (!htmlInput.trim()) {
      toast({
        title: '请输入 HTML 代码',
        description: '请粘贴包含船舶信息的 HTML 代码',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);

    try {
      // 创建临时 DOM 解析 HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlInput, 'text/html');

      const fields: DetectedField[] = [];

      // 常见字段关键词映射
      const fieldKeywords: Record<
        string,
        { keywords: string[]; field: string }
      > = {
        status: {
          keywords: ['状态', 'status', '航行状态'],
          field: '当前状态',
        },
        destination: {
          keywords: ['目的地', 'destination', '目的港', '到达港'],
          field: '目的地',
        },
        eta: {
          keywords: [
            '预到时间',
            '预计到达',
            'eta',
            'estimated arrival',
            '到港时间',
          ],
          field: '预计到达',
        },
        updateTime: {
          keywords: ['更新时间', '最后更新', 'update', 'last update'],
          field: '最后更新',
        },
      };

      // 查找所有可能的字段
      const allElements = doc.querySelectorAll('li, div, span, p');

      allElements.forEach(element => {
        const text = element.textContent?.trim() || '';
        const title = element.getAttribute('title') || '';

        // 检查是否包含字段关键词
        Object.entries(fieldKeywords).forEach(([_key, config]) => {
          const matchKeyword = config.keywords.find(
            keyword =>
              title.includes(keyword) ||
              text.toLowerCase().includes(keyword.toLowerCase())
          );

          if (matchKeyword) {
            // 尝试找到值元素
            let valueElement: Element | null = null;

            // 策略1: 优先查找有特定 class 的 span（如 ship-mmsi）
            if (element.tagName === 'SPAN' && title) {
              const parent = element.parentElement;

              // 优先查找常见的值元素 class
              const commonValueClasses = [
                'ship-mmsi',
                'value',
                'data-value',
                'info-value',
              ];
              for (const className of commonValueClasses) {
                valueElement =
                  parent?.querySelector(`span.${className}`) || null;
                if (valueElement) break;
              }

              // 如果没找到，使用通用逻辑：查找不是当前元素的 span，且不是冒号
              if (!valueElement) {
                const spans = parent?.querySelectorAll('span');
                if (spans && spans.length > 1) {
                  valueElement =
                    Array.from(spans).find(
                      s =>
                        s !== element &&
                        s.textContent?.trim() &&
                        s.textContent?.trim() !== '：' &&
                        s.textContent?.trim() !== ':'
                    ) || null;
                }
              }
            }

            // 策略2: 查找下一个兄弟元素（跳过文本节点和注释节点）
            if (!valueElement && element.nextElementSibling) {
              let sibling: Element | null = element.nextElementSibling;
              // 跳过冒号元素
              if (
                sibling &&
                (sibling.textContent?.trim() === '：' ||
                  sibling.textContent?.trim() === ':')
              ) {
                sibling = sibling.nextElementSibling;
              }
              if (sibling) {
                valueElement = sibling;
              }
            }

            // 策略3: 查找父元素中的最后一个 span
            if (!valueElement && element.parentElement) {
              const spans = element.parentElement.querySelectorAll('span');
              if (spans.length > 1) {
                valueElement = spans[spans.length - 1];
              }
            }

            if (valueElement && title) {
              const value = valueElement.textContent?.trim() || '';

              // 避免重复添加
              const exists = fields.some(
                f => f.label === config.field && f.value === value
              );

              if (!exists && value && value !== ':' && value !== '-') {
                // 生成多个选择器选项
                const options = generateSelectorOptions(
                  element,
                  valueElement,
                  title
                );

                // 根据用户选择的类型过滤选项
                const filteredOptions =
                  selectorType === 'both'
                    ? options
                    : options.filter(opt => opt.type === selectorType);

                if (filteredOptions.length > 0) {
                  // 推荐优先级：high confidence XPath > high confidence CSS > medium confidence
                  const recommended =
                    filteredOptions.find(
                      opt => opt.type === 'xpath' && opt.confidence === 'high'
                    ) ||
                    filteredOptions.find(opt => opt.confidence === 'high') ||
                    filteredOptions[0];

                  fields.push({
                    label: config.field,
                    value,
                    options: filteredOptions,
                    recommended,
                  });
                }
              }
            }
          }
        });
      });

      setDetectedFields(fields);

      if (fields.length === 0) {
        toast({
          title: '未识别到内容',
          description: '请确保 HTML 代码包含船舶状态信息',
          variant: 'destructive',
        });
      } else {
        toast({
          title: '分析完成',
          description: `识别到 ${fields.length} 项内容`,
          variant: 'success',
        });
      }
    } catch (_error) {
      toast({
        title: '分析失败',
        description: '请检查 HTML 代码格式是否正确',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 复制选择器
  const copySelector = (selector: string, type: string) => {
    navigator.clipboard.writeText(selector);
    toast({
      title: '已复制',
      description: `${type === 'xpath' ? 'XPath 规则' : 'CSS 规则'}已复制到剪贴板`,
      variant: 'success',
    });
  };

  // 复制所有推荐选择器
  const copyAllSelectors = () => {
    const text = detectedFields
      .map(f => `${f.label}: ${f.recommended.selector}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    toast({
      title: '已复制推荐规则',
      description: '可以粘贴到站点配置中',
      variant: 'success',
    });
  };

  // 复制为 JSON 格式（用于 extract_selectors 字段）
  const copyAsJSON = () => {
    const json: Record<string, string> = {};
    detectedFields.forEach(f => {
      const key =
        f.label === '当前状态'
          ? 'status'
          : f.label === '目的地'
            ? 'destination'
            : f.label === '预计到达'
              ? 'estimatedArrival'
              : 'updateTime';
      json[key] = f.recommended.selector;
    });
    navigator.clipboard.writeText(JSON.stringify(json, null, 2));
    toast({
      title: '已复制配置格式',
      description: '可以直接粘贴到站点配置里',
      variant: 'success',
    });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="flex-1 space-y-6 overflow-y-auto">
        {/* 页面头部 */}
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="h-10 w-10 rounded-md bg-slate-50 text-slate-500 hover:bg-slate-100"
              >
                <ArrowLeft className="h-6 w-6" />
              </Button>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                  识别规则设置
                </h1>
                <p className="mt-1 text-sm text-slate-500">物流结果识别</p>
              </div>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 左侧：HTML 输入 */}
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                  第一步：粘贴页面内容
                </h3>
              </div>
              <span className="text-[10px] font-semibold text-slate-400">
                输入
              </span>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-xs font-semibold text-slate-500">
                  规则类型
                </Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'both', label: '全部规则', icon: '' },
                    { id: 'xpath', label: '推荐规则', icon: '' },
                    { id: 'css', label: '备用规则', icon: '' },
                  ].map(type => (
                    <Button
                      key={type.id}
                      variant={selectorType === type.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectorType(type.id as any)}
                      className={cn(
                        'h-9 rounded-md px-3 font-medium',
                        selectorType === type.id
                          ? 'bg-slate-900 shadow-sm'
                          : 'border-slate-100 bg-white text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      {type.icon ? (
                        <span className="mr-2 text-sm">{type.icon}</span>
                      ) : null}
                      {type.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="htmlInput"
                    className="text-xs font-semibold text-slate-500"
                  >
                    页面内容片段
                  </Label>
                </div>
                <div className="relative overflow-hidden rounded-md border border-slate-100 bg-slate-900/5 focus-within:ring-2 focus-within:ring-blue-500/20">
                  <Textarea
                    id="htmlInput"
                    value={htmlInput}
                    onChange={e => setHtmlInput(e.target.value)}
                    placeholder='<li class="flex-in">
  <span title="状态">状态</span>：
  <span class="ship-mmsi">正在航行</span>
</li>'
                    className="min-h-[400px] resize-none border-none bg-transparent p-4 font-mono text-[11px] leading-relaxed text-slate-700 focus-visible:ring-0"
                  />
                  <div className="absolute top-4 right-4 h-2 w-2 animate-pulse rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                </div>
              </div>

              <Button
                onClick={analyzeHTML}
                disabled={isAnalyzing || !htmlInput.trim()}
                className="h-10 w-full rounded-md font-medium disabled:bg-slate-200"
              >
                {isAnalyzing ? (
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    <span>识别中...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>开始识别</span>
                  </div>
                )}
              </Button>
            </div>
          </div>

          {/* 右侧：检测结果 */}
          <div className="flex flex-col rounded-lg border bg-white p-5 shadow-sm">
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                  第二步：识别结果
                </h3>
              </div>
              {detectedFields.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyAsJSON}
                    className="h-9 rounded-md border-slate-100 bg-white font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    复制
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyAllSelectors}
                    className="h-9 rounded-md border-slate-100 bg-white font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    全部复制
                  </Button>
                </div>
              )}
            </div>
            <div className="custom-scrollbar flex-1 overflow-y-auto pr-2">
              {detectedFields.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center rounded-md border-2 border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
                  <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-md bg-white shadow-sm">
                    <Globe className="h-10 w-10 text-slate-200" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-400">
                    暂无识别结果
                  </h4>
                </div>
              ) : (
                <div className="space-y-6">
                  {detectedFields.map((field, fieldIndex) => (
                    <div
                      key={fieldIndex}
                      className="group rounded-md border border-slate-100 bg-white p-6 shadow-sm"
                    >
                      {/* 字段标题和值 */}
                      <div className="mb-4 flex items-center justify-between border-b border-slate-50 pb-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900 transition-colors group-hover:text-blue-600">
                              {field.label}
                            </span>
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                              {field.options.length} 种规则
                            </span>
                          </div>
                          <p className="text-xs font-bold text-slate-400">
                            识别内容：
                            <span className="text-slate-900">
                              {field.value}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* 选择器选项列表 */}
                      <div className="space-y-3">
                        {field.options.map((option, optIndex) => {
                          const isRecommended =
                            option.selector === field.recommended.selector;
                          return (
                            <div
                              key={optIndex}
                              className={cn(
                                'relative rounded-md border p-4',
                                isRecommended
                                  ? 'border-blue-100 bg-blue-50/50 ring-1 ring-blue-50'
                                  : 'border-slate-50 bg-slate-50/30 hover:border-slate-200 hover:bg-white'
                              )}
                            >
                              {/* 选择器头部 */}
                              <div className="mb-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {isRecommended && (
                                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-600 text-[10px] text-white shadow-sm">
                                      推荐
                                    </div>
                                  )}
                                  <span
                                    className={cn(
                                      'rounded-lg px-2 py-1 text-[10px] font-semibold outline outline-1',
                                      option.type === 'xpath'
                                        ? 'bg-purple-50 text-purple-600 outline-purple-100'
                                        : 'bg-emerald-50 text-emerald-600 outline-emerald-100'
                                    )}
                                  >
                                    {option.type.toUpperCase()}
                                  </span>
                                  <div
                                    className={cn(
                                      'flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold',
                                      option.confidence === 'high'
                                        ? 'text-emerald-600'
                                        : option.confidence === 'medium'
                                          ? 'text-amber-600'
                                          : 'text-rose-600'
                                    )}
                                  >
                                    <div
                                      className={cn(
                                        'h-1 w-1 rounded-full',
                                        option.confidence === 'high'
                                          ? 'bg-emerald-500'
                                          : option.confidence === 'medium'
                                            ? 'bg-amber-500'
                                            : 'bg-rose-500'
                                      )}
                                    />
                                    {option.confidence === 'high'
                                      ? '高'
                                      : option.confidence === 'medium'
                                        ? '中'
                                        : '低'}
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    copySelector(option.selector, option.type)
                                  }
                                  className="h-8 w-8 rounded-lg bg-white/50 text-slate-400 hover:text-slate-900"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              </div>

                              {/* 选择器代码 */}
                              <div className="rounded-md bg-slate-900 p-3 shadow-inner">
                                <code className="block font-mono text-[11px] leading-relaxed font-bold break-all text-emerald-400/90">
                                  {option.selector}
                                </code>
                              </div>

                              {/* 推荐理由 */}
                              <div className="mt-3 flex items-start gap-2">
                                <div className="mt-0.5 text-xs font-semibold text-blue-500">
                                  原因
                                </div>
                                <p className="text-[11px] leading-relaxed font-bold text-slate-500">
                                  {option.reason}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
