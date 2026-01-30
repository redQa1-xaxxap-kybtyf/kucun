import {
  formatDate,
  formatDateTime,
  formatTimeAgo,
  parseDate,
  parseLocalDateString,
} from '@/lib/utils/datetime';

describe('datetime utils', () => {
  describe('parseDate', () => {
    it('parses yyyy-MM-dd as local date', () => {
      const parsed = parseDate('2025-01-14');
      expect(parsed).not.toBeNull();
      expect(parsed?.getFullYear()).toBe(2025);
      expect(parsed?.getMonth()).toBe(0);
      expect(parsed?.getDate()).toBe(14);
    });

    it('parses yyyy-MM-dd HH:mm:ss as local datetime', () => {
      const parsed = parseDate('2025-01-14 10:30:45');
      expect(parsed).not.toBeNull();
      expect(parsed?.getFullYear()).toBe(2025);
      expect(parsed?.getMonth()).toBe(0);
      expect(parsed?.getDate()).toBe(14);
      expect(parsed?.getHours()).toBe(10);
      expect(parsed?.getMinutes()).toBe(30);
      expect(parsed?.getSeconds()).toBe(45);
    });
  });

  describe('parseLocalDateString', () => {
    it('parses yyyy-MM-dd as local date', () => {
      const parsed = parseLocalDateString('2025-01-14');
      expect(parsed).not.toBeNull();
      expect(parsed?.getFullYear()).toBe(2025);
      expect(parsed?.getMonth()).toBe(0);
      expect(parsed?.getDate()).toBe(14);
    });
  });

  describe('formatting', () => {
    it('formatDate/formatDateTime supports project defaults', () => {
      const date = new Date(2025, 0, 14, 10, 30, 45);
      expect(formatDate(date)).toBe('2025-01-14');
      expect(formatDateTime(date)).toBe('2025-01-14 10:30:45');
    });
  });

  describe('formatTimeAgo', () => {
    beforeAll(() => {
      jest.useFakeTimers();
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it('returns relative time within 24 hours', () => {
      jest.setSystemTime(new Date(2025, 0, 14, 10, 0, 0));

      expect(formatTimeAgo(new Date(2025, 0, 14, 9, 59, 30))).toBe('刚刚');
      expect(formatTimeAgo(new Date(2025, 0, 14, 9, 55, 0))).toBe('5分钟前');
      expect(formatTimeAgo(new Date(2025, 0, 14, 7, 0, 0))).toBe('3小时前');
    });
  });
});

