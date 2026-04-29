const { getProduct } = require('../../utils/catalog');

const POSTER_WIDTH = 750;
const POSTER_HEIGHT = 1180;

function getProductShareTitle(product) {
  if (!product) return '外墙罗马柱产品';

  return (
    product.shareTitle ||
    [
      product.code,
      product.name,
      product.specification,
      product.packageText,
      product.weightText,
    ]
      .filter(Boolean)
      .join('｜') ||
    '外墙罗马柱产品'
  );
}

function setFont(ctx, size, weight = 400) {
  ctx.font = `${weight} ${size}px sans-serif`;
}

function drawRoundRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function fillRoundRect(ctx, x, y, width, height, radius, color) {
  ctx.fillStyle = color;
  drawRoundRectPath(ctx, x, y, width, height, radius);
  ctx.fill();
}

function drawCoverImage(ctx, image, x, y, width, height, radius) {
  ctx.save();
  drawRoundRectPath(ctx, x, y, width, height, radius);
  ctx.clip();

  const imageRatio = image.width / image.height;
  const targetRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;
  let drawX = x;
  let drawY = y;

  if (imageRatio > targetRatio) {
    drawWidth = height * imageRatio;
    drawX = x - (drawWidth - width) / 2;
  } else {
    drawHeight = width / imageRatio;
    drawY = y - (drawHeight - height) / 2;
  }

  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();
}

function loadCanvasImage(canvas, url) {
  return new Promise(resolve => {
    if (!url) {
      resolve(null);
      return;
    }

    wx.getImageInfo({
      src: url,
      success(result) {
        const image = canvas.createImage();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = result.path;
      },
      fail() {
        resolve(null);
      },
    });
  });
}

function buildLines(ctx, text, maxWidth, maxLines) {
  const chars = String(text || '').split('');
  const lines = [];
  let line = '';

  for (const char of chars) {
    const nextLine = `${line}${char}`;
    if (ctx.measureText(nextLine).width > maxWidth && line) {
      lines.push(line);
      line = char;
      if (lines.length === maxLines) break;
    } else {
      line = nextLine;
    }
  }

  if (line && lines.length < maxLines) {
    lines.push(line);
  }

  if (lines.length === maxLines && chars.join('').length > lines.join('').length) {
    const lastIndex = lines.length - 1;
    let lastLine = lines[lastIndex];
    while (lastLine && ctx.measureText(`${lastLine}...`).width > maxWidth) {
      lastLine = lastLine.slice(0, -1);
    }
    lines[lastIndex] = `${lastLine}...`;
  }

  return lines;
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const lines = buildLines(ctx, text, maxWidth, maxLines);
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
  return y + lines.length * lineHeight;
}

function drawPill(ctx, text, x, y) {
  setFont(ctx, 24, 700);
  const width = Math.ceil(ctx.measureText(text).width + 34);
  fillRoundRect(ctx, x, y, width, 46, 23, '#f6f1e8');
  ctx.fillStyle = '#7a6b58';
  ctx.fillText(text, x + 17, y + 11);
  return x + width + 12;
}

function drawInfoRow(ctx, label, value, x, y, width) {
  fillRoundRect(ctx, x, y, width, 78, 18, '#f8f6f1');
  setFont(ctx, 22, 700);
  ctx.fillStyle = '#8a8175';
  ctx.fillText(label, x + 18, y + 15);

  setFont(ctx, 28, 800);
  ctx.fillStyle = '#1f2328';
  const text = value || '未填写';
  const maxWidth = width - 116;
  const lines = buildLines(ctx, text, maxWidth, 1);
  ctx.fillText(lines[0] || text, x + 98, y + 20);
}

function drawPosterPlaceholder(ctx, x, y, width, height) {
  fillRoundRect(ctx, x, y, width, height, 28, '#efe8dc');
  setFont(ctx, 32, 800);
  ctx.fillStyle = '#9a9388';
  ctx.textAlign = 'center';
  ctx.fillText('暂无产品图', x + width / 2, y + height / 2 - 16);
  ctx.textAlign = 'left';
}

