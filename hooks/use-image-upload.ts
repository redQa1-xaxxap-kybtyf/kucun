'use client';

import { useState } from 'react';

import type { ProductImage } from '@/lib/types/product';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';
import { getErrorMessage } from '@/lib/utils/error-handler';
import { dedupeProductImages } from '@/lib/utils/product-image-dedupe';

interface UseImageUploadProps {
  maxFiles?: number;
  maxSize?: number; // 全局兜底大小（MB），具体类型会在此基础上再收紧
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

  // 不同类型图片的前端大小限制（单位：MB）
  const getMaxSizeForType = (
    imageType: 'thumbnail' | 'main' | 'effect'
  ): number => {
    // 业务约定：
    // - 缩略图：1MB
    // - 主图：1MB
    // - 效果图：2MB
    const typeLimit = imageType === 'effect' ? 2 : 1;

    // 同时不超过外部传入的 maxSize（兜底）
    return Math.min(typeLimit, maxSize);
  };

  const validateFile = (
    file: File,
    imageType: 'thumbnail' | 'main' | 'effect'
  ): string | null => {
    const limitMb = getMaxSizeForType(imageType);
    if (file.size > limitMb * 1024 * 1024) {
      return `文件大小不能超过 ${limitMb}MB`;
    }
    if (!file.type.startsWith('image/')) {
      return '只能上传图片文件';
    }
    return null;
  };

  const validateImageDimensions = async (file: File): Promise<string | null> =>
    new Promise(resolve => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);

        if (img.width < 300 || img.height < 300) {
          resolve('图片分辨率过低，至少需要 300x300 像素');
        } else if (img.width > 4000 || img.height > 4000) {
          resolve('图片分辨率过高，不超过 4000x4000 像素');
        } else {
          resolve(null);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve('无效的图片文件');
      };

      img.src = url;
    });

  // 单文件上传（带 CSRF 头）
  const uploadFile = async (
    file: File,
    imageType: 'thumbnail' | 'main' | 'effect'
  ): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'product');
    // 标记图片用途，方便后端按类型做更细粒度大小控制
    formData.append('kind', imageType);

    const response = await fetch(
      '/api/upload',
      getCsrfTokenHeader({
        method: 'POST',
        body: formData,
      })
    );

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

  // 带重试的上传（指数退避，仅对网络/服务器错误重试）
  const uploadFileWithRetry = async (
    file: File,
    imageType: 'thumbnail' | 'main' | 'effect',
    maxRetries = 2,
    baseDelayMs = 500
  ): Promise<string> => {
    let attempt = 0;
    const sleep = (ms: number) =>
      new Promise(resolve => setTimeout(resolve, ms));

    while (true) {
      try {
        return await uploadFile(file, imageType);
      } catch (error) {
        attempt += 1;
        const message = getErrorMessage(error);
        const isServerOrNetworkError =
          message.includes('上传失败') ||
          message.includes('NetworkError') ||
          message.includes('500') ||
          message.includes('503');

        if (!isServerOrNetworkError || attempt > maxRetries) {
          throw error;
        }

        const delay = baseDelayMs * 2 ** (attempt - 1);

        await sleep(delay);
      }
    }
  };

  // 简单并发控制：限制同时上传的文件数量
  const runWithConcurrency = async <T, R>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<R>
  ): Promise<R[]> => {
    const results: R[] = new Array(items.length);
    let nextIndex = 0;

    const runWorker = async () => {
      while (true) {
        const currentIndex = nextIndex++;
        if (currentIndex >= items.length) {
          return;
        }

        results[currentIndex] = await worker(items[currentIndex], currentIndex);
      }
    };

    const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
      runWorker()
    );

    await Promise.all(workers);
    return results;
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
      const fileArray = Array.from(files);

      const uploadedUrls = await runWithConcurrency(
        fileArray,
        3, // 同时最多 3 个上传请求
        async (file, index) => {
          const validationError = validateFile(file, imageType);
          if (validationError) {
            throw new Error(validationError);
          }

          // 验证图片尺寸
          const dimensionError = await validateImageDimensions(file);
          if (dimensionError) {
            throw new Error(dimensionError);
          }

          const url = await uploadFileWithRetry(file, imageType);
          setUploadProgress(((index + 1) / fileArray.length) * 100);
          return url;
        }
      );

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

        onImagesChange(dedupeProductImages([...currentImages, ...newImages]));
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
    onImagesChange(dedupeProductImages(filteredImages));
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
    onImagesChange(dedupeProductImages(updatedImages));
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
