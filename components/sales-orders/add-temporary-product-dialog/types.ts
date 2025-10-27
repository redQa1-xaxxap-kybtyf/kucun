import type { TemporaryProductRequirements } from '../smart-product-search/types';

import type { TemporaryProductData } from './validation';

export interface AddTemporaryProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  onConfirm: (data: TemporaryProductData) => void;
  requirements?: TemporaryProductRequirements;
}

export const UNIT_OPTIONS = [
  { value: '片', label: '片' },
  { value: '件', label: '件' },
];
