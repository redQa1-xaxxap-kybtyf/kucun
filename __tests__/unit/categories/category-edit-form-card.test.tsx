import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';

import {
  CategoryEditFormCard,
  type ParentCategory,
} from '@/components/categories/category-edit-form-card';
import type { UpdateCategoryData } from '@/lib/validations/category';

function renderEditFormCard(options?: {
  parentCategories?: ParentCategory[];
  currentParentCategory?: ParentCategory;
  onSubmit?: (data: UpdateCategoryData) => void;
  defaultParentId?: UpdateCategoryData['parentId'];
}) {
  const onSubmit = options?.onSubmit ?? jest.fn();
  const parentCategories = options?.parentCategories ?? [];
  const currentParentCategory = options?.currentParentCategory;
  const defaultParentId = options?.defaultParentId;

  function TestHarness() {
    const form = useForm<UpdateCategoryData>({
      defaultValues: {
        id: 'category-child-001',
        name: '柔抛砖',
        parentId: defaultParentId,
        sortOrder: 10,
      },
    });

    return (
      <CategoryEditFormCard
        form={form}
        onSubmit={onSubmit}
        onCancel={jest.fn()}
        parentCategories={parentCategories}
        currentParentCategory={currentParentCategory}
        isParentOptionsLoading={false}
        isSubmitting={false}
        parentSearchTerm=""
        onParentSearchChange={jest.fn()}
      />
    );
  }

  render(<TestHarness />);
  return { onSubmit };
}

describe('CategoryEditFormCard', () => {
  test('编辑二级分类时会直接显示当前一级分类，无需重新选择', async () => {
    renderEditFormCard({
      parentCategories: [],
      currentParentCategory: {
        id: 'category-parent-001',
        name: '瓷砖',
        code: 'CT',
        fullPath: '瓷砖',
        depth: 1,
        parent: null,
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveTextContent('瓷砖');
    });
  });

  test('编辑页首次挂载父级值未回填时，也会直接显示当前一级分类', async () => {
    renderEditFormCard({
      defaultParentId: undefined,
      parentCategories: [],
      currentParentCategory: {
        id: 'category-parent-001',
        name: '瓷砖',
        code: 'CT',
        fullPath: '瓷砖',
        depth: 1,
        parent: null,
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveTextContent('瓷砖');
    });
  });

  test('不重新点击一级分类也能保留原父级并提交', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderEditFormCard({
      parentCategories: [
        {
          id: 'category-parent-001',
          name: '瓷砖',
          code: 'CT',
          fullPath: '瓷砖',
          depth: 1,
          parent: null,
        },
      ],
      currentParentCategory: {
        id: 'category-parent-001',
        name: '瓷砖',
        code: 'CT',
        fullPath: '瓷砖',
        depth: 1,
        parent: null,
      },
    });

    await user.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
      expect(onSubmit.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          id: 'category-child-001',
          name: '柔抛砖',
          parentId: 'category-parent-001',
          sortOrder: 10,
        })
      );
    });
  });
});
