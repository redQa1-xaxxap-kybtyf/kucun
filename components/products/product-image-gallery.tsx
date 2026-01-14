'use client';

import { ImageIcon, ZoomIn } from 'lucide-react';
import Image from 'next/image';
import { useMemo } from 'react';
import { PhotoProvider, PhotoView } from 'react-photo-view';

import type { ProductImage } from '@/lib/types/product';
import { cn } from '@/lib/utils';

import 'react-photo-view/dist/react-photo-view.css';

interface ProductImageGalleryProps {
  thumbnailUrl?: string;
  images?: ProductImage[];
  productName: string;
}

// 图片类型配置
const IMAGE_TYPE_CONFIG = {
  thumbnail: { label: '缩略图', color: 'bg-blue-500', borderColor: 'border-blue-500' },
  main: { label: '主图', color: 'bg-green-500', borderColor: 'border-green-500' },
  effect: { label: '效果图', color: 'bg-purple-500', borderColor: 'border-purple-500' },
} as const;

type ImageType = keyof typeof IMAGE_TYPE_CONFIG;

interface DisplayImage {
  url: string;
  type: ImageType;
}

interface GroupedImages {
  thumbnail: DisplayImage[];
  main: DisplayImage[];
  effect: DisplayImage[];
}

/**
 * 产品图片展示组件（按类型分组）
 */
export function ProductImageGallery({
  thumbnailUrl,
  images,
  productName,
}: ProductImageGalleryProps) {
  // 按类型分组图片
  const groupedImages: GroupedImages = useMemo(() => {
    const result: GroupedImages = { thumbnail: [], main: [], effect: [] };

    // 添加缩略图
    if (thumbnailUrl) {
      result.thumbnail.push({ url: thumbnailUrl, type: 'thumbnail' });
    }

    // 解析 images 字段
    let parsedImages: ProductImage[] = [];
    if (images) {
      if (Array.isArray(images)) {
        parsedImages = images;
      } else if (typeof images === 'string') {
        try {
          const parsed = JSON.parse(images);
          parsedImages = Array.isArray(parsed) ? parsed : [];
        } catch {
          parsedImages = [];
        }
      }
    }

    // 按类型分组
    parsedImages.forEach(img => {
      if (img.url && img.url !== thumbnailUrl) {
        const type = (img.type === 'effect' ? 'effect' : 'main') as ImageType;
        result[type].push({ url: img.url, type });
      }
    });

    return result;
  }, [thumbnailUrl, images]);

  const totalCount = groupedImages.thumbnail.length + groupedImages.main.length + groupedImages.effect.length;

  // 无图片
  if (totalCount === 0) {
    return (
      <div className="card-shadow-medium overflow-hidden rounded-lg border-2 border-dashed border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))]">
        <div className="border-b-2 border-dashed border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] px-4 py-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--color-text-primary))]">
            <ImageIcon className="h-4 w-4 text-[hsl(var(--color-text-tertiary))]" />
            产品图片
          </h4>
        </div>
        <div className="p-4">
          <div className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))]">
            <div className="text-center">
              <ImageIcon className="mx-auto h-6 w-6 text-[hsl(var(--color-text-tertiary))] opacity-50" />
              <p className="mt-1 text-xs text-[hsl(var(--color-text-secondary))]">暂无图片</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 渲染图片组
  const renderImageGroup = (type: ImageType, images: DisplayImage[]) => {
    if (images.length === 0) return null;

    const config = IMAGE_TYPE_CONFIG[type];

    return (
      <div key={type}>
        <div className="mb-2 flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', config.color)} />
          <span className="text-xs font-medium text-[hsl(var(--color-text-secondary))]">
            {config.label}
            <span className="ml-1 text-[hsl(var(--color-text-tertiary))]">({images.length})</span>
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {images.map((img, index) => (
            <PhotoView key={`${type}-${index}`} src={img.url}>
              <div
                className={cn(
                  'group relative h-20 w-20 cursor-zoom-in overflow-hidden rounded-lg border-2 bg-white shadow-sm transition-all hover:shadow-md',
                  config.borderColor
                )}
              >
                <Image
                  src={img.url}
                  alt={`${productName} - ${config.label} ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
                  <ZoomIn className="h-4 w-4 text-white drop-shadow" />
                </div>
              </div>
            </PhotoView>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="card-shadow-medium overflow-hidden rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))]">
      <div className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] px-4 py-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--color-text-primary))]">
          <ImageIcon className="h-4 w-4 text-[hsl(var(--color-text-tertiary))]" />
          产品图片
          <span className="text-xs font-normal text-[hsl(var(--color-text-tertiary))]">
            （{totalCount}张）
          </span>
        </h4>
      </div>
      <div className="p-4">
        <PhotoProvider
          speed={() => 300}
          maskOpacity={0.9}
          toolbarRender={({ onScale, scale, onRotate, rotate }) => (
            <div className="flex items-center gap-2">
              <button
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                onClick={() => onScale(scale - 0.5)}
                title="缩小"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35M8 11h6" />
                </svg>
              </button>
              <span className="min-w-[2.5rem] text-center text-xs text-white">{Math.round(scale * 100)}%</span>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                onClick={() => onScale(scale + 0.5)}
                title="放大"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
                </svg>
              </button>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                onClick={() => onRotate(rotate + 90)}
                title="旋转"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 4v6h6" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
              </button>
            </div>
          )}
        >
          <div className="space-y-4">
            {renderImageGroup('thumbnail', groupedImages.thumbnail)}
            {renderImageGroup('main', groupedImages.main)}
            {renderImageGroup('effect', groupedImages.effect)}
          </div>
        </PhotoProvider>
      </div>
    </div>
  );
}
