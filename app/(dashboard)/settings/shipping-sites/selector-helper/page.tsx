/**
 * CSS 选择器智能助手
 * 帮助用户从 HTML 代码自动生成 CSS 选择器
 */

'use client';

import { ArrowLeft, Copy, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';

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
    <div className="container mx-auto space-y-6 p-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            CSS 选择器智能助手
          </h1>
          <p className="text-sm text-gray-600">
            粘贴 HTML 代码，自动生成 CSS 选择器配置
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 左侧：HTML 输入 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              步骤 1: 粘贴 HTML 代码
            </CardTitle>
            <CardDescription>
              在浏览器中右键点击船舶信息区域，选择&ldquo;检查&rdquo;，复制 HTML
              代码并粘贴到下方
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 选择器类型选择 */}
            <div>
              <Label>选择器类型</Label>
              <div className="mt-2 flex gap-2">
                <Button
                  variant={selectorType === 'both' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectorType('both')}
                >
                  全部
                </Button>
                <Button
                  variant={selectorType === 'xpath' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectorType('xpath')}
                >
                  XPath（推荐）
                </Button>
                <Button
                  variant={selectorType === 'css' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectorType('css')}
                >
                  CSS
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                XPath 支持 contains() 函数，更适合多 class 场景
              </p>
            </div>

            <div>
              <Label htmlFor="htmlInput">HTML 代码</Label>
              <Textarea
                id="htmlInput"
                value={htmlInput}
                onChange={e => setHtmlInput(e.target.value)}
                placeholder='粘贴 HTML 代码，例如：
<li class="flex-in flex-c">
  <span title="状态">状态</span>：
  <span class="ship-mmsi text-over-hide copy">用主机航行</span>
