const { request } = require('./request');

function getFileName(filePath, fallbackName) {
  const name = String(filePath || '').split('/').pop() || fallbackName;
  return name.includes('.') ? name : `${name}.jpg`;
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
      await uploadFileToHost(hosts[i], filePath, params);
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
