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
        reason: 'ID 选择器最简洁且唯一',
        pros: ['最简洁', '性能最好', '唯一性强'],
        cons: ['依赖元素有 ID 属性'],
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
          title: '未检测到字段',
          description: '请确保 HTML 代码包含船舶状态信息',
          variant: 'destructive',
        });
      } else {
        toast({
          title: '分析完成',
          description: `检测到 ${fields.length} 个字段`,
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
      description: `${type.toUpperCase()} 选择器已复制到剪贴板`,
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
      title: '已复制所有推荐选择器',
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
      title: '已复制 JSON 格式',
      description: '可以直接粘贴到 extract_selectors 字段',
      variant: 'success',
    });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="flex-1 space-y-6 overflow-y-auto">
        {/* 页面头部 */}
        <div className="group relative overflow-hidden rounded-[32px] border border-white bg-white/60 p-1 shadow-xl shadow-slate-200/50 backdrop-blur-xl transition-all duration-500 hover:shadow-2xl hover:shadow-slate-300/40">
          <div className="flex items-center justify-between rounded-[28px] bg-white/80 p-8 shadow-inner backdrop-blur-md">
            <div className="flex items-center gap-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="h-12 w-12 rounded-2xl bg-slate-50 text-slate-500 transition-all hover:bg-slate-100 active:scale-95"
              >
                <ArrowLeft className="h-6 w-6" />
              </Button>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">
                  CSS 选择器智能助手
                </h1>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  粘贴 HTML 代码，自动生成符合 v3 标准的 CSS/XPath 选择器配置
                </p>
              </div>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg shadow-indigo-600/30 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
          </div>
          {/* 装饰性背景层 */}
          <div className="absolute -bottom-4 -left-4 h-24 w-24 rounded-full bg-indigo-500 opacity-5 blur-3xl" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 左侧：HTML 输入 */}
          <div className="rounded-[32px] border border-white bg-white/60 p-8 shadow-xl shadow-slate-200/50 backdrop-blur-xl transition-all hover:shadow-2xl hover:shadow-slate-300/40">
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-black tracking-tight text-slate-900">
                  步骤 1: 粘贴 HTML 源码
                </h3>
              </div>
              <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                步骤 01 / 输入
              </span>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-xs font-black tracking-widest text-slate-500 uppercase">
                  解析目标类型
                </Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'both', label: '全部格式', icon: '🌐' },
                    { id: 'xpath', label: 'XPath (推荐)', icon: '🧭' },
                    { id: 'css', label: 'CSS 选择器', icon: '🎨' },
                  ].map(type => (
                    <Button
                      key={type.id}
                      variant={selectorType === type.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectorType(type.id as any)}
                      className={cn(
                        'h-10 rounded-xl px-4 font-bold transition-all active:scale-95',
                        selectorType === type.id
                          ? 'bg-slate-900 shadow-lg shadow-slate-900/20'
                          : 'border-slate-100 bg-white text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      <span className="mr-2 text-sm">{type.icon}</span>
                      {type.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="htmlInput"
                    className="text-xs font-black tracking-widest text-slate-500 uppercase"
                  >
                    HTML 代码块
                  </Label>
                  <span className="text-[10px] font-bold text-slate-400">
                    建议复制包含 label 和 value 的完整父节点
                  </span>
                </div>
                <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-900/5 transition-all focus-within:ring-2 focus-within:ring-blue-500/20">
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
                className="h-14 w-full rounded-2xl bg-blue-600 font-black tracking-widest shadow-xl shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:bg-slate-200"
              >
                {isAnalyzing ? (
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    <span>正在深度分析 HTML 结构...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>🔍 执行智能分析检测</span>
                  </div>
                )}
              </Button>
            </div>
          </div>

          {/* 右侧：检测结果 */}
          <div className="flex flex-col rounded-[32px] border border-white bg-white/60 p-8 shadow-xl shadow-slate-200/50 backdrop-blur-xl transition-all hover:shadow-2xl hover:shadow-slate-300/40">
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <div className="h-5 w-5">⭐</div>
                </div>
                <h3 className="text-lg font-black tracking-tight text-slate-900">
                  步骤 2: 提取分析结果
                </h3>
              </div>
              {detectedFields.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyAsJSON}
                    className="h-9 rounded-xl border-slate-100 bg-white font-black text-slate-600 shadow-sm transition-all hover:bg-slate-50 active:scale-95"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyAllSelectors}
                    className="h-9 rounded-xl border-slate-100 bg-white font-black text-slate-600 shadow-sm transition-all hover:bg-slate-50 active:scale-95"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    全选
                  </Button>
                </div>
              )}
            </div>
            <div className="custom-scrollbar flex-1 overflow-y-auto pr-2">
              {detectedFields.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
                  <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-lg">
                    <Globe className="h-10 w-10 text-slate-200" />
                  </div>
                  <h4 className="text-sm font-black text-slate-400">
                    暂无分析数据
                  </h4>
                  <p className="mt-2 max-w-[200px] text-xs font-bold text-slate-400">
                    请在左侧区域粘贴 HTML 源码并点击执行分析
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {detectedFields.map((field, fieldIndex) => (
                    <div
                      key={fieldIndex}
                      className="group rounded-[24px] border border-white bg-white/80 p-6 shadow-sm shadow-slate-200/50 transition-all hover:bg-white hover:shadow-md"
                    >
                      {/* 字段标题和值 */}
                      <div className="mb-4 flex items-center justify-between border-b border-slate-50 pb-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-900 transition-colors group-hover:text-blue-600">
                              {field.label}
                            </span>
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">
                              {field.options.length} OPTIONS
                            </span>
                          </div>
                          <p className="text-xs font-bold text-slate-400">
                            Detected Value:{' '}
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
                                'relative rounded-2xl border p-4 transition-all',
                                isRecommended
                                  ? 'border-blue-100 bg-blue-50/50 ring-1 ring-blue-50'
                                  : 'border-slate-50 bg-slate-50/30 hover:border-slate-200 hover:bg-white'
                              )}
                            >
                              {/* 选择器头部 */}
                              <div className="mb-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {isRecommended && (
                                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white shadow-lg shadow-blue-600/30">
                                      ⭐
                                    </div>
                                  )}
                                  <span
                                    className={cn(
                                      'rounded-lg px-2 py-1 text-[10px] font-black tracking-widest outline outline-1',
                                      option.type === 'xpath'
                                        ? 'bg-purple-50 text-purple-600 outline-purple-100'
                                        : 'bg-emerald-50 text-emerald-600 outline-emerald-100'
                                    )}
                                  >
                                    {option.type.toUpperCase()}
                                  </span>
                                  <div
                                    className={cn(
                                      'flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black tracking-widest uppercase',
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
                                      ? 'High'
                                      : option.confidence === 'medium'
                                        ? 'Medium'
                                        : 'Low'}
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
                              <div className="rounded-xl bg-slate-900 p-3 shadow-inner">
                                <code className="block font-mono text-[11px] leading-relaxed font-bold break-all text-emerald-400/90">
                                  {option.selector}
                                </code>
                              </div>

                              {/* 推荐理由 */}
                              <div className="mt-3 flex items-start gap-2">
                                <div className="mt-0.5 text-blue-500">💡</div>
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

        {/* 使用说明 */}
        <div className="rounded-[32px] border border-white bg-slate-900 p-8 shadow-2xl transition-transform hover:scale-[1.01]">
          <div className="mb-8 border-b border-slate-800 pb-6 text-center">
            <h2 className="mb-2 text-xl font-black tracking-tight text-white">
              配置使用指南
            </h2>
            <p className="text-center text-sm font-bold tracking-widest text-slate-500 uppercase">
              接入流程
            </p>
          </div>

          <div className="space-y-12">
            {/* 步骤说明 */}
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  num: '01',
                  title: '获取 HTML 源代码',
                  desc: '在目标页面按下 F12 检查元素，右键对应的配置区域选择 "Copy outerHTML"。',
                  color: 'bg-blue-500',
                },
                {
                  num: '02',
                  title: '执行深度分析',
                  desc: '将代码片段粘贴到上方输入框，系统将根据特征库智能解析字段级联关系。',
                  color: 'bg-indigo-500',
                },
                {
                  num: '03',
                  title: '一键应用配置',
                  desc: '点击 ⭐ 标记的推荐方案，直接粘贴到主站点的“提取映射表”中即可生效。',
                  color: 'bg-purple-500',
                },
              ].map(step => (
                <div
                  key={step.num}
                  className="group relative rounded-2xl border border-white/5 bg-white/5 p-6 transition-all hover:bg-white/10"
                >
                  <div
                    className={cn(
                      'mb-4 inline-flex items-center justify-center rounded-xl px-3 py-1 text-xs font-black text-white shadow-lg',
                      step.color
                    )}
                  >
                    STEP {step.num}
                  </div>
                  <h3 className="mb-2 text-sm font-black text-white">
                    {step.title}
                  </h3>
                  <p className="text-xs leading-relaxed font-bold text-slate-500">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* 选择器类型说明 */}
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-black text-amber-500">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                  技术方案选择指南
                </h3>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-black tracking-widest text-amber-600/80 uppercase">
                      XPath 路径（推荐）
                    </span>
                    <p className="text-xs leading-relaxed font-bold text-amber-100/80">
                      支持 `contains()`
                      模糊匹配。即使样式类名随机或包含空格，也能通过文本特征定位。
                    </p>
                  </div>
                  <div className="space-y-1 border-t border-amber-500/10 pt-4">
                    <span className="text-[11px] font-black tracking-widest text-emerald-600/80 uppercase">
                      CSS 选择器
                    </span>
                    <p className="text-xs leading-relaxed font-bold text-emerald-100/80">
                      运行效率极高。在有 ID 或稳定属性值的简单页面中是最佳选择。
                    </p>
                  </div>
                </div>
              </div>

              {/* 实际案例 */}
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-black text-blue-500">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                  智能提取案例展示
                </h3>
                <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                  <code className="block space-y-1 font-mono text-[10px]">
                    <div className="text-slate-500 opacity-50">
                      &lt;!-- 输入 --&gt;
                    </div>
                    <div className="text-slate-300">
                      &lt;span title=&quot;状态&quot;&gt;航行中&lt;/span&gt;
                    </div>
                    <div className="mt-2 text-slate-500 opacity-50">
                      &lt;!-- 结果 --&gt;
                    </div>
                    <div className="font-bold text-emerald-400">
                      .//span[@title=&apos;状态&apos;]
                    </div>
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
