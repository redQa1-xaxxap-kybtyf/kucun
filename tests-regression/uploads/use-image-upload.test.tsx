import { act, renderHook, waitFor } from '@testing-library/react';

import { useImageUpload } from '@/hooks/use-image-upload';

function createFileList(files: File[]): FileList {
  return {
    ...files,
    item: (index: number) => files[index] ?? null,
    length: files.length,
  } as unknown as FileList;
}

class MockImage {
  height = 800;
  onerror: null | (() => void) = null;
  onload: null | (() => void) = null;
  width = 800;

  set src(_value: string) {
    setTimeout(() => {
      this.onload?.();
    }, 0);
  }
}

describe('useImageUpload', () => {
  const originalFetch = global.fetch;
  const originalImage = global.Image;
  const createObjectURL = URL.createObjectURL;
  const revokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    global.Image = MockImage as unknown as typeof Image;
    URL.createObjectURL = jest.fn(() => 'blob:preview');
    URL.revokeObjectURL = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
    global.Image = originalImage;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  test('上传缩略图成功时应回调更新缩略图地址', async () => {
    const onThumbnailChange = jest.fn();
    const onImagesChange = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          url: '/api/uploads/product/thumb.webp',
        },
      }),
    });

    const { result } = renderHook(() =>
      useImageUpload({
        onThumbnailChange,
        onImagesChange,
      })
    );

    const file = new File([new Uint8Array([1, 2, 3])], 'thumb.png', {
      type: 'image/png',
    });

    await act(async () => {
      await result.current.handleFileUpload(
        createFileList([file]),
        'thumbnail',
        []
      );
    });

    await waitFor(() => {
      expect(onThumbnailChange).toHaveBeenCalledWith(
        '/api/uploads/product/thumb.webp'
      );
    });
    expect(onImagesChange).not.toHaveBeenCalled();
  });

  test('上传主图成功时应按顺序追加图片并生成中文 alt', async () => {
    const onThumbnailChange = jest.fn();
    const onImagesChange = jest.fn();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            url: '/api/uploads/product/main-1.webp',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            url: '/api/uploads/product/main-2.webp',
          },
        }),
      });

    const currentImages = [
      {
        url: '/api/uploads/product/existing.webp',
        type: 'main' as const,
        alt: '产品主图 1',
        order: 0,
      },
    ];

    const { result } = renderHook(() =>
      useImageUpload({
        onThumbnailChange,
        onImagesChange,
      })
    );

    const file1 = new File([new Uint8Array([1, 2, 3])], 'main-1.png', {
      type: 'image/png',
    });
    const file2 = new File([new Uint8Array([4, 5, 6])], 'main-2.png', {
      type: 'image/png',
    });

    await act(async () => {
      await result.current.handleFileUpload(
        createFileList([file1, file2]),
        'main',
        currentImages
      );
    });

    await waitFor(() => {
      expect(onImagesChange).toHaveBeenCalledWith([
        currentImages[0],
        {
          url: '/api/uploads/product/main-1.webp',
          type: 'main',
          alt: '产品主图 2',
          order: 1,
        },
        {
          url: '/api/uploads/product/main-2.webp',
          type: 'main',
          alt: '产品主图 3',
          order: 2,
        },
      ]);
    });
  });

  test('上传失败时应暴露可读错误信息', async () => {
    const onThumbnailChange = jest.fn();
    const onImagesChange = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({
        error: '七牛云上传失败',
      }),
    });

    const { result } = renderHook(() =>
      useImageUpload({
        onThumbnailChange,
        onImagesChange,
      })
    );

    const file = new File([new Uint8Array([1, 2, 3])], 'effect.png', {
      type: 'image/png',
    });

    await act(async () => {
      await result.current.handleFileUpload(
        createFileList([file]),
        'effect',
        []
      );
    });

    await waitFor(() => {
      expect(result.current.uploadError).toBe('七牛云上传失败');
    });
    expect(onThumbnailChange).not.toHaveBeenCalled();
    expect(onImagesChange).not.toHaveBeenCalled();
  });
});
