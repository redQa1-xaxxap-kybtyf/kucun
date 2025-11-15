'use client';

import { ImageIcon, X, ZoomIn } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ProductImage } from '@/lib/types/product';

interface ProductImageGalleryProps {
  thumbnailUrl?: string;
  images?: ProductImage[];
  productName: string;
}

/**
 * 产品图片展示组件
 * 支持多图展示、图片预览、占位图等功能
 */
export function ProductImageGallery({
  thumbnailUrl,
  images,
  productName,
}: ProductImageGalleryProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // 解析 images 字段（可能是 JSON 字符串）
  const parsedImages: ProductImage[] = (() => {
    if (!images) return [];
    if (Array.isArray(images)) return images;
    if (typeof images === 'string') {
      try {
        const parsed = JSON.parse(images);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  })();

  // 构建图片列表：缩略图 + 其他图片
  const allImages: string[] = [];
  if (thumbnailUrl) {
    allImages.push(thumbnailUrl);
  }
  parsedImages.forEach(img => {
    if (img.url && img.url !== thumbnailUrl) {
      allImages.push(img.url);
    }
  });

  // 打开预览
  const handleImageClick = (index: number) => {
    setCurrentImageIndex(index);
    setPreviewOpen(true);
  };

  // 上一张
  const handlePrevious = () => {
    setCurrentImageIndex(prev => (prev > 0 ? prev - 1 : allImages.length - 1));
  };

  // 下一张
  const handleNext = () => {
    setCurrentImageIndex(prev => (prev < allImages.length - 1 ? prev + 1 : 0));
  };

  // 如果没有图片，显示占位图
  if (allImages.length === 0) {
    return (
      <div
        className="overflow-hidden rounded-lg border-2 border-dashed border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))]"
        style={{ boxShadow: 'var(--shadow-medium)' }}
      >
        <div className="border-b-2 border-dashed border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] px-6 py-4">
          <h4 className="flex items-center gap-2 font-semibold text-[hsl(var(--color-text-primary))]">
            <ImageIcon className="h-5 w-5 text-[hsl(var(--color-text-tertiary))]" />
            产品图片
          </h4>
        </div>
        <div className="p-6">
          <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-[hsl(var(--color-border-primary))] bg-gradient-to-br from-[hsl(var(--color-bg-tertiary))] to-[hsl(var(--color-bg-secondary))]">
            <div className="text-center">
              <ImageIcon className="mx-auto h-16 w-16 text-[hsl(var(--color-text-tertiary))] opacity-50" />
              <p className="mt-3 text-sm font-medium text-[hsl(var(--color-text-secondary))]">
                暂无产品图片
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="overflow-hidden rounded-lg border-2 border-[hsl(var(--color-primary))] bg-gradient-to-br from-[hsl(var(--color-bg-card))] to-[hsl(var(--color-bg-secondary))]"
        style={{ boxShadow: 'var(--shadow-large)' }}
      >
        <div className="border-b-2 border-[hsl(var(--color-primary))] bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-bg-secondary))] px-6 py-4">
          <h4 className="flex items-center gap-2 text-lg font-bold text-[hsl(var(--color-text-primary))]">
            <ImageIcon className="h-5 w-5 text-[hsl(var(--color-primary))]" />
            产品图片
          </h4>
        </div>
        <div className="bg-[hsl(var(--color-bg-card))] p-6">
          {/* 主图展示 */}
          <div className="mb-4">
            <div className="group relative aspect-video overflow-hidden rounded-lg border-2 border-[hsl(var(--color-border-primary))] bg-white shadow-lg transition-all hover:border-[hsl(var(--color-primary))] hover:shadow-xl">
              <Image
                src={allImages[0]}
                alt={productName}
                fill
                className="object-contain transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/40 group-hover:opacity-100">
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => handleImageClick(0)}
                  className="gap-2 shadow-lg"
                >
                  <ZoomIn className="h-4 w-4" />
                  查看大图
                </Button>
              </div>
            </div>
          </div>

          {/* 缩略图列表 */}
          {allImages.length > 1 && (
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8">
              {allImages.map((imageUrl, index) => (
                <button
                  key={index}
                  onClick={() => handleImageClick(index)}
                  className="group relative aspect-square overflow-hidden rounded-lg border-2 border-[hsl(var(--color-border-primary))] bg-white shadow-md transition-all hover:scale-105 hover:border-[hsl(var(--color-primary))] hover:shadow-lg"
                >
                  <Image
                    src={imageUrl}
                    alt={`${productName} - 图片 ${index + 1}`}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-110"
                    sizes="(max-width: 768px) 25vw, (max-width: 1200px) 16vw, 12vw"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/40 group-hover:opacity-100">
                    <ZoomIn className="h-4 w-4 text-white drop-shadow-lg" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 图片预览对话框 */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {productName} - 图片 {currentImageIndex + 1} / {allImages.length}
            </DialogTitle>
          </DialogHeader>
          <div className="relative">
            <div className="relative aspect-video overflow-hidden rounded-lg bg-[hsl(var(--color-bg-tertiary))]">
              <Image
                src={allImages[currentImageIndex]}
                alt={`${productName} - 图片 ${currentImageIndex + 1}`}
                fill
                className="object-contain"
                sizes="(max-width: 1200px) 100vw, 1200px"
                priority
              />
            </div>

            {/* 导航按钮 */}
            {allImages.length > 1 && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handlePrevious}
                  className="absolute top-1/2 left-2 -translate-y-1/2"
                >
                  <span className="sr-only">上一张</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handleNext}
                  className="absolute top-1/2 right-2 -translate-y-1/2"
                >
                  <span className="sr-only">下一张</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Button>
              </>
            )}

            {/* 关闭按钮 */}
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setPreviewOpen(false)}
              className="absolute top-2 right-2"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">关闭</span>
            </Button>
          </div>

          {/* 缩略图导航 */}
          {allImages.length > 1 && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
              {allImages.map((imageUrl, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                    index === currentImageIndex
                      ? 'border-[hsl(var(--color-primary))] shadow-md'
                      : 'border-[hsl(var(--color-border-primary))] hover:border-[hsl(var(--color-primary))]'
                  }`}
                >
                  <Image
                    src={imageUrl}
                    alt={`缩略图 ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
