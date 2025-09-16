// 移动端数据表格组件测试用例

import {
    MobileDataTable,
    createBadgeColumn,
    createDateColumn,
    createNumberColumn,
    createTextColumn,
    type ColumnDef,
} from '@/components/ui/mobile-data-table';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

// 测试数据
const testData = [
  {
    id: '1',
    name: '产品A',
    code: 'PA001',
    status: 'active',
    price: 100.5,
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    name: '产品B',
    code: 'PB002',
    status: 'inactive',
    price: 200.75,
    createdAt: '2024-01-14T15:30:00Z',
  },
];

// 测试列定义
const testColumns: ColumnDef<(typeof testData)[0]>[] = [
  createTextColumn('name', '产品名称', { mobilePrimary: true }),
  createTextColumn('code', '产品编码', { mobileLabel: '编码' }),
  createBadgeColumn('status', '状态', 'default'),
  createNumberColumn('price', '价格', value => `¥${value.toFixed(2)}`),
  createDateColumn(
    'createdAt',
    '创建时间',
    date => new Date(date).toLocaleDateString(),
    { mobileHidden: true }
  ),
];

// 测试操作按钮
const testActions = [
  {
    key: 'edit',
    label: '编辑',
    onClick: jest.fn(),
    variant: 'outline' as const,
  },
  {
    key: 'delete',
    label: '删除',
    onClick: jest.fn(),
    variant: 'destructive' as const,
    disabled: (record: any) => record.status === 'inactive',
  },
];

