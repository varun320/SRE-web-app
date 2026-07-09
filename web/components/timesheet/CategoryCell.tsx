'use client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InfoHint } from '@/components/ui/info-hint';
import type { MainCategory, SubCategory } from '@/lib/types';
import { MAIN_CATEGORY_DESCRIPTIONS, subCategoryHint, subCategoryLabel } from '@/lib/categoryDescriptions';
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
  const selectedSub = subCategories.find((s) => s.id === subCategoryId);
  const mainHint = mainCategory ? MAIN_CATEGORY_DESCRIPTIONS[mainCategory] : undefined;
  const subHint = subCategoryHint(selectedSub?.name);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
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
          <SelectContent className="max-w-sm">
            {MAIN.map((m) => (
              <SelectItem key={m} value={m} className="whitespace-normal">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{m}</span>
                  <span className="text-[11px] text-[var(--color-text-muted)] leading-snug">
                    {MAIN_CATEGORY_DESCRIPTIONS[m]}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {mainHint ? <InfoHint label={mainCategory}>{mainHint}</InfoHint> : null}
      </div>

      <div className="flex items-center gap-1">
        <Select
          value={subCategoryId ?? undefined}
          onValueChange={(v) => onChange({ mainCategory, subCategoryId: v })}
          disabled={disabled || !mainCategory}
        >
          <SelectTrigger className="h-8 w-52 [&>span]:truncate [&>span]:block [&>span]:text-left">
            <SelectValue placeholder="Sub…" />
          </SelectTrigger>
          <SelectContent className="max-w-md">
            {filtered.map((s) => {
              const hint = subCategoryHint(s.name);
              return (
                <SelectItem key={s.id} value={s.id} className="whitespace-normal">
                  <div className="flex flex-col gap-0.5">
                    <span>{subCategoryLabel(s.name)}</span>
                    {hint ? (
                      <span className="text-[11px] text-[var(--color-text-muted)] leading-snug">
                        {hint}
                      </span>
                    ) : null}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {subHint && selectedSub ? <InfoHint label={selectedSub.name}>{subHint}</InfoHint> : null}
      </div>
    </div>
  );
}
