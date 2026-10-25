'use client';
import { useFormStatus } from 'react-dom';
import { useEffect, useState } from 'react';

export function Submit({ children, className = 'btn teal block', pendingText }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={pending} type="submit">{pending ? pendingText || '…' : children}</button>;
}

export type FormState = { error?: string; ok?: string } | null;

export function Alert({ state }: { state: FormState }) {
  if (!state) return null;
  if (state.error) return <div className="alert err" role="alert">{state.error}</div>;
  if (state.ok) return <div className="alert ok" role="status">{state.ok}</div>;
  return null;
}

/** Selector EN/ES que escribe en un input oculto (para formularios de servidor). */
export function LangSeg({ name, value, labels }: { name: string; value: string; labels?: [string, string] }) {
  const [v, setV] = useState(value || 'en');
  return (
    <div className="seg">
      <input type="hidden" name={name} value={v} />
      <button type="button" className={v === 'en' ? 'on' : ''} onClick={() => setV('en')}>{labels?.[0] || 'English'}</button>
      <button type="button" className={v === 'es' ? 'on' : ''} onClick={() => setV('es')}>{labels?.[1] || 'Español'}</button>
    </div>
  );
}

export function Toast({ msg, onDone }: { msg: string | null; onDone: () => void }) {
  useEffect(() => { if (!msg) return; const id = setTimeout(onDone, 2600); return () => clearTimeout(id); }, [msg, onDone]);
  if (!msg) return null;
  return <div className="toast">{msg}</div>;
}

export function RegisterSW() {
  useEffect(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {}); }, []);
  return null;
}
