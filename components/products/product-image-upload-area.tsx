'use client';

import { Loader2, Upload } from 'lucide-react';
import React, { useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

interface ProductImageUploadAreaProps {
  type: 'thumbnail' | 'main' | 'effect';
  title: string;
  description: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  uploading?: boolean;
  uploadProgress?: number;
  onFileSelect: (files: FileList) => void;
}

export function ProductImageUploadArea({
  type: _type,
  title,
  description,
  accept = 'image/*',
  multiple = false,
  disabled = false,
  uploading = false,
  uploadProgress = 0,
  onFileSelect,
}: ProductImageUploadAreaProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (!disabled && !uploading) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files);
    }
    // 清空input值，允许重复选择同一文件
    e.target.value = '';
  };

  return (
    <Card
      className={`cursor-pointer border-2 border-dashed transition-colors hover:border-primary/50 ${
        disabled || uploading ? 'cursor-not-allowed opacity-50' : ''
      }`}
      onClick={handleClick}
    >
      <CardContent className="flex flex-col items-center justify-center p-6 text-center">
        <Input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled || uploading}
        />

        {uploading ? (
          <div className="space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="space-y-2">
              <p className="text-sm font-medium">上传中...</p>
              <Progress value={uploadProgress} className="w-32" />
              <p className="text-xs text-muted-foreground">
                {Math.round(uploadProgress)}%
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="space-y-2">
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={e => {
                e.stopPropagation();
                handleClick();
              }}
            >
              选择文件
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