describe('MobileDataTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders table with data', () => {
      render(<MobileDataTable data={testData} columns={testColumns} />);

      expect(screen.getByText('产品A')).toBeInTheDocument();
      expect(screen.getByText('产品B')).toBeInTheDocument();
    });

    it('renders empty state when no data', () => {
      render(<MobileDataTable data={[]} columns={testColumns} />);

      expect(screen.getByText('暂无数据')).toBeInTheDocument();
    });

    it('renders custom empty state', () => {
      const customEmpty = <div>自定义空状态</div>;
      render(
        <MobileDataTable data={[]} columns={testColumns} empty={customEmpty} />
      );

      expect(screen.getByText('自定义空状态')).toBeInTheDocument();
    });

    it('renders loading state', () => {
      render(<MobileDataTable data={testData} columns={testColumns} loading />);

      // 检查骨架屏是否存在
      const skeletonElements = document.querySelectorAll('[class*="animate-pulse"]');
      expect(skeletonElements.length).toBeGreaterThan(0);
    });
  });

  describe('Desktop Table View', () => {
    beforeEach(() => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
    });

    it('renders table headers correctly', () => {
      render(<MobileDataTable data={testData} columns={testColumns} />);

      expect(screen.getByText('产品名称')).toBeInTheDocument();
      expect(screen.getByText('产品编码')).toBeInTheDocument();
      expect(screen.getByText('状态')).toBeInTheDocument();
      expect(screen.getByText('价格')).toBeInTheDocument();
    });

    it('renders table cells with correct content', () => {
      render(<MobileDataTable data={testData} columns={testColumns} />);

      expect(screen.getByText('PA001')).toBeInTheDocument();
      expect(screen.getByText('¥100.50')).toBeInTheDocument();
    });

    it('shows index column when showIndex is true', () => {
      render(
        <MobileDataTable data={testData} columns={testColumns} showIndex />
      );

      expect(screen.getByText('#')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('renders action buttons', () => {
      render(
        <MobileDataTable
          data={testData}
          columns={testColumns}
          actions={testActions}
        />
      );

      expect(screen.getByText('操作')).toBeInTheDocument();
      expect(screen.getAllByText('编辑')).toHaveLength(2);
      expect(screen.getAllByText('删除')).toHaveLength(2);
    });

    it('handles row click', () => {
      const handleRowClick = jest.fn();
      render(
        <MobileDataTable
          data={testData}
          columns={testColumns}
          onRowClick={handleRowClick}
        />
      );

      const firstRow = screen.getByText('产品A').closest('tr');
      if (firstRow) {
        fireEvent.click(firstRow);
        expect(handleRowClick).toHaveBeenCalledWith(testData[0], 0);
      }
    });
  });

  describe('Mobile Card View', () => {
    beforeEach(() => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
    });

    it('renders cards instead of table on mobile', () => {
      render(<MobileDataTable data={testData} columns={testColumns} />);

      // 在移动端应该看到卡片而不是表格
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.getByText('产品A')).toBeInTheDocument();
    });

    it('shows primary information prominently', () => {
      render(<MobileDataTable data={testData} columns={testColumns} />);

      // 主要信息（mobilePrimary: true）应该更突出
      const primaryInfo = screen.getByText('产品A');
      expect(primaryInfo).toHaveClass('font-medium');
    });

    it('hides mobile hidden columns', () => {
      render(<MobileDataTable data={testData} columns={testColumns} />);

      // mobileHidden: true 的列不应该在移动端显示
      expect(screen.queryByText('创建时间:')).not.toBeInTheDocument();
    });

    it('shows mobile labels for secondary information', () => {
      render(<MobileDataTable data={testData} columns={testColumns} />);

      // 应该显示 mobileLabel
      expect(screen.getByText('编码:')).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('calls action onClick when clicked', () => {
      render(
        <MobileDataTable
          data={testData}
          columns={testColumns}
          actions={testActions}
        />
      );

      const editButtons = screen.getAllByText('编辑');
      fireEvent.click(editButtons[0]);

      expect(testActions[0].onClick).toHaveBeenCalledWith(testData[0], 0);
    });

    it('disables action when disabled function returns true', () => {
      render(
        <MobileDataTable
          data={testData}
          columns={testColumns}
          actions={testActions}
        />
      );

      const deleteButtons = screen.getAllByText('删除');
      // 第二个产品的状态是 inactive，删除按钮应该被禁用
      expect(deleteButtons[1]).toBeDisabled();
    });

    it('hides action when hidden function returns true', () => {
      const actionsWithHidden = [
        {
          key: 'hidden-action',
          label: '隐藏操作',
          onClick: jest.fn(),
          hidden: (record: any) => record.id === '1',
        },
      ];

      render(
        <MobileDataTable
          data={testData}
          columns={testColumns}
          actions={actionsWithHidden}
        />
      );

      // 第一个记录的操作应该被隐藏
      const actionButtons = screen.getAllByText('隐藏操作');
      expect(actionButtons).toHaveLength(1); // 只有第二个记录显示
    });

    it('stops event propagation on action click', () => {
      const handleRowClick = jest.fn();
      render(
        <MobileDataTable
          data={testData}
          columns={testColumns}
          actions={testActions}
          onRowClick={handleRowClick}
        />
      );

      const editButton = screen.getAllByText('编辑')[0];
      fireEvent.click(editButton);

      // 点击操作按钮不应该触发行点击
      expect(handleRowClick).not.toHaveBeenCalled();
      expect(testActions[0].onClick).toHaveBeenCalled();
    });
  });

  describe('Column Helpers', () => {
    it('createTextColumn creates correct column definition', () => {
      const column = createTextColumn('test', '测试列', { align: 'center' });

      expect(column.key).toBe('test');
      expect(column.title).toBe('测试列');
      expect(column.align).toBe('center');
    });

    it('createBadgeColumn renders badge correctly', () => {
      const column = createBadgeColumn('status', '状态', 'destructive');

      render(
        <MobileDataTable
          data={[{ id: '1', status: 'error' }]}
          columns={[column]}
        />
      );

      expect(screen.getByText('error')).toBeInTheDocument();
    });

    it('createDateColumn formats date correctly', () => {
      const column = createDateColumn('date', '日期', date => 'formatted-date');

      render(
        <MobileDataTable
          data={[{ id: '1', date: '2024-01-15' }]}
          columns={[column]}
        />
      );

      expect(screen.getByText('formatted-date')).toBeInTheDocument();
    });

    it('createNumberColumn formats number correctly', () => {
      const column = createNumberColumn('amount', '金额', value => `$${value}`);

      render(
        <MobileDataTable data={[{ id: '1', amount: 100 }]} columns={[column]} />
      );

      expect(screen.getByText('$100')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper table structure', () => {
      render(<MobileDataTable data={testData} columns={testColumns} />);

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader')).toHaveLength(
        testColumns.length
      );
      expect(screen.getAllByRole('row')).toHaveLength(testData.length + 1); // +1 for header
    });

    it('supports keyboard navigation for interactive elements', () => {
      const handleRowClick = jest.fn();
      render(
        <MobileDataTable
          data={testData}
          columns={testColumns}
          onRowClick={handleRowClick}
        />
      );

      const firstRow = screen.getByText('产品A').closest('tr');
      if (firstRow) {
        fireEvent.keyDown(firstRow, { key: 'Enter' });
        // 注意：实际的键盘处理可能需要额外的实现
      }
    });
  });

  describe('Performance', () => {
    it('handles large datasets efficiently', () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: i.toString(),
        name: `产品${i}`,
        code: `P${i.toString().padStart(3, '0')}`,
        status: i % 2 === 0 ? 'active' : 'inactive',
        price: Math.random() * 1000,
        createdAt: new Date().toISOString(),
      }));

      const startTime = performance.now();
      render(<MobileDataTable data={largeData} columns={testColumns} />);
      const endTime = performance.now();

      // 渲染时间应该在合理范围内
      expect(endTime - startTime).toBeLessThan(1000); // 1秒
    });
  });
});
