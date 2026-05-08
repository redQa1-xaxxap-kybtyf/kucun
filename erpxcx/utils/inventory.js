const { request } = require('./request');

function getInventories(params = {}) {
  const query = Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== '')
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');

  return request({
    url: `/api/inventory${query ? `?${query}` : ''}`,
    miniProgramHeader: false,
    requireAuth: true,
  });
}

module.exports = {
  getInventories,
};
