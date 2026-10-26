'use client';

import { useEffect, useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { JalaliDateSelect } from '@/components/jalali-date-select';
import { saveProfileAction, type ActionState } from '@/server/actions';

const initialState: ActionState = { ok: false };

/** مودال محترمانه تکمیل پروفایل — بستنش مانع دیدن محتوا نمی‌شود */
export function ProfileCompletionDialog({
  defaultName,
  defaultNationalId,
  defaultCity,
  defaultBirth,
}: {
  defaultName: string;
  defaultNationalId: string;
  defaultCity: string;
  defaultBirth: string;
}) {
  const [open, setOpen] = useState(true);
  const [birth, setBirth] = useState(defaultBirth);
  const [state, formAction, isPending] = useActionState(saveProfileAction, initialState);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  // دکمه «تکمیل پروفایل» در صفحه پروفایل همین رویداد را می‌فرستد
  useEffect(() => {
    const open = () => setOpen(true);
    window.addEventListener('abol:open-profile', open);
    return () => window.removeEventListener('abol:open-profile', open);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>تکمیل پروفایل</DialogTitle>
          <DialogDescription>
            برای رزرو مهمانسرا و بهره‌مندی از خدمات، مشخصات خود را کامل کنید. بستن این پیام مانع
            دیدن محتوای سایت نمی‌شود.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">نام و نام خانوادگی</Label>
            <Input id="name" name="name" defaultValue={defaultName} placeholder="مثلاً: علی رضایی" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="national_id">کد ملی</Label>
            <Input
              id="national_id"
              name="national_id"
              defaultValue={defaultNationalId}
              inputMode="numeric"
              maxLength={10}
              className="num-latin text-right"
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">شهر</Label>
            <Input id="city" name="city" defaultValue={defaultCity} placeholder="مثلاً: نجف‌اشرف" />
          </div>
          <JalaliDateSelect
            name="birth_date_jalali"
            label="تاریخ تولد (شمسی)"
            value={birth}
            onChange={setBirth}
          />

          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              بعداً
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'در حال ذخیره…' : 'ذخیره'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
