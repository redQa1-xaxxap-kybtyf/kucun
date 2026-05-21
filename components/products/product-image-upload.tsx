'use client';

import { AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

import { ProductImageCard } from '@/components/products/product-image-card';
import { ProductImageUploadArea } from '@/components/products/product-image-upload-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useImageUpload } from '@/hooks/use-image-upload';
import type { ProductImage } from '@/lib/types/product';
import { shouldBypassImageOptimization } from '@/lib/utils/image';
import {
  dedupeProductImages,
  isSameImageUrl,
} from '@/lib/utils/product-image-dedupe';

type ProductImageTab = 'thumbnail' | 'main' | 'effect';

interface ProductImageUploadProps {
  thumbnailUrl?: string;
  images?: ProductImage[];
  onThumbnailChange: (url: string) => void;
  onImagesChange: (images: ProductImage[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  maxSize?: number; // MB
}

export function ProductImageUpload({
  thumbnailUrl = '',
  images = [],
  onThumbnailChange,
  onImagesChange,
  disabled = false,
  maxFiles = 8,
  maxSize = 5,
}: ProductImageUploadProps) {
  const [activeTab, setActiveTab] = useState<ProductImageTab>('thumbnail');
  const normalizedThumbnailUrl = thumbnailUrl.trim();

  const handleImagesChange = (nextImages: ProductImage[]) => {
    onImagesChange(
      dedupeProductImages(
        nextImages,
        normalizedThumbnailUrl ? [normalizedThumbnailUrl] : []
      )
    );
  };

  const handleThumbnailChange = (url: string) => {
    const nextThumbnailUrl = url.trim();
    onThumbnailChange(nextThumbnailUrl);
    onImagesChange(
      dedupeProductImages(images, nextThumbnailUrl ? [nextThumbnailUrl] : [])
    );
  };

  // 使用自定义Hook处理图片上传逻辑
  const { uploading, uploadProgress, uploadError, handleFileUpload } =
    useImageUpload({
      maxFiles,
      maxSize,
      onThumbnailChange: handleThumbnailChange,
      onImagesChange: handleImagesChange,
    });

  // 分离主图和效果图
  const visibleImages = dedupeProductImages(
    images,
    normalizedThumbnailUrl ? [normalizedThumbnailUrl] : []
  );
  const mainImages = visibleImages.filter(img => img.type === 'main');
  const effectImages = visibleImages.filter(img => img.type === 'effect');
  const fallbackThumbnailUrl = normalizedThumbnailUrl
    ? ''
    : mainImages[0]?.url || '';

  const removeImageByUrl = (url: string) => {
    handleImagesChange(images.filter(image => !isSameImageUrl(image.url, url)));
  };

  const updateImageAltByUrl = (
    url: string,
    type: 'main' | 'effect',
    alt: string
  ) => {
    handleImagesChange(
      images.map(image =>
        image.type === type && isSameImageUrl(image.url, url)
          ? { ...image, alt }
          : image
      )
    );
  };

  // 处理文件选择
  const handleThumbnailUpload = (files: FileList) => {
    handleFileUpload(files, 'thumbnail', images);
  };

  const handleMainImageUpload = (files: FileList) => {
    handleFileUpload(files, 'main', images);
  };

  const handleEffectImageUpload = (files: FileList) => {
    handleFileUpload(files, 'effect', images);
  };

  return (
    <div className="space-y-6">
      {/* 错误提示 */}
      {uploadError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{uploadError}</AlertDescription>
        </Alert>
      )}

      <Tabs
        value={activeTab}
        onValueChange={value => setActiveTab(value as ProductImageTab)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="thumbnail">缩略图</TabsTrigger>
          <TabsTrigger value="main">主图</TabsTrigger>
          <TabsTrigger value="effect">效果图</TabsTrigger>
        </TabsList>

        {/* 缩略图上传 */}
        <TabsContent value="thumbnail" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ProductImageUploadArea
              type="thumbnail"
              title="上传缩略图"
              description="300x300 / JPG、PNG"
              multiple={false}
              disabled={disabled}
              uploading={uploading}
              uploadProgress={uploadProgress}
              onFileSelect={handleThumbnailUpload}
            />

            {(normalizedThumbnailUrl || fallbackThumbnailUrl) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-medium">
                    {normalizedThumbnailUrl ? '当前缩略图' : '列表预览图'}
                  </h4>
                  {normalizedThumbnailUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={disabled || uploading}
                      onClick={() => handleThumbnailChange('')}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      删除
                    </Button>
                  )}
                </div>
                <div className="relative aspect-square w-full max-w-[200px] overflow-hidden rounded-lg border">
                  <Image
                    src={normalizedThumbnailUrl || fallbackThumbnailUrl}
                    alt="产品缩略图"
                    fill
                    className="object-cover"
                    sizes="200px"
                    unoptimized={shouldBypassImageOptimization(
                      normalizedThumbnailUrl || fallbackThumbnailUrl
                    )}
                  />
                </div>
                {!normalizedThumbnailUrl && fallbackThumbnailUrl && (
                  <p className="text-xs text-[hsl(var(--color-text-secondary))]">
                    未单独设置缩略图，列表会自动使用第一张主图。
                  </p>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* 主图上传 */}
        <TabsContent value="main" className="space-y-4">
          <ProductImageUploadArea
            type="main"
            title="上传主图"
            description={`800x800 / 最多 ${maxFiles} 张`}
            multiple={true}
            disabled={disabled}
            uploading={uploading}
            uploadProgress={uploadProgress}
            onFileSelect={handleMainImageUpload}
          />

          {mainImages.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">主图列表</h4>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {mainImages.map((image, index) => (
                  <ProductImageCard
                    key={`main-${index}`}
                    image={image}
                    index={index}
                    onRemove={() => removeImageByUrl(image.url)}
                    onUpdateAlt={(_, alt) =>
                      updateImageAltByUrl(image.url, 'main', alt)
                    }
                    disabled={disabled}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* 效果图上传 */}
        <TabsContent value="effect" className="space-y-4">
          <ProductImageUploadArea
            type="effect"
            title="上传效果图"
            description={`最多 ${maxFiles} 张`}
            multiple={true}
            disabled={disabled}
            uploading={uploading}
            uploadProgress={uploadProgress}
            onFileSelect={handleEffectImageUpload}
          />

          {effectImages.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">效果图列表</h4>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {effectImages.map((image, index) => (
                  <ProductImageCard
                    key={`effect-${index}`}
                    image={image}
                    index={index}
                    onRemove={() => removeImageByUrl(image.url)}
                    onUpdateAlt={(_, alt) =>
                      updateImageAltByUrl(image.url, 'effect', alt)
                    }
                    disabled={disabled}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* 上传成功提示 */}
      {!uploading && !uploadError && visibleImages.length > 0 && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            图片上传成功！共 {visibleImages.length} 张图片
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
