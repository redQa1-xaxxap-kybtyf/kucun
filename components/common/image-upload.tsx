'use client';

import {
  AlertCircle,
  CheckCircle,
  Image as ImageIcon,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { useRef, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface ImageUploadProps {
  value?: string[];
  onChange: (images: string[]) => void;
  maxFiles?: number;
  maxSize?: number; // MB
  accept?: string;
  disabled?: boolean;
  className?: string;
}

export function ImageUpload({
  value = [],
  onChange,
  maxFiles = 5,
  maxSize = 5,
  accept = 'image/*',
  disabled = false,
  className = '',
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<
    'idle' | 'uploading' | 'success' | 'error'
  >('idle');
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList) => {
    setError('');
    setUploadStatus('idle');

    // 检查文件数量限制
    if (value.length + files.length > maxFiles) {
      setError(`最多只能上传 ${maxFiles} 张图片`);
      setUploadStatus('error');
      return;
    }

    const validFiles: File[] = [];

    // 验证每个文件
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // 检查文件类型
      if (!file.type.startsWith('image/')) {
        setError(`文件 ${file.name} 不是有效的图片格式`);
        setUploadStatus('error');
        return;
      }

      // 检查文件大小
      if (file.size > maxSize * 1024 * 1024) {
        setError(`文件 ${file.name} 大小超过 ${maxSize}MB`);
        setUploadStatus('error');
        return;
      }

      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    setUploading(true);
    setUploadStatus('uploading');
    setUploadProgress(0);

    try {
      const uploadPromises = validFiles.map(async (file, index) => {
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

        const result = await response.json();

        // 更新进度
        const progress = ((index + 1) / validFiles.length) * 100;
        setUploadProgress(progress);

        return result.data.url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      onChange([...value, ...uploadedUrls]);
      setUploadStatus('success');

      // 3秒后重置状态
      setTimeout(() => {
        setUploadStatus('idle');
        setUploadProgress(0);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
      setUploadStatus('error');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled || uploading) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files);
    }
    // 清空input值，允许重复选择同一文件
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    const newImages = value.filter((_, i) => i !== index);
    onChange(newImages);
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={className}>
      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 已上传的图片预览 */}
      {value.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {value.map((url, index) => (
            <Card key={index} className="group relative">
              <CardContent className="p-2">
                <div className="relative aspect-square overflow-hidden rounded-md">
                  <Image
                    src={url}
                    alt={`产品图片 ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute right-1 top-1 h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => removeImage(index)}
                    disabled={disabled || uploading}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 上传区域 */}
      {value.length < maxFiles && (
        <Card
          className={`border-2 border-dashed transition-colors ${
            disabled || uploading
              ? 'cursor-not-allowed border-muted bg-muted/50'
              : 'cursor-pointer border-muted-foreground/25 hover:border-muted-foreground/50'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={disabled || uploading ? undefined : openFileDialog}
        >
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-4">
              {uploadStatus === 'uploading' ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : uploadStatus === 'success' ? (
                <CheckCircle className="h-8 w-8 text-green-500" />
              ) : uploadStatus === 'error' ? (
                <AlertCircle className="h-8 w-8 text-red-500" />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">
                {uploadStatus === 'uploading'
                  ? '正在上传到七牛云...'
                  : uploadStatus === 'success'
                    ? '上传成功！'
                    : uploadStatus === 'error'
                      ? '上传失败'
                      : '点击或拖拽上传图片'}
              </p>

              {uploadStatus === 'uploading' && (
                <div className="w-full max-w-xs">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {Math.round(uploadProgress)}% 完成
                  </p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                支持 JPG、PNG、GIF 格式，单个文件不超过 {maxSize}MB
              </p>
              <p className="text-xs text-muted-foreground">
                最多可上传 {maxFiles} 张图片 ({value.length}/{maxFiles})
              </p>
              <p className="text-xs text-green-600">
                ✓ 图片将自动上传到七牛云CDN
              </p>
            </div>

            {!uploading && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                disabled={disabled}
              >
                <Upload className="mr-2 h-4 w-4" />
                选择文件
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={handleFileInputChange}
        disabled={disabled || uploading}
      />
    </div>
  );
}
