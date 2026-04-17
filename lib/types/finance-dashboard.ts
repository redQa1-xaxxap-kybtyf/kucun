import type { LucideIcon } from 'lucide-react';

export type PriorityCard = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  accentClassName: string;
  hint: string;
};

export type ShortcutItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

export type ShortcutGroup = {
  id: string;
  title: string;
  description: string;
  items: ShortcutItem[];
};

export type WorkbenchTone = 'urgent' | 'warning' | 'info' | 'success';

export type FinanceWorkbenchCard = {
  id: string;
  title: string;
  description: string;
  hint: string;
  href: string;
  count: number;
  amount: number;
  icon: LucideIcon;
  tone: WorkbenchTone;
};
