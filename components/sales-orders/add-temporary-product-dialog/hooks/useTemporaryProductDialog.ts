import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';

import type { AddTemporaryProductDialogProps } from '../types';
import {
  createTemporaryProductSchema,
  type TemporaryProductData,
} from '../validation';

export function useTemporaryProductDialog({
  open,
  onOpenChange,
  initialName = '',
  onConfirm,
  requirements,
}: AddTemporaryProductDialogProps) {
  const schema = useMemo(
    () => createTemporaryProductSchema(requirements),
    [requirements]
  );

  const form = useForm<TemporaryProductData>({
    resolver: zodResolver(schema),
    defaultValues: {
      productCode: '',
      name: '',
      specification: '',
      weight: undefined,
      unit: '',
      piecesPerUnit: undefined,
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    const initialKeyword = (initialName ?? '').trim();

    form.reset(
      {
        productCode: initialKeyword,
        name: '',
        specification: '',
        weight: undefined,
        unit: '',
        piecesPerUnit: undefined,
      },
      { keepDefaultValues: false }
    );

    setTimeout(() => {
      const requireCode = requirements?.requireCode !== false;
      if (requireCode) {
        form.setFocus('productCode');
      } else if (requirements?.requireName === true) {
        form.setFocus('name');
      }
    }, 0);
  }, [open, initialName, form, requirements]);

  const handleClose = useCallback(() => {
    form.reset();
    onOpenChange(false);
  }, [form, onOpenChange]);

  const handleSubmit = useCallback(
    (data: TemporaryProductData) => {
      onConfirm(data);
      handleClose();
    },
    [handleClose, onConfirm]
  );

  return {
    form,
    handleClose,
    handleSubmit,
  };
}
