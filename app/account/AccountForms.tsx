'use client';
import { useActionState } from 'react';
import { changePassword, saveProfile, setPassword } from './actions';
import { Alert, LangSeg, Submit } from '@/components/ui';
import type { Dict } from '@/lib/i18n/ui';
import type { Profile } from '@/lib/types';

export function ProfileForm({ t, p }: { t: Dict; p: Profile }) {
  const [state, action] = useActionState(saveProfile, null);
  return (
    <form action={action} className="card">
      <Alert state={state} />
      <label className="f">{t.email}</label>
      <input className="in" value={p.email} disabled />
      <label className="f">{t.fullName}</label>
      <input className="in" name="full_name" defaultValue={p.full_name} autoComplete="name" />
      <label className="f">{t.phone}</label>
      <input className="in" name="phone" type="tel" defaultValue={p.phone} autoComplete="tel" />
      <label className="f">{t.uiLang}</label>
      <LangSeg name="ui_lang" value={p.ui_lang} />
      <div style={{ height: 14 }} />
      <Submit pendingText={t.saving}>{t.save}</Submit>
    </form>
  );
}

export function PasswordForm({ t }: { t: Dict }) {
  const [state, action] = useActionState(changePassword, null);
  return (
    <form action={action} className="card">
      <Alert state={state} />
      <label className="f">{t.currentPassword}</label>
      <input className="in" name="current_password" type="password" autoComplete="current-password" required />
      <label className="f">{t.newPassword}</label>
      <input className="in" name="new_password" type="password" autoComplete="new-password" minLength={8} required />
      <label className="f">{t.confirmPassword}</label>
      <input className="in" name="confirm_password" type="password" autoComplete="new-password" minLength={8} required />
      <div style={{ height: 14 }} />
      <Submit pendingText={t.saving}>{t.changePassword}</Submit>
    </form>
  );
}

export function SetPasswordForm({ t, name }: { t: Dict; name: string }) {
  const [state, action] = useActionState(setPassword, null);
  return (
    <form action={action}>
      <Alert state={state} />
      <label className="f">{t.fullName}</label>
      <input className="in" name="full_name" defaultValue={name} autoComplete="name" />
      <label className="f">{t.newPassword}</label>
      <input className="in" name="new_password" type="password" autoComplete="new-password" minLength={8} required />
      <label className="f">{t.confirmPassword}</label>
      <input className="in" name="confirm_password" type="password" autoComplete="new-password" minLength={8} required />
      <div style={{ height: 14 }} />
      <Submit pendingText={t.saving}>{t.save}</Submit>
    </form>
  );
}
