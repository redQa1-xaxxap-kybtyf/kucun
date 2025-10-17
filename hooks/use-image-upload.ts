'use client';

import { useState } from 'react';

import type { ProductImage } from '@/lib/types/product';
import { getErrorMessage } from '@/lib/utils/error-handler';

interface UseImageUploadProps {
  maxFiles?: number;
  maxSize?: number; // MB
  onThumbnailChange: (url: string) => void;
  onImagesChange: (images: ProductImage[]) => void;
}

export function useImageUpload({
  maxFiles: _maxFiles = 8,
  maxSize = 5,
  onThumbnailChange,
  onImagesChange,
}: UseImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
      throw new Error(errorData.error || errorData.message || '上传失败');
    }

    const data = await response.json();
    // API返回结构: { success: true, data: { url: "..." }, message: "..." }
    if (!data.success || !data.data?.url) {
      throw new Error(data.error || '上传失败：未返回图片URL');
    }
    return data.data.url;
  };

  const handleFileUpload = async (
    files: FileList,
    imageType: 'thumbnail' | 'main' | 'effect',
    currentImages: ProductImage[]
  ) => {
    if (!files.length) return;

    setUploading(true);
    setUploadError(null);
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
            currentImages.length + index + 1
          }`,
          order: currentImages.length + index,
        }));

        onImagesChange([...currentImages, ...newImages]);
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setUploadError(errorMessage);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const removeImage = (
    images: ProductImage[],
    index: number,
    type: 'main' | 'effect'
  ) => {
    // 先筛选出该类型的图片列表
    const typeImages = images.filter(img => img.type === type);
    // 找到要删除的图片
    const targetImage = typeImages[index];

    if (!targetImage) {
      return; // 索引越界保护
    }

    // 从完整列表中移除该图片
    const filteredImages = images.filter(img => img !== targetImage);
    onImagesChange(filteredImages);
  };

  const updateImageAlt = (
    images: ProductImage[],
    index: number,
    alt: string,
    type: 'main' | 'effect'
  ) => {
    // 先筛选出该类型的图片列表
    const typeImages = images.filter(img => img.type === type);
    // 找到要更新的图片
    const targetImage = typeImages[index];

    if (!targetImage) {
      return; // 索引越界保护
    }

    // 更新图片的 alt 属性
    const updatedImages = images.map(img =>
      img === targetImage ? { ...img, alt } : img
    );
    onImagesChange(updatedImages);
  };

  return {
    uploading,
    uploadProgress,
    uploadError,
    handleFileUpload,
    removeImage,
    updateImageAlt,
    validateFile,
  };
}