</li>'
                className="mt-2 min-h-[300px] font-mono text-xs"
              />
            </div>

            <Button
              onClick={analyzeHTML}
              disabled={isAnalyzing || !htmlInput.trim()}
              className="w-full"
            >
              {isAnalyzing ? '分析中...' : '🔍 智能分析'}
            </Button>
          </CardContent>
        </Card>

        {/* 右侧：检测结果 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>步骤 2: 检测结果</span>
              {detectedFields.length > 0 && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyAsJSON}>
                    <Copy className="mr-2 h-4 w-4" />
                    复制 JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyAllSelectors}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    复制推荐
                  </Button>
                </div>
              )}
            </CardTitle>
            <CardDescription>
              检测到的字段和多种选择器方案（推荐方案已标记 ⭐）
            </CardDescription>
          </CardHeader>
          <CardContent>
            {detectedFields.length === 0 ? (
              <div className="flex min-h-[400px] items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
                <p className="text-sm text-gray-500">
                  粘贴 HTML 代码后点击&ldquo;智能分析&rdquo;
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {detectedFields.map((field, fieldIndex) => (
                  <div
                    key={fieldIndex}
                    className="rounded-lg border bg-white p-4 shadow-sm"
                  >
                    {/* 字段标题和值 */}
                    <div className="mb-3 flex items-center justify-between border-b pb-2">
                      <div>
                        <span className="font-semibold text-gray-900">
                          {field.label}
                        </span>
                        <span className="ml-2 text-sm text-gray-600">
                          值: <span className="font-medium">{field.value}</span>
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {field.options.length} 个方案
                      </span>
                    </div>

                    {/* 选择器选项列表 */}
                    <div className="space-y-2">
                      {field.options.map((option, optIndex) => {
                        const isRecommended =
                          option.selector === field.recommended.selector;
                        return (
                          <div
                            key={optIndex}
                            className={`rounded-lg border p-3 ${
                              isRecommended
                                ? 'border-blue-300 bg-blue-50'
                                : 'border-gray-200 bg-gray-50'
                            }`}
                          >
                            {/* 选择器头部 */}
                            <div className="mb-2 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {isRecommended && (
                                  <span className="text-sm">⭐</span>
                                )}
                                <span
                                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                                    option.type === 'xpath'
                                      ? 'bg-purple-100 text-purple-700'
                                      : 'bg-green-100 text-green-700'
                                  }`}
                                >
                                  {option.type.toUpperCase()}
                                </span>
                                <span
                                  className={`rounded px-2 py-0.5 text-xs ${
                                    option.confidence === 'high'
                                      ? 'bg-green-100 text-green-700'
                                      : option.confidence === 'medium'
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {option.confidence === 'high'
                                    ? '高可信度'
                                    : option.confidence === 'medium'
                                      ? '中可信度'
                                      : '低可信度'}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  copySelector(option.selector, option.type)
                                }
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>

                            {/* 选择器代码 */}
                            <code className="block rounded bg-white px-2 py-1.5 font-mono text-xs">
                              {option.selector}
                            </code>

                            {/* 推荐理由 */}
                            <p className="mt-2 text-xs text-gray-600">
                              💡 {option.reason}
                            </p>

                            {/* 优缺点（可折叠） */}
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs font-medium text-gray-700">
                                查看优缺点
                              </summary>
                              <div className="mt-2 space-y-1 text-xs">
                                <div>
                                  <span className="font-medium text-green-700">
                                    ✓ 优点:
                                  </span>
                                  <ul className="ml-4 list-disc text-gray-600">
                                    {option.pros.map((pro, i) => (
                                      <li key={i}>{pro}</li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <span className="font-medium text-red-700">
                                    ✗ 缺点:
                                  </span>
                                  <ul className="ml-4 list-disc text-gray-600">
                                    {option.cons.map((con, i) => (
                                      <li key={i}>{con}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </details>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 步骤说明 */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                1
              </div>
              <h3 className="mb-1 font-medium">获取 HTML 代码</h3>
              <p className="text-sm text-gray-600">
                在船舶信息页面，右键点击信息区域，选择&ldquo;检查&rdquo;，复制
                HTML 代码
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                2
              </div>
              <h3 className="mb-1 font-medium">智能分析</h3>
              <p className="text-sm text-gray-600">
                选择选择器类型，粘贴代码后点击&ldquo;智能分析&rdquo;，系统自动生成多种方案
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                3
              </div>
              <h3 className="mb-1 font-medium">选择复制</h3>
              <p className="text-sm text-gray-600">
                查看各方案的优缺点，选择最适合的选择器复制使用
              </p>
            </div>
          </div>

          {/* 选择器类型说明 */}
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
            <h3 className="mb-2 font-semibold text-purple-900">
              💡 选择器类型对比
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-purple-800">
                  XPath（推荐）:
                </span>
                <ul className="mt-1 ml-4 list-disc text-purple-700">
                  <li>
                    支持{' '}
                    <code className="rounded bg-purple-100 px-1">
                      contains()
                    </code>{' '}
                    函数，能匹配多个 class
                  </li>
                  <li>
                    适用于复杂场景，如{' '}
                    <code className="rounded bg-purple-100 px-1">
                      class=&quot;ship-mmsi text-over-hide copy&quot;
                    </code>
                  </li>
                  <li>稳定性好，不受 class 顺序影响</li>
                </ul>
              </div>
              <div>
                <span className="font-medium text-green-800">CSS:</span>
                <ul className="mt-1 ml-4 list-disc text-green-700">
                  <li>语法简洁，易于理解</li>
                  <li>ID 和 name 选择器性能最好</li>
                  <li>
                    属性选择器{' '}
                    <code className="rounded bg-green-100 px-1">
                      [class*=&quot;xxx&quot;]
                    </code>{' '}
                    可部分匹配
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* 实际案例 */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h3 className="mb-2 font-semibold text-amber-900">
              📌 实际案例：ships66.com
            </h3>
            <div className="space-y-2 text-sm text-amber-800">
              <p>
                <strong>HTML 结构：</strong>
              </p>
              <code className="block rounded bg-white p-2 font-mono text-xs">
                {`<li class="flex-in flex-c">
  <span title="状态">状态</span>：
  <span class="ship-mmsi text-over-hide copy">用主机航行</span>
</li>`}
              </code>
              <p className="mt-2">
                <strong>推荐选择器（XPath）：</strong>
              </p>
              <code className="block rounded bg-white p-2 font-mono text-xs">
                {`.//li[.//span[@title='状态']]/span[contains(@class, 'ship-mmsi')]`}
              </code>
              <p className="mt-2 text-xs">
                ✓ 使用 contains() 匹配主 class，即使元素有多个 class
                也能正确匹配
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