async function drawPoster(canvas, ctx, product) {
  const imageUrl =
    product.thumbnailUrl ||
    (product.imageUrls && product.imageUrls[0]) ||
    '';
  const image = await loadCanvasImage(canvas, imageUrl);

  ctx.clearRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);
  ctx.fillStyle = '#f8f6f1';
  ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);
  fillRoundRect(ctx, 28, 28, 694, 1124, 34, '#ffffff');

  setFont(ctx, 28, 800);
  ctx.fillStyle = '#27594f';
  ctx.fillText('外墙罗马柱图册', 58, 62);
  setFont(ctx, 22, 700);
  ctx.fillStyle = '#8a8175';
  ctx.fillText('产品海报', 58, 99);

  if (image) {
    drawCoverImage(ctx, image, 58, 136, 634, 540, 28);
  } else {
    drawPosterPlaceholder(ctx, 58, 136, 634, 540);
  }

  let tagX = 58;
  tagX = drawPill(ctx, product.colorSeries.name, tagX, 710);
  drawPill(ctx, product.componentType.label, tagX, 710);

  setFont(ctx, 42, 900);
  ctx.fillStyle = '#1f2328';
  const titleEndY = drawWrappedText(
    ctx,
    product.name,
    58,
    776,
    634,
    54,
    2
  );

  const rowWidth = 634;
  let rowY = titleEndY + 22;
  drawInfoRow(ctx, '型号', product.code, 58, rowY, rowWidth);
  rowY += 92;
  drawInfoRow(ctx, '规格', product.specification || '未填写', 58, rowY, rowWidth);
  rowY += 92;
  drawInfoRow(ctx, '包装', product.packageText || '未填写', 58, rowY, rowWidth);
  rowY += 92;
  drawInfoRow(ctx, '重量', product.weightText || '未填写', 58, rowY, rowWidth);

  setFont(ctx, 22, 700);
  ctx.fillStyle = '#8a8175';
  ctx.fillText('产品信息以实物与确认单为准', 58, 1106);
}

Page({
  data: {
    canvasStyleHeight: 540,
    canvasStyleWidth: 343,
    drawing: false,
    error: '',
    loading: true,
    posterPath: '',
    product: null,
    productId: '',
    saving: false,
  },

  onLoad(options) {
    const system = wx.getSystemInfoSync();
    const canvasStyleWidth = Math.min(system.windowWidth - 48, 360);
    const canvasStyleHeight = Math.round(
      (canvasStyleWidth * POSTER_HEIGHT) / POSTER_WIDTH
    );

    this.setData({
      canvasStyleHeight,
      canvasStyleWidth,
      productId: options.id || '',
    });
    this.loadProduct();
  },

  onReady() {
    wx.createSelectorQuery()
      .select('#posterCanvas')
      .fields({ node: true, size: true })
      .exec(result => {
        const canvas = result && result[0] && result[0].node;
        if (!canvas) {
          this.setData({ error: '海报画布初始化失败', loading: false });
          return;
        }

        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        canvas.width = POSTER_WIDTH;
        canvas.height = POSTER_HEIGHT;
        this.tryRenderPoster();
      });
  },

  onShareAppMessage() {
    const product = this.data.product;
    return {
      title: getProductShareTitle(product),
      path: `/pages/product/detail?id=${this.data.productId}`,
      imageUrl:
        product && product.thumbnailUrl ? product.thumbnailUrl : undefined,
    };
  },

  onShareTimeline() {
    const product = this.data.product;
    return {
      title: getProductShareTitle(product),
      query: `id=${this.data.productId}`,
      imageUrl:
        product && product.thumbnailUrl ? product.thumbnailUrl : undefined,
    };
  },

  async loadProduct() {
    this.setData({ error: '', loading: true });

    try {
      const product = await getProduct(this.data.productId);
      this.setData({ product });
      this.tryRenderPoster();
    } catch (error) {
      this.setData({
        error: error.message || '产品加载失败',
        loading: false,
      });
    }
  },

  async tryRenderPoster() {
    if (!this.canvas || !this.ctx || !this.data.product || this.data.drawing) {
      return;
    }

    this.setData({ drawing: true, loading: false, posterPath: '' });
    try {
      await drawPoster(this.canvas, this.ctx, this.data.product);
      const posterPath = await this.createPosterFile();
      this.setData({ posterPath });
    } catch (error) {
      this.setData({ error: error.message || '海报生成失败' });
    } finally {
      this.setData({ drawing: false, loading: false });
    }
  },

  createPosterFile() {
    return new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvas: this.canvas,
        destHeight: POSTER_HEIGHT,
        destWidth: POSTER_WIDTH,
        fileType: 'jpg',
        quality: 0.95,
        success: result => resolve(result.tempFilePath),
        fail: reject,
      });
    });
  },

  onPreviewPoster() {
    if (!this.data.posterPath) return;

    wx.previewImage({
      current: this.data.posterPath,
      urls: [this.data.posterPath],
    });
  },

  async onSavePoster() {
    if (!this.data.posterPath) {
      await this.tryRenderPoster();
    }
    if (!this.data.posterPath) return;

    this.setData({ saving: true });
    wx.saveImageToPhotosAlbum({
      filePath: this.data.posterPath,
      success: () => {
        wx.showToast({ title: '已保存到相册' });
      },
      fail: error => {
        const message = error.errMsg || '';
        if (message.includes('auth') || message.includes('authorize')) {
          wx.showModal({
            title: '需要相册权限',
            content: '请允许保存到相册，才能保存产品海报。',
            confirmText: '去设置',
            success: result => {
              if (result.confirm) wx.openSetting();
            },
          });
          return;
        }

        wx.showToast({
          title: '保存失败',
          icon: 'none',
        });
      },
      complete: () => {
        this.setData({ saving: false });
      },
    });
  },
});
