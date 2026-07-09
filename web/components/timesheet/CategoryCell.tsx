'use client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { MainCategory, SubCategory } from '@/lib/types';
import { subCategoryLabel } from '@/lib/categoryDescriptions';
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
  const subById = useMemo(() => new Map(subCategories.map((s) => [s.id, s])), [subCategories]);

  return (
    <div className="flex items-center gap-2">
      <Select
        value={mainCategory || undefined}
        onValueChange={(v) => onChange({ mainCategory: v as MainCategory, subCategoryId: null })}
        disabled={disabled}
      >
        <SelectTrigger
          className="h-8 w-32"
          style={mainCategory ? {
            background: `var(--color-cat-${mainCategory === 'Project' ? 'project' : mainCategory === 'Admin' ? 'admin' : 'office'}-bg)`,
            color: `var(--color-cat-${mainCategory === 'Project' ? 'project' : mainCategory === 'Admin' ? 'admin' : 'office'}-fg)`,
            borderColor: `var(--color-cat-${mainCategory === 'Project' ? 'project' : mainCategory === 'Admin' ? 'admin' : 'office'}-border)`,
          } : undefined}
        >
          <SelectValue placeholder="Main…" />
        </SelectTrigger>
        <SelectContent>
          {MAIN.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select
        value={subCategoryId ?? undefined}
        onValueChange={(v) => onChange({ mainCategory, subCategoryId: v })}
        disabled={disabled || !mainCategory}
      >
        <SelectTrigger className="h-8 w-52 [&>span]:truncate [&>span]:block [&>span]:text-left">
          <SelectValue placeholder="Sub…">
            {(v: unknown) => {
              if (typeof v !== 'string' || !v) return 'Sub…';
              const s = subById.get(v);
              return s ? subCategoryLabel(s.name) : 'Sub…';
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-w-xs">
          {filtered.map((s) => (
            <SelectItem key={s.id} value={s.id} className="whitespace-nowrap">
              {subCategoryLabel(s.name)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
