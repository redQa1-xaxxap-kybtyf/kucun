'use client';

import { useState } from 'react';

interface ProductImage {
  url: string;
  type: 'main' | 'effect';
  alt?: string;
  order?: number;
}

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
      setUploadError(
        error instanceof Error ? error.message : '上传失败，请重试'
      );
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
    const filteredImages = images.filter(
      (img, i) => !(img.type === type && i === index)
    );
    onImagesChange(filteredImages);
  };

  const updateImageAlt = (
    images: ProductImage[],
    index: number,
    alt: string
  ) => {
    const updatedImages = [...images];
    updatedImages[index] = { ...updatedImages[index], alt };
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
