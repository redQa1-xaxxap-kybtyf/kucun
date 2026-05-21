'use client';

import { Eye, Minus, Plus, RotateCcw, X } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProductImage } from '@/lib/types/product';
import { shouldBypassImageOptimization } from '@/lib/utils/image';

interface ProductImageCardProps {
  image: ProductImage;
  index: number;
  onRemove: (index: number, type: 'main' | 'effect') => void;
  onUpdateAlt: (index: number, alt: string) => void;
  disabled?: boolean;
}

export function ProductImageCard({
  image,
  index,
  onRemove,
  onUpdateAlt,
  disabled = false,
}: ProductImageCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  const title =
    image.alt || (image.type === 'main' ? '产品主图预览' : '产品效果图预览');

  return (
    <>
      <Card className="group relative overflow-hidden">
        <CardContent className="p-0">
          <div className="relative aspect-square">
            <Image
              src={image.url}
              alt={image.alt || '产品图片'}
              fill
              className="cursor-zoom-in object-cover"
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              unoptimized={shouldBypassImageOptimization(image.url)}
              onClick={() => setPreviewOpen(true)}
            />
            <div
              className="absolute inset-0 flex cursor-zoom-in items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/40 group-hover:opacity-100"
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="h-6 w-6 text-white" />
            </div>

            {/* 图片类型标签 */}
            <Badge
              variant={image.type === 'main' ? 'default' : 'secondary'}
              className="absolute top-2 left-2"
            >
              {image.type === 'main' ? '主图' : '效果图'}
            </Badge>

            {!disabled && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                aria-label={`删除${title}`}
                className="absolute top-2 right-2 h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => onRemove(index, image.type)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* 图片描述编辑 */}
          <div className="p-3">
            <Label
              htmlFor={`alt-${index}`}
              className="text-muted-foreground text-xs"
            >
              图片描述
            </Label>
            <Input
              id={`alt-${index}`}
              value={image.alt || ''}
              onChange={e => onUpdateAlt(index, e.target.value)}
              placeholder="输入图片描述..."
              className="mt-1 h-8 text-xs"
              disabled={disabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* 图片预览对话框 */}
      <Dialog
        open={previewOpen}
        onOpenChange={open => {
          setPreviewOpen(open);
          if (!open) {
            setZoom(1);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          {/* 缩放控制条 */}
          <div className="mb-2 flex items-center justify-end gap-2 text-xs text-[hsl(var(--color-text-secondary))]">
            <span>缩放: {(zoom * 100).toFixed(0)}%</span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() =>
                setZoom(z => Math.max(0.5, Number((z - 0.25).toFixed(2))))
              }
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() =>
                setZoom(z => Math.min(3, Number((z + 0.25).toFixed(2))))
              }
            >
              <Plus className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setZoom(1)}
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>

          <div className="max-h-[70vh] overflow-auto rounded-lg bg-[hsl(var(--color-bg-tertiary))]">
            <div
              className="inline-block"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'center top',
                transition: 'transform 150ms ease-out',
              }}
            >
              {/* 预览使用原生 img，避免 fill + aspect 限制，保证可以完整查看 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt={image.alt || '产品图片预览'}
                className="max-h-[70vh] max-w-full object-contain"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
