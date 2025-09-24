/**
 * 时间处理工具函数测试
 */

import {
  parseDate,
  toISOString,
  formatDate,
  formatDateTime,
  formatDateTimeCN,
  formatTimeAgo,
  isValidDate,
  compareDates,
  DateTimeTransformer,
} from '../datetime';

describe('时间处理工具函数', () => {
  const testDate = new Date('2024-01-15T10:30:00.000Z');
  const testISOString = '2024-01-15T10:30:00.000Z';

  describe('parseDate', () => {
    it('应该正确解析Date对象', () => {
      const result = parseDate(testDate);
      expect(result).toEqual(testDate);
    });

    it('应该正确解析ISO字符串', () => {
      const result = parseDate(testISOString);
      expect(result?.toISOString()).toBe(testISOString);
    });

    it('应该正确解析时间戳', () => {
      const timestamp = testDate.getTime();
      const result = parseDate(timestamp);
      expect(result?.getTime()).toBe(timestamp);
    });

    it('应该处理无效输入', () => {
      expect(parseDate(null)).toBeNull();
      expect(parseDate(undefined)).toBeNull();
      expect(parseDate('invalid-date')).toBeNull();
    });
  });

  describe('toISOString', () => {
    it('应该将Date对象转换为ISO字符串', () => {
      const result = toISOString(testDate);
      expect(result).toBe(testISOString);
    });

    it('应该处理字符串输入', () => {
      const result = toISOString(testISOString);
      expect(result).toBe(testISOString);
    });

    it('应该处理无效输入', () => {
      expect(toISOString(null)).toBeNull();
      expect(toISOString('invalid')).toBeNull();
    });
  });

  describe('formatDate', () => {
    it('应该格式化日期', () => {
      const result = formatDate(testDate);
      expect(result).toBe('2024-01-15');
    });

    it('应该处理字符串输入', () => {
      const result = formatDate(testISOString);
      expect(result).toBe('2024-01-15');
    });

    it('应该处理无效输入', () => {
      expect(formatDate(null)).toBe('');
      expect(formatDate('invalid')).toBe('');
    });
  });

  describe('formatDateTime', () => {
    it('应该格式化日期时间', () => {
      const result = formatDateTime(testDate);
      // 注意：这里的结果会根据时区不同而不同
      expect(result).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
    });
  });

  describe('formatDateTimeCN', () => {
    it('应该格式化中文日期时间', () => {
      const result = formatDateTimeCN(testDate);
      expect(result).toMatch(/\d{4}年\d{2}月\d{2}日 \d{2}:\d{2}/);
    });
  });

  describe('formatTimeAgo', () => {
    it('应该格式化相对时间', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const result = formatTimeAgo(oneHourAgo);
      expect(result).toContain('小时前');
    });
  });

  describe('isValidDate', () => {
    it('应该验证有效日期', () => {
      expect(isValidDate(testDate)).toBe(true);
      expect(isValidDate(testISOString)).toBe(true);
    });

    it('应该识别无效日期', () => {
      expect(isValidDate(null)).toBe(false);
      expect(isValidDate('invalid')).toBe(false);
    });
  });

  describe('compareDates', () => {
    const date1 = new Date('2024-01-15T10:00:00.000Z');
    const date2 = new Date('2024-01-15T11:00:00.000Z');

    it('应该比较日期', () => {
      expect(compareDates(date1, date2)).toBe(-1);
      expect(compareDates(date2, date1)).toBe(1);
      expect(compareDates(date1, date1)).toBe(0);
    });

    it('应该处理无效输入', () => {
      expect(compareDates(null, date1)).toBeNull();
      expect(compareDates(date1, null)).toBeNull();
    });
  });

  describe('DateTimeTransformer', () => {
    const testObject = {
      id: '1',
      name: 'Test',
      createdAt: testDate,
      updatedAt: testDate,
      other: 'value',
    };

    it('应该转换对象中的时间字段', () => {
      const result = DateTimeTransformer.transformObject(testObject);
      
      expect(result.createdAt).toBe(testISOString);
      expect(result.updatedAt).toBe(testISOString);
      expect(result.id).toBe('1');
      expect(result.name).toBe('Test');
      expect(result.other).toBe('value');
    });

    it('应该转换数组中的时间字段', () => {
      const testArray = [testObject, { ...testObject, id: '2' }];
      const result = DateTimeTransformer.transformArray(testArray);
      
      expect(result).toHaveLength(2);
      expect(result[0].createdAt).toBe(testISOString);
      expect(result[1].createdAt).toBe(testISOString);
    });

    it('应该深度转换嵌套对象', () => {
      const nestedObject = {
        data: testObject,
        items: [testObject],
        createdAt: testDate,
      };

      const result = DateTimeTransformer.transformNested(nestedObject);
      
      expect(result.createdAt).toBe(testISOString);
      expect(result.data.createdAt).toBe(testISOString);
      expect(result.items[0].createdAt).toBe(testISOString);
    });

    it('应该处理自定义时间字段', () => {
      const customObject = {
        id: '1',
        publishedAt: testDate,
        expiredAt: testDate,
      };

      const result = DateTimeTransformer.transformObject(
        customObject,
        ['publishedAt', 'expiredAt']
      );

      expect(result.publishedAt).toBe(testISOString);
      expect(result.expiredAt).toBe(testISOString);
    });
  });
});
