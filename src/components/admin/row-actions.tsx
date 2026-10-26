'use client';

/** کناره‌ی هر ردیف فهرست: کلید انتشار و دکمه حذف با تأیید */
import { Button } from '@/components/ui/button';
import { deleteContentAction, togglePublishedAction, type ContentEntity } from '@/server/content-actions';

export function PublishToggle({
  entity,
  id,
  checked,
  label,
}: {
  entity: ContentEntity;
  id: number;
  checked: boolean;
  label?: string;
}) {
  return (
    <form action={togglePublishedAction} className="flex items-center gap-1.5">
      <input type="hidden" name="entity" value={entity} />
      <input type="hidden" name="id" value={id} />
      <label className="flex items-center gap-1.5 text-xs">
        <input type="checkbox" name="is_published" defaultChecked={checked} className="size-4 accent-[#0e6b5c]" />
        <span className="whitespace-nowrap">{label ?? 'منتشر'}</span>
      </label>
      <Button type="submit" size="sm" variant="outline">
        ثبت
      </Button>
    </form>
  );
}

export function DeleteButton({
  entity,
  id,
  label,
  confirmText = 'برای حذف این مورد مطمئن هستید؟',
}: {
  entity: ContentEntity;
  id: number;
  label?: string;
  confirmText?: string;
}) {
  return (
    <form
      action={deleteContentAction}
      onSubmit={(event) => {
        if (!window.confirm(confirmText)) event.preventDefault();
      }}
    >
      <input type="hidden" name="entity" value={entity} />
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="outline" className="border-destructive text-destructive">
        {label ?? 'حذف'}
      </Button>
    </form>
  );
}
