'use client';
import { Input } from '@/components/ui/input';

interface Props {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  ariaLabel: string;
}

export function HourCell({ value, onChange, disabled, ariaLabel }: Props) {
  return (
    <Input
      type="number"
      step="0.25"
      min="0"
      inputMode="decimal"
      disabled={disabled}
      value={value === 0 ? '' : value}
      onChange={(e) => {
        const n = e.target.value === '' ? 0 : Number(e.target.value);
        onChange(Number.isFinite(n) && n >= 0 ? n : 0);
      }}
      className="h-8 w-14 px-1 text-right text-sm font-mono tabular-nums"
      aria-label={ariaLabel}
    />
  );
}
