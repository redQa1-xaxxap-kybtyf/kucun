'use client';

import {
  AlertCircle,
  CheckCircle,
  // Image as ImageIcon, // 未使用
  Loader2,
  // Move, // 未使用
  // Plus, // 未使用
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { useRef, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<
    'idle' | 'uploading' | 'success' | 'error'
  >('idle');
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState('thumbnail');

  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const mainImageInputRef = useRef<HTMLInputElement>(null);
  const effectImageInputRef = useRef<HTMLInputElement>(null);

  // 获取主图和效果图
  const mainImages = images.filter(img => img.type === 'main');
  const effectImages = images.filter(img => img.type === 'effect');

  const validateFile = (file: File): string | null => {
    if (file.size > maxSize * 1024 * 1024) {
      return `文件大小不能超过 ${maxSize}MB`;
    }
    if (!file.type.startsWith('image/')) {
      return '只能上传图片文件';
    }
    return null;
  };

  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'product');

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '上传失败');
    }

    const data = await response.json();
    return data.url;
  };

  const handleFileUpload = async (
    files: FileList | null,
    imageType: 'thumbnail' | 'main' | 'effect'
  ) => {
    if (!files || files.length === 0) return;

    setError('');
    setUploading(true);
    setUploadStatus('uploading');
    setUploadProgress(0);

    try {
      const uploadPromises = Array.from(files).map(async (file, index) => {
        const validationError = validateFile(file);
        if (validationError) {
          throw new Error(validationError);
        }

        const url = await uploadFile(file);
        setUploadProgress(((index + 1) / files.length) * 100);
        return url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);

      if (imageType === 'thumbnail') {
        onThumbnailChange(uploadedUrls[0]);
      } else {
        const newImages = uploadedUrls.map((url, index) => ({
          url,
          type: imageType,
          alt: `${imageType === 'main' ? '产品主图' : '产品效果图'} ${
            images.length + index + 1
          }`,
          order: images.length + index,
        }));

        onImagesChange([...images, ...newImages]);
      }

      setUploadStatus('success');
      setTimeout(() => setUploadStatus('idle'), 2000);
    } catch (error) {
      setError(error instanceof Error ? error.message : '上传失败');
      setUploadStatus('error');
      setTimeout(() => setUploadStatus('idle'), 3000);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const removeImage = (index: number, type: 'main' | 'effect') => {
    const filteredImages = images.filter(
      (img, i) => !(img.type === type && i === index)
    );
    onImagesChange(filteredImages);
  };

  const updateImageAlt = (index: number, alt: string) => {
    const updatedImages = [...images];
    updatedImages[index] = { ...updatedImages[index], alt };
    onImagesChange(updatedImages);
  };

  const openFileDialog = (inputRef: React.RefObject<HTMLInputElement>) => {
    if (!disabled && !uploading) {
      inputRef.current?.click();
    }
  };

  const renderUploadArea = (
    title: string,
    description: string,
    inputRef: React.RefObject<HTMLInputElement>,
    onFileChange: (files: FileList | null) => void,
    multiple = false
  ) => (
    <Card
      className={`border-2 border-dashed transition-colors ${
        disabled || uploading
          ? 'cursor-not-allowed border-muted bg-muted/50'
          : 'cursor-pointer border-muted-foreground/25 hover:border-muted-foreground/50'
      }`}
      onClick={() => openFileDialog(inputRef)}
    >
      <CardContent className="flex flex-col items-center justify-center py-6 text-center">
        <div className="mb-4">
          {uploadStatus === 'uploading' ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : uploadStatus === 'success' ? (
            <CheckCircle className="h-8 w-8 text-green-500" />
          ) : uploadStatus === 'error' ? (
            <AlertCircle className="h-8 w-8 text-red-500" />
          ) : (
            <Upload className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <h3 className="mb-2 font-medium">{title}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{description}</p>
        {uploading && (
          <div className="w-full max-w-xs">
            <Progress value={uploadProgress} className="mb-2" />
            <p className="text-xs text-muted-foreground">
              正在上传到七牛云CDN... {Math.round(uploadProgress)}%
            </p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          onChange={e => onFileChange(e.target.files)}
          className="hidden"
          disabled={disabled || uploading}
        />
      </CardContent>
    </Card>
  );

  const renderImageGrid = (
    imageList: ProductImage[],
    type: 'main' | 'effect'
  ) => (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {imageList.map((image, index) => (
        <Card key={`${type}-${index}`} className="relative overflow-hidden">
          <div className="relative aspect-square">
            <Image
              src={image.url}
              alt={image.alt || `${type}图片`}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 transition-opacity hover:opacity-100">
              <div className="absolute right-2 top-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => removeImage(index, type)}
                  disabled={disabled}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
          <CardContent className="p-2">
            <Input
              placeholder="图片描述"
              value={image.alt || ''}
              onChange={e => updateImageAlt(index, e.target.value)}
              disabled={disabled}
              className="text-xs"
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="thumbnail">
            缩略图
            {thumbnailUrl && (
              <Badge variant="secondary" className="ml-2">
                1
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="main">
            主图
            {mainImages.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {mainImages.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="effect">
            效果图
            {effectImages.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {effectImages.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="thumbnail" className="space-y-4">
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">产品缩略图</Label>
              <p className="text-sm text-muted-foreground">
                用于产品列表显示的小尺寸图片，建议尺寸 200x200px
              </p>
            </div>

            {thumbnailUrl ? (
              <Card className="relative h-32 w-32">
                <Image
                  src={thumbnailUrl}
                  alt="产品缩略图"
                  width={128}
                  height={128}
                  className="rounded-lg object-cover"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute -right-2 -top-2"
                  onClick={() => onThumbnailChange('')}
                  disabled={disabled}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Card>
            ) : (
              renderUploadArea(
                '上传缩略图',
                '点击或拖拽图片到此处上传缩略图',
                thumbnailInputRef,
                files => handleFileUpload(files, 'thumbnail')
              )
            )}
          </div>
        </TabsContent>

        <TabsContent value="main" className="space-y-4">
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">产品主图</Label>
              <p className="text-sm text-muted-foreground">
                展示产品主要特征的高质量图片，建议尺寸 800x800px
              </p>
            </div>

            {mainImages.length > 0 && renderImageGrid(mainImages, 'main')}

            {mainImages.length < maxFiles &&
              renderUploadArea(
                '上传主图',
                '点击或拖拽图片到此处上传产品主图（支持多选）',
                mainImageInputRef,
                files => handleFileUpload(files, 'main'),
                true
              )}
          </div>
        </TabsContent>

        <TabsContent value="effect" className="space-y-4">
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">产品效果图</Label>
              <p className="text-sm text-muted-foreground">
                展示产品实际使用效果的图片，如装修效果、应用场景等
              </p>
            </div>

            {effectImages.length > 0 && renderImageGrid(effectImages, 'effect')}

            {effectImages.length < maxFiles &&
              renderUploadArea(
                '上传效果图',
                '点击或拖拽图片到此处上传产品效果图（支持多选）',
                effectImageInputRef,
                files => handleFileUpload(files, 'effect'),
                true
              )}
          </div>
        </TabsContent>
      </Tabs>

      <div className="text-xs text-muted-foreground">
        <p>✓ 图片将自动上传到七牛云CDN，确保快速访问</p>
        <p>✓ 支持 JPG、PNG、WebP 格式，单个文件最大 {maxSize}MB</p>
        <p>✓ 建议图片尺寸：缩略图 200x200px，主图/效果图 800x800px</p>
      </div>
    </div>
  );
}
