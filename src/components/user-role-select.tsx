'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { updateUserRoleAction, type ActionState } from '@/server/actions';

const initial: ActionState = { ok: false };

const ROLES = [
  { value: 'member', label: 'زائر' },
  { value: 'operator', label: 'اپراتور میهمان‌پذیری' },
  { value: 'admin', label: 'مدیر هیئت' },
] as const;

export function UserRoleSelect({
  userId,
  currentRole,
}: {
  userId: number;
  currentRole: string;
}) {
  const [state, submit, pending] = useActionState(updateUserRoleAction, initial);

  return (
    <form action={submit} className="space-y-1">
      <div className="flex items-center gap-1.5">
        <input type="hidden" name="user_id" value={userId} readOnly />
        <select
          name="role"
          defaultValue={currentRole}
          disabled={pending}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        >
          {ROLES.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          ذخیره
        </Button>
      </div>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      {state.ok ? <p className="text-xs text-primary">نقش ذخیره شد.</p> : null}
    </form>
  );
}
