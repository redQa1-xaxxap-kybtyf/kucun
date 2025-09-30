'use client';

import { X } from 'lucide-react';
import Image from 'next/image';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ProductImage {
  url: string;
  type: 'main' | 'effect';
  alt?: string;
  order?: number;
}

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
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-0">
        <div className="relative aspect-square">
          <Image
            src={image.url}
            alt={image.alt || '产品图片'}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          <div className="absolute inset-0 bg-black/0 transition-colors hover:bg-black/20" />

          {/* 图片类型标签 */}
          <Badge
            variant={image.type === 'main' ? 'default' : 'secondary'}
            className="absolute left-2 top-2"
          >
            {image.type === 'main' ? '主图' : '效果图'}
          </Badge>

          {/* 删除按钮 */}
          {!disabled && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute right-2 top-2 h-8 w-8 p-0"
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
            className="text-xs text-muted-foreground"
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
  );
}
