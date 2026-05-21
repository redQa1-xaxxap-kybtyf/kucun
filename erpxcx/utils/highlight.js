function splitByKeyword(text, keyword) {
  const value = String(text == null ? '' : text);
  const term = String(keyword == null ? '' : keyword).trim();
  if (!term) {
    return value ? [{ text: value, hit: false }] : [];
  }

  const lower = value.toLowerCase();
  const needle = term.toLowerCase();
  if (!needle) {
    return value ? [{ text: value, hit: false }] : [];
  }

  const parts = [];
  let cursor = 0;
  let index = lower.indexOf(needle, cursor);
  while (index >= 0) {
    if (index > cursor) {
      parts.push({ text: value.slice(cursor, index), hit: false });
    }
    parts.push({ text: value.slice(index, index + term.length), hit: true });
    cursor = index + term.length;
    index = lower.indexOf(needle, cursor);
  }
  if (cursor < value.length) {
    parts.push({ text: value.slice(cursor), hit: false });
  }
  return parts;
}

module.exports = {
  splitByKeyword,
};
