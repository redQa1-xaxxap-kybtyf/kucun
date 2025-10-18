import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';

import type { AddTemporaryProductDialogProps } from '../types';
import {
  temporaryProductSchema,
  type TemporaryProductData,
} from '../validation';

export function useTemporaryProductDialog({
  open,
  onOpenChange,
  initialName = '',
  onConfirm,
}: AddTemporaryProductDialogProps) {
  const form = useForm<TemporaryProductData>({
    resolver: zodResolver(temporaryProductSchema),
    defaultValues: {
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

    form.reset({
      name: initialName ?? '',
      specification: '',
      weight: undefined,
      unit: '',
      piecesPerUnit: undefined,
    });

    setTimeout(() => {
      form.setFocus('name');
    }, 0);
  }, [open, initialName, form]);

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
