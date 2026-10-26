'use client';

/** فرم پنل محتوا از روی فهرست فیلدها ساخته می‌شود؛ اعتبارسنجی اصلی سمت سرور است */
import { useActionState, useState } from 'react';
import { JalaliDateSelect } from '@/components/jalali-date-select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { renderMarkdown } from '@/lib/markdown';
import type { ActionState } from '@/server/actions';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'markdown'
  | 'select'
  | 'checkbox'
  | 'file'
  | 'jalali'
  | 'time'
  | 'number';

export type FieldSpec = {
  name: string;
  label: string;
  type: FieldType;
  defaultValue?: string | number | null;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  accept?: string;
  options?: { value: string; label: string }[];
  /** گزینه خالی کشویی، مثلاً «— بدون دسته —» */
  emptyOption?: string;
};

const inputClass =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';
const areaClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-7 outline-none focus-visible:ring-2 focus-visible:ring-ring';

const MD_PLACEHOLDER = ['# تیتر', 'متن **مضخّم** و *مورب*', '- مورد فهرست', '> نقل‌قول'].join('\n');

export function ContentForm({
  action,
  fields,
  submitLabel = 'ذخیره',
  cancelHref,
  title,
  description,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  fields: FieldSpec[];
  submitLabel?: string;
  cancelHref?: string;
  title: string;
  description?: string;
}) {
  const [state, submit, isPending] = useActionState(action, { ok: false } as ActionState);
  const controlled = fields.filter((field) => field.type === 'markdown' || field.type === 'jalali');
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(controlled.map((field) => [field.name, String(field.defaultValue ?? '')])),
  );

  const set = (name: string, value: string) => setValues((prev) => ({ ...prev, [name]: value }));

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </CardHeader>
      <CardContent>
        <form action={submit} className="space-y-4">
          {fields.map((field) => {
            if (field.type === 'checkbox') {
              return (
                <label key={field.name} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={field.name}
                    defaultChecked={Number(field.defaultValue ?? 0) === 1}
                    className="size-4 accent-[#0e6b5c]"
                  />
                  <span>{field.label}</span>
                  {field.hint ? <span className="text-xs text-muted-foreground">({field.hint})</span> : null}
                </label>
              );
            }

            return (
              <div key={field.name} className="space-y-1.5">
                {field.type === 'jalali' ? (
                  <JalaliDateSelect
                    name={field.name}
                    label={field.label}
                    value={values[field.name] ?? ''}
                    onChange={(next) => set(field.name, next)}
                  />
                ) : (
                  <>
                    <Label htmlFor={field.name}>
                      {field.label}
                      {field.required ? <span className="text-destructive"> *</span> : null}
                    </Label>

                    {field.type === 'text' ? (
                      <Input
                        id={field.name}
                        name={field.name}
                        type="text"
                        required={field.required}
                        placeholder={field.placeholder}
                        defaultValue={String(field.defaultValue ?? '')}
                      />
                    ) : null}

                    {field.type === 'number' ? (
                      <Input
                        id={field.name}
                        name={field.name}
                        type="number"
                        className="num-latin"
                        placeholder={field.placeholder}
                        defaultValue={field.defaultValue === null || field.defaultValue === undefined ? '' : String(field.defaultValue)}
                      />
                    ) : null}

                    {field.type === 'time' ? (
                      <Input
                        id={field.name}
                        name={field.name}
                        type="time"
                        className="num-latin"
                        defaultValue={String(field.defaultValue ?? '')}
                      />
                    ) : null}

                    {field.type === 'file' ? (
                      <input
                        id={field.name}
                        name={field.name}
                        type="file"
                        accept={field.accept}
                        required={field.required}
                        className={`block w-full text-sm file:ms-0 file:me-3 file:rounded-md file:border-0 file:bg-jade file:px-4 file:py-2 file:text-white ${inputClass} py-1.5 h-auto`}
                      />
                    ) : null}

                    {field.type === 'select' ? (
                      <select
                        id={field.name}
                        name={field.name}
                        defaultValue={String(field.defaultValue ?? '')}
                        className={inputClass}
                      >
                        {field.emptyOption !== undefined ? (
                          <option value="">{field.emptyOption}</option>
                        ) : null}
                        {field.options?.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : null}

                    {field.type === 'textarea' ? (
                      <textarea
                        id={field.name}
                        name={field.name}
                        rows={3}
                        placeholder={field.placeholder}
                        defaultValue={String(field.defaultValue ?? '')}
                        className={areaClass}
                      />
                    ) : null}

                    {field.type === 'markdown' ? (
                      <div className="grid gap-3 lg:grid-cols-2">
                        <textarea
                          id={field.name}
                          name={field.name}
                          rows={12}
                          required={field.required}
                          dir="rtl"
                          placeholder={MD_PLACEHOLDER}
                          value={values[field.name] ?? ''}
                          onChange={(event) => set(field.name, event.target.value)}
                          className={`${areaClass} font-mono text-[13px]`}
                        />
                        <div className="min-h-40 rounded-md border border-border bg-muted/30 p-3">
                          <p className="mb-2 text-xs font-bold text-muted-foreground">پیش‌نمایش</p>
                          {/* متن فقط از renderMarkdown می‌گذرد که خروجی را sanitizeHtml پاک‌سازی می‌کند */}
                          <div
                            className="article-body text-sm"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(values[field.name] ?? '') }}
                          />
                        </div>
                      </div>
                    ) : null}

                    {field.hint ? <p className="text-xs text-muted-foreground">{field.hint}</p> : null}
                  </>
                )}
              </div>
            );
          })}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'در حال ذخیره…' : submitLabel}
            </Button>
            {cancelHref ? (
              <Button variant="ghost" asChild>
                <a href={cancelHref}>انصراف</a>
              </Button>
            ) : null}
            {state.error ? <span className="text-sm text-destructive">{state.error}</span> : null}
            {state.ok ? <span className="text-sm text-primary">{state.info ?? 'ذخیره شد.'}</span> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
