'use client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { MainCategory, SubCategory } from '@/lib/types';
import { useMemo } from 'react';

interface Props {
  mainCategory: MainCategory | '';
  subCategoryId: string | null;
  subCategories: readonly SubCategory[];
  onChange: (next: { mainCategory: MainCategory | ''; subCategoryId: string | null }) => void;
  disabled?: boolean;
}

const MAIN: MainCategory[] = ['Project', 'Admin', 'Office & Sales'];

export function CategoryCell({ mainCategory, subCategoryId, subCategories, onChange, disabled }: Props) {
  const filtered = useMemo(
    () => subCategories.filter((s) => s.main_category === mainCategory),
    [subCategories, mainCategory],
  );
  return (
    <div className="flex gap-2">
      <Select
        value={mainCategory || undefined}
        onValueChange={(v) => onChange({ mainCategory: v as MainCategory, subCategoryId: null })}
        disabled={disabled}
      >
        <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Main…" /></SelectTrigger>
        <SelectContent>
          {MAIN.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select
        value={subCategoryId ?? undefined}
        onValueChange={(v) => onChange({ mainCategory, subCategoryId: v })}
        disabled={disabled || !mainCategory}
      >
        <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Sub…" /></SelectTrigger>
        <SelectContent>
          {filtered.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
