'use client';

import { AlertCircle, CheckCircle } from 'lucide-react';
import Image from 'next/image';

import { ProductImageCard } from '@/components/products/product-image-card';
import { ProductImageUploadArea } from '@/components/products/product-image-upload-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useImageUpload } from '@/hooks/use-image-upload';

interface ProductImage {
  url: string;
  type: 'main' | 'effect';
  alt?: string;
  order?: number;
}

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
  // 使用自定义Hook处理图片上传逻辑
  const {
    uploading,
    uploadProgress,
    uploadError,
    handleFileUpload,
    removeImage,
    updateImageAlt,
  } = useImageUpload({
    maxFiles,
    maxSize,
    onThumbnailChange,
    onImagesChange,
  });

  // 分离主图和效果图
  const mainImages = images.filter(img => img.type === 'main');
  const effectImages = images.filter(img => img.type === 'effect');

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

      <Tabs defaultValue="thumbnail" className="w-full">
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
              description="建议尺寸 300x300px，支持 JPG、PNG 格式"
              multiple={false}
              disabled={disabled}
              uploading={uploading}
              uploadProgress={uploadProgress}
              onFileSelect={handleThumbnailUpload}
            />

            {thumbnailUrl && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">当前缩略图</h4>
                <div className="relative aspect-square w-full max-w-[200px] overflow-hidden rounded-lg border">
                  <Image
                    src={thumbnailUrl}
                    alt="产品缩略图"
                    fill
                    className="object-cover"
                    sizes="200px"
                  />
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* 主图上传 */}
        <TabsContent value="main" className="space-y-4">
          <ProductImageUploadArea
            type="main"
            title="上传主图"
            description={`建议尺寸 800x800px，最多上传 ${maxFiles} 张`}
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
                    onRemove={() => removeImage(images, index, 'main')}
                    onUpdateAlt={(_, alt) => updateImageAlt(images, index, alt)}
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
            description={`展示产品使用效果，最多上传 ${maxFiles} 张`}
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
                    onRemove={() => removeImage(images, index, 'effect')}
                    onUpdateAlt={(_, alt) => updateImageAlt(images, index, alt)}
                    disabled={disabled}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* 上传成功提示 */}
      {!uploading && !uploadError && images.length > 0 && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            图片上传成功！共 {images.length} 张图片
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
