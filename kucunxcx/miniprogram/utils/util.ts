export const formatTime = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();

  const dateStr = [year, month, day].map(formatNumber).join('/');
  const timeStr = [hour, minute, second].map(formatNumber).join(':');

  return `${dateStr} ${timeStr}`;
};

const formatNumber = (n: number) => {
  const s = n.toString();
  return s[1] ? s : `0${s}`;
};
