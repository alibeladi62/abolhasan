'use client';

import { JALALI_MONTH_NAMES, jalaliDaysInMonth, toPersianDigits } from '@/lib/jalali';
import { useId } from 'react';

const YEARS = Array.from({ length: 91 }, (_, i) => 1410 - i);

export function JalaliDateSelect({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const id = useId();
  const [jyRaw, jmRaw, jdRaw] = (value || '').split('-');
  const jy = Number(jyRaw) || 0;
  const jm = Number(jmRaw) || 0;
  const jd = Number(jdRaw) || 0;
  const daysInMonth = jy && jm ? jalaliDaysInMonth(jy, jm) : 31;

  const set = (nextJy: number, nextJm: number, nextJd: number) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    onChange(`${String(nextJy).padStart(4, '0')}-${pad(nextJm)}-${pad(nextJd)}`);
  };

  const selectClass =
    'h-9 flex-1 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium leading-none">
        {label}
      </label>
      <div className="flex gap-2">
        <select
          id={id}
          aria-label="روز"
          className={selectClass}
          value={jd || ''}
          onChange={(e) => set(jy, jm, Number(e.target.value))}
        >
          <option value="">روز</option>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {toPersianDigits(d)}
            </option>
          ))}
        </select>
        <select
          aria-label="ماه"
          className={selectClass}
          value={jm || ''}
          onChange={(e) => set(jy, Number(e.target.value), jd)}
        >
          <option value="">ماه</option>
          {JALALI_MONTH_NAMES.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <select
          aria-label="سال"
          className={selectClass}
          value={jy || ''}
          onChange={(e) => set(Number(e.target.value), jm, jd)}
        >
          <option value="">سال</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {toPersianDigits(y)}
            </option>
          ))}
        </select>
      </div>
      <input type="hidden" name={name} value={value} readOnly />
    </div>
  );
}
