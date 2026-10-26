'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { requestOtpAction, verifyOtpAction, type ActionState } from '@/server/actions';

const initial: ActionState = { ok: false };

export function LoginForm({ simulatorEnabled }: { simulatorEnabled: boolean }) {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [devCode, setDevCode] = useState('');

  const [otpState, requestOtp, otpPending] = useActionState(requestOtpAction, initial);
  const [verifyState, verifyOtpSubmit, verifyPending] = useActionState(verifyOtpAction, initial);

  useEffect(() => {
    if (otpState.ok) setStep('code');
    if (otpState.code) setDevCode(otpState.code);
  }, [otpState]);

  useEffect(() => {
    if (verifyState.ok) {
      router.replace('/profile');
      router.refresh();
    }
  }, [verifyState, router]);

  const busy = otpPending || verifyPending;

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>ورود به سایت هیئت</CardTitle>
        <CardDescription>
          شماره موبایل خود را وارد کنید؛ کد یک‌بارمصرف پیامکی را وارد نمایید. رمز عبور لازم نیست.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 'phone' ? (
          <form
            action={async (formData) => {
              setPhone(String(formData.get('phone') ?? ''));
              setDevCode('');
              await requestOtp(formData);
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="phone">شماره موبایل</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={phone}
                inputMode="numeric"
                maxLength={11}
                placeholder="09xxxxxxxxx"
                className="num-latin text-right"
                dir="ltr"
              />
            </div>
            <FieldMessage state={otpState} />
            <Button type="submit" className="w-full" disabled={busy}>
              {otpPending ? 'در حال ارسال…' : 'دریافت کد پیامکی'}
            </Button>
          </form>
        ) : (
          <form action={verifyOtpSubmit} className="space-y-3">
            <input type="hidden" name="phone" value={phone} readOnly />
            <div className="space-y-1.5">
              <Label htmlFor="code">کد ۶ رقمی</Label>
              <Input
                id="code"
                name="code"
                defaultValue={devCode && simulatorEnabled ? devCode : ''}
                inputMode="numeric"
                maxLength={6}
                className="num-latin text-right tracking-widest"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                شماره: <span className="num-latin">{phone}</span>
                <button
                  type="button"
                  className="ms-2 text-primary underline"
                  onClick={() => {
                    setStep('phone');
                    setDevCode('');
                  }}
                >
                  تغییر شماره
                </button>
              </p>
            </div>
            {simulatorEnabled && devCode ? (
              <div className="rounded-md border border-dashed border-gold bg-gold-soft px-3 py-2 text-sm">
                <b>شبیه‌ساز پیامک (فقط در dev):</b> <span className="num-latin">{devCode}</span>
              </div>
            ) : null}
            <FieldMessage state={verifyState} />
            <Button type="submit" className="w-full" disabled={busy}>
              {verifyPending ? 'در حال بررسی…' : 'ورود'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function FieldMessage({ state }: { state: ActionState }) {
  if (state.error) return <p className="text-sm text-destructive">{state.error}</p>;
  if (state.ok && state.info) return <p className="text-sm text-primary">{state.info}</p>;
  return null;
}
