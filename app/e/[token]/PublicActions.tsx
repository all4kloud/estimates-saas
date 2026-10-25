'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { docDict } from '@/lib/i18n/doc';
import type { Lang } from '@/lib/types';
import { acceptEstimate, declineEstimate } from './actions';

export function AcceptBox({ token, lang }: { token: string; lang: Lang; total: string }) {
  const L = docDict(lang);
  const router = useRouter();
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'accept' | 'decline'>('accept');
  const [reason, setReason] = useState('');
  const [pending, start] = useTransition();

  if (mode === 'decline') {
    return (
      <div className="card">
        <label className="f">{L.declineReason}</label>
        <textarea className="in" value={reason} onChange={e => setReason(e.target.value)} />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn ghost grow" onClick={() => setMode('accept')}>←</button>
          <button className="btn danger grow" disabled={pending} onClick={() => start(async () => { await declineEstimate(token, reason); router.refresh(); })}>
            {pending ? L.processing : L.confirmDecline}</button>
        </div>
      </div>
    );
  }
  return (
    <div className="card">
      <label className="f">{L.yourName}</label>
      <input className="in" value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
      <div className="small muted" style={{ marginTop: 6 }}>{L.acceptLegal}</div>
      <button className="btn teal block" style={{ marginTop: 10 }} disabled={pending || name.trim().length < 2}
        onClick={() => start(async () => { await acceptEstimate(token, name); router.refresh(); })}>
        {pending ? L.processing : `✓ ${L.acceptBtn}`}</button>
      <button className="btn ghost block sm" style={{ marginTop: 8 }} onClick={() => setMode('decline')}>{L.declineBtn}</button>
    </div>
  );
}

export function PayButton({ token, label, busy }: { token: string; label: string; busy: string }) {
  const [pending, setPending] = useState(false);
  return (
    <form action={`/e/${token}/pay`} method="post" onSubmit={() => setPending(true)}>
      <button className="btn teal block" type="submit" disabled={pending}>{pending ? busy : label}</button>
    </form>
  );
}
