const { request } = require('./request');

const MB = 1024 * 1024;
const IMAGE_UPLOAD_PRESETS = {
  thumbnail: {
    label: '缩略图',
    maxSize: 1 * MB,
    maxWidth: 480,
    maxHeight: 480,
    quality: 75,
  },
  main: {
    label: '主图',
    maxSize: 1 * MB,
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 80,
  },
  effect: {
    label: '效果图',
    maxSize: 2 * MB,
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 80,
  },
};

function getFileName(filePath, fallbackName) {
  const name =
    String(filePath || '')
      .split('/')
      .pop() || fallbackName;
  return name.includes('.') ? name : `${name}.jpg`;
}

function getUploadPreset(kind) {
  return IMAGE_UPLOAD_PRESETS[kind] || IMAGE_UPLOAD_PRESETS.main;
}

function isGif(filePath) {
  return /\.gif(?:\?|$)/i.test(String(filePath || ''));
}

function getFileSize(filePath) {
  return new Promise(resolve => {
    if (!wx.getFileInfo) {
      resolve(null);
      return;
    }

    wx.getFileInfo({
      filePath,
      success(result) {
        resolve(Number(result.size) || null);
      },
      fail() {
        resolve(null);
      },
    });
  });
}

function getImageMeta(filePath) {
  return new Promise(resolve => {
    if (!wx.getImageInfo) {
      resolve(null);
      return;
    }

    wx.getImageInfo({
      src: filePath,
      success(result) {
        resolve({
          width: Number(result.width) || 0,
          height: Number(result.height) || 0,
        });
      },
      fail() {
        resolve(null);
      },
    });
  });
}

function getCompressedSize(meta, preset) {
  if (!meta || !meta.width || !meta.height) {
    return null;
  }

  const scale = Math.min(
    1,
    preset.maxWidth / meta.width,
    preset.maxHeight / meta.height
  );

  if (scale >= 1) {
    return null;
  }

  return {
    compressedWidth: Math.max(1, Math.round(meta.width * scale)),
    compressedHeight: Math.max(1, Math.round(meta.height * scale)),
  };
}

function compressImageOnce(filePath, preset, quality, sizeOptions) {
  return new Promise((resolve, reject) => {
    wx.compressImage({
      src: filePath,
      quality,
      ...(sizeOptions || {}),
      success(result) {
        resolve(result.tempFilePath || filePath);
      },
      fail(error) {
        reject(error);
      },
    });
  });
}

async function prepareImageForUpload(filePath, kind) {
  const preset = getUploadPreset(kind);
  const originalSize = await getFileSize(filePath);
  const meta = await getImageMeta(filePath);
  const sizeOptions = getCompressedSize(meta, preset);
  const shouldCompress =
    !isGif(filePath) &&
    wx.compressImage &&
    (Boolean(sizeOptions) ||
      (originalSize !== null && originalSize > preset.maxSize * 0.75));

  let uploadPath = filePath;

  if (shouldCompress) {
    const qualities = [
      preset.quality,
      Math.max(65, preset.quality - 10),
      Math.max(55, preset.quality - 20),
    ];

    for (let i = 0; i < qualities.length; i += 1) {
      try {
        uploadPath = await compressImageOnce(
          filePath,
          preset,
          qualities[i],
          sizeOptions
        );
      } catch (_error) {
        uploadPath = filePath;
        break;
      }

      const compressedSize = await getFileSize(uploadPath);
      if (compressedSize === null || compressedSize <= preset.maxSize) {
        break;
      }
    }
  }

  const finalSize = await getFileSize(uploadPath);
  if (finalSize !== null && finalSize > preset.maxSize) {
    throw new Error(`${preset.label}大小不能超过 ${preset.maxSize / MB}MB`);
  }

  return uploadPath;
}

function uploadFileToHost(host, filePath, params) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: host,
      filePath,
      name: 'file',
      formData: {
        key: params.key,
        token: params.uploadToken,
      },
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response);
          return;
        }

        reject(new Error(`上传失败 ${response.statusCode}`));
      },
      fail(error) {
        reject(error);
      },
    });
  });
}

async function uploadProductImage(filePath, kind) {
  const fileName = getFileName(filePath, `${kind || 'product'}.jpg`);
  const uploadPath = await prepareImageForUpload(filePath, kind);
  const params = await request({
    url: '/api/upload/qiniu-token',
    method: 'POST',
    data: {
      type: 'product',
      kind,
      fileName,
    },
    requireAuth: true,
  });

  const hosts = [params.uploadHost]
    .concat(params.fallbackUploadHosts || [])
    .filter(Boolean);

  if (hosts.length === 0 || !params.uploadToken || !params.key || !params.url) {
    throw new Error('上传配置不完整，请先配置七牛云');
  }

  let lastError = null;
  for (let i = 0; i < hosts.length; i += 1) {
    try {
      await uploadFileToHost(hosts[i], uploadPath, params);
      return params.url;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    lastError && lastError.message ? lastError.message : '图片上传失败'
  );
}

module.exports = {
  uploadProductImage,
};
