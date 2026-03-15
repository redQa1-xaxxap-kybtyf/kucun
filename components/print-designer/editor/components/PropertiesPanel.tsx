/**
 * 打印设计器 - 右侧属性面板
 */

'use client';

import { Settings } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  getPaperDimensions,
  type TableElement,
} from '@/lib/print-designer/schemas';

import {
  useDesignerStore,
  usePageSettings,
  useSelectedElement,
} from '../stores';

import { DataBindingSection } from './DataBindingSection';
import { TableColumnManager } from './TableColumnManager';
import { TableStyleSection } from './TableStyleSection';
import { TypographySection } from './TypographySection';

export function PropertiesPanel() {
  const selectedElement = useSelectedElement();
  const pageSettings = usePageSettings();
  const templateType = useDesignerStore(s => s.template?.type ?? 'sales-order');
  const updateElement = useDesignerStore(s => s.updateElement);
  const updatePageSettings = useDesignerStore(s => s.updatePageSettings);

  // 未选中元素时显示页面设置
  if (!selectedElement) {
    const currentOrientation = pageSettings?.orientation ?? 'portrait';
    const computedDimensions =
      pageSettings?.size === 'Custom' || !pageSettings
        ? {
            width: pageSettings?.width ?? 210,
            height: pageSettings?.height ?? 297,
          }
        : getPaperDimensions(pageSettings.size, currentOrientation);

    return (
      <aside className="flex w-72 flex-col border-l bg-white">
        <div className="border-b p-3">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Settings className="h-4 w-4" />
            页面设置
          </h3>
        </div>

        <div className="flex-1 overflow-auto p-3">
          <div className="space-y-4">
            {/* 纸张大小 */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">纸张大小</Label>
              <Select
                value={pageSettings?.size}
                onValueChange={v => {
                  if (!pageSettings) return;

                  const nextSize = v as 'A4' | 'A5' | 'Letter' | 'Custom';
                  if (nextSize === 'Custom') {
                    updatePageSettings({ size: 'Custom' });
                    return;
                  }

                  const dims = getPaperDimensions(nextSize, currentOrientation);
                  updatePageSettings({
                    size: nextSize,
                    width: dims.width,
                    height: dims.height,
                  });
                }}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A4">A4 (210×297mm)</SelectItem>
                  <SelectItem value="A5">A5 (148×210mm)</SelectItem>
                  <SelectItem value="Letter">信纸 (216×279mm)</SelectItem>
                  <SelectItem value="Custom">自定义</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-[11px]">
                当前尺寸：{computedDimensions.width} ×{' '}
                {computedDimensions.height} mm
              </p>
            </div>

            {/* 方向 */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">页面方向</Label>
              <Select
                value={pageSettings?.orientation}
                onValueChange={v => {
                  if (!pageSettings) return;

                  const nextOrientation = v as 'portrait' | 'landscape';

                  // 自定义尺寸：切换方向时交换宽高，做到“所见即所得”旋转
                  if (pageSettings.size === 'Custom') {
                    updatePageSettings({
                      orientation: nextOrientation,
                      width: pageSettings.height,
                      height: pageSettings.width,
                    });
                    return;
                  }

                  const dims = getPaperDimensions(
                    pageSettings.size,
                    nextOrientation
                  );
                  updatePageSettings({
                    orientation: nextOrientation,
                    width: dims.width,
                    height: dims.height,
                  });
                }}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">纵向</SelectItem>
                  <SelectItem value="landscape">横向</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 自定义尺寸 */}
            {pageSettings?.size === 'Custom' && (
              <div className="space-y-2">
                <Label className="text-xs font-medium">自定义尺寸 (mm)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-muted-foreground mb-1 text-[10px]">
                      宽
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      min={10}
                      value={pageSettings.width}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        updatePageSettings({
                          width: Number.isFinite(val) ? val : 0,
                        });
                      }}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-muted-foreground mb-1 text-[10px]">
                      高
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      min={10}
                      value={pageSettings.height}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        updatePageSettings({
                          height: Number.isFinite(val) ? val : 0,
                        });
                      }}
                      className="h-8"
                    />
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* 边距 */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">边距 (mm)</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-muted-foreground mb-1 text-[10px]">
                    上
                  </Label>
                  <Input
                    type="number"
                    value={pageSettings?.padding[0] ?? 10}
                    onChange={e => {
                      if (!pageSettings) return;
                      const val = parseFloat(e.target.value) || 0;
                      updatePageSettings({
                        padding: [
                          val,
                          pageSettings.padding[1],
                          pageSettings.padding[2],
                          pageSettings.padding[3],
                        ],
                      });
                    }}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground mb-1 text-[10px]">
                    右
                  </Label>
                  <Input
                    type="number"
                    value={pageSettings?.padding[1] ?? 10}
                    onChange={e => {
                      if (!pageSettings) return;
                      const val = parseFloat(e.target.value) || 0;
                      updatePageSettings({
                        padding: [
                          pageSettings.padding[0],
                          val,
                          pageSettings.padding[2],
                          pageSettings.padding[3],
                        ],
                      });
                    }}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground mb-1 text-[10px]">
                    下
                  </Label>
                  <Input
                    type="number"
                    value={pageSettings?.padding[2] ?? 10}
                    onChange={e => {
                      if (!pageSettings) return;
                      const val = parseFloat(e.target.value) || 0;
                      updatePageSettings({
                        padding: [
                          pageSettings.padding[0],
                          pageSettings.padding[1],
                          val,
                          pageSettings.padding[3],
                        ],
                      });
                    }}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground mb-1 text-[10px]">
                    左
                  </Label>
                  <Input
                    type="number"
                    value={pageSettings?.padding[3] ?? 10}
                    onChange={e => {
                      if (!pageSettings) return;
                      const val = parseFloat(e.target.value) || 0;
                      updatePageSettings({
                        padding: [
                          pageSettings.padding[0],
                          pageSettings.padding[1],
                          pageSettings.padding[2],
                          val,
                        ],
                      });
                    }}
                    className="h-8"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // 选中元素时显示元素属性
  return (
    <aside className="flex w-72 flex-col border-l bg-white">
      <div className="border-b p-3">
        <h3 className="text-sm font-medium">
          {selectedElement.type === 'text' && '文本属性'}
          {selectedElement.type === 'placeholder' && '数据字段属性'}
          {selectedElement.type === 'table' && '表格属性'}
          {selectedElement.type === 'image' && '图片属性'}
          {selectedElement.type === 'barcode' && '条码属性'}
        </h3>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {/* 通用属性: 位置与尺寸 */}
        <div className="mb-6 space-y-3">
          <Label className="text-muted-foreground text-xs font-semibold">
            位置与尺寸
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-muted-foreground mb-1 text-[10px]">
                X (mm)
              </Label>
              <Input
                type="number"
                step="0.1"
                value={Number(selectedElement.position.x.toFixed(2))}
                onChange={e =>
                  updateElement(selectedElement.id, {
                    position: {
                      ...selectedElement.position,
                      x: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-muted-foreground mb-1 text-[10px]">
                Y (mm)
              </Label>
              <Input
                type="number"
                step="0.1"
                value={Number(selectedElement.position.y.toFixed(2))}
                onChange={e =>
                  updateElement(selectedElement.id, {
                    position: {
                      ...selectedElement.position,
                      y: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-muted-foreground mb-1 text-[10px]">
                宽度 (mm)
              </Label>
              <Input
                type="number"
                step="0.1"
                value={Number(selectedElement.size.width.toFixed(2))}
                onChange={e =>
                  updateElement(selectedElement.id, {
                    size: {
                      ...selectedElement.size,
                      width: parseFloat(e.target.value) || 1,
                    },
                  })
                }
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-muted-foreground mb-1 text-[10px]">
                高度 (mm)
              </Label>
              <Input
                type="number"
                step="0.1"
                value={Number(selectedElement.size.height.toFixed(2))}
                onChange={e =>
                  updateElement(selectedElement.id, {
                    size: {
                      ...selectedElement.size,
                      height: parseFloat(e.target.value) || 1,
                    },
                  })
                }
                className="h-8"
              />
            </div>
          </div>
        </div>

        <Separator className="mb-4" />

        {/* 文本内容 (仅文本元素) */}
        {selectedElement.type === 'text' && (
          <div className="mb-6 space-y-2">
            <Label className="text-muted-foreground text-xs font-semibold">
              文本内容
            </Label>
            <textarea
              value={selectedElement.content}
              onChange={e =>
                updateElement(selectedElement.id, { content: e.target.value })
              }
              className="focus:ring-primary h-20 w-full resize-none rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
            />
          </div>
        )}

        {/* 数据绑定 (仅占位符) */}
        {selectedElement.type === 'placeholder' && (
          <>
            <DataBindingSection
              templateType={templateType}
              field={selectedElement.field}
              format={selectedElement.format}
              fallback={selectedElement.fallback}
              onFieldChange={(field, label) =>
                updateElement(selectedElement.id, { field, label })
              }
              onFormatChange={format =>
                updateElement(selectedElement.id, { format })
              }
              onFallbackChange={fallback =>
                updateElement(selectedElement.id, { fallback })
              }
            />
            <Separator className="my-4" />
          </>
        )}

        {/* 表格列管理 (仅表格) */}
        {selectedElement.type === 'table' && (
          <>
            <TableColumnManager
              templateType={templateType}
              columns={(selectedElement as TableElement).columns}
              onChange={columns =>
                updateElement(selectedElement.id, { columns })
              }
            />
            <Separator className="my-4" />

            <TableStyleSection
              style={(selectedElement as TableElement).style}
              onChange={styleUpdates =>
                updateElement(selectedElement.id, {
                  style: {
                    ...(selectedElement as TableElement).style,
                    ...styleUpdates,
                  },
                })
              }
            />
          </>
        )}

        {/* 字体样式 (文本、占位符) */}
        {(selectedElement.type === 'text' ||
          selectedElement.type === 'placeholder') && (
            <TypographySection
              style={selectedElement.style}
              onChange={styleUpdates =>
                updateElement(selectedElement.id, {
                  style: { ...selectedElement.style, ...styleUpdates },
                })
              }
            />
          )}

        <Separator className="my-4" />

        <div className="space-y-3">
          <Label className="text-muted-foreground text-xs font-semibold">
            元素状态
          </Label>
          <div className="rounded-lg border bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">锁定位置</p>
                <p className="text-xs text-slate-500">
                  锁定后不可拖动和缩放，适合表头或固定章信息。
                </p>
              </div>
              <Switch
                checked={selectedElement.locked}
                onCheckedChange={checked =>
                  updateElement(selectedElement.id, { locked: checked })
                }
              />
            </div>

            <Separator className="my-3" />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">显示元素</p>
                <p className="text-xs text-slate-500">
                  临时隐藏但不删除，方便对比不同版式方案。
                </p>
              </div>
              <Switch
                checked={selectedElement.visible}
                onCheckedChange={checked =>
                  updateElement(selectedElement.id, { visible: checked })
                }
              />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
