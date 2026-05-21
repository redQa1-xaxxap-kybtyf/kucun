const { request } = require('./request');

function submitGoodsRequest(data) {
  return request({
    url: '/api/miniprogram/goods-requests',
    method: 'POST',
    data,
    retry: 0,
  });
}

function getGoodsRequest(lookupToken) {
  return request({
    url: `/api/miniprogram/goods-requests?lookupToken=${encodeURIComponent(
      lookupToken
    )}`,
    retry: 0,
  });
}

module.exports = {
  getGoodsRequest,
  submitGoodsRequest,
};
