'use client';

import { Button } from '@/components/ui/button';

/** اگر کاربر مودال را بست، از همین‌جا دوباره باز می‌شود (بدون ریلود صفحه) */
export function ProfileCompletionOpener() {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => window.dispatchEvent(new Event('abol:open-profile'))}
    >
      تکمیل پروفایل
    </Button>
  );
}
