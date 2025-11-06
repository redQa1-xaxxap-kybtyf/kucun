'use client';

import { useMemo } from 'react';

import { Input } from '@/components/ui/input';

type DateTimePickerProps = {
  value?: Date;
  onChange: (value?: Date) => void;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  placeholder?: string;
};

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function formatDateToLocalInput(date?: Date) {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function DateTimePicker({
  value,
  onChange,
  disabled,
  id,
  name,
  className,
  placeholder,
}: DateTimePickerProps) {
  const inputValue = useMemo(() => formatDateToLocalInput(value), [value]);

  return (
    <Input
      type="datetime-local"
      value={inputValue}
      onChange={e => {
        const v = e.target.value;
        onChange(v ? new Date(v) : undefined);
      }}
      disabled={disabled}
      id={id}
      name={name}
      className={className}
      placeholder={placeholder}
    />
  );
}

export default DateTimePicker;
