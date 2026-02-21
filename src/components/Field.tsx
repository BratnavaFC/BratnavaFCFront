import React from 'react';

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }){
  return (
    <label className="block">
      <div className="label">{label}</div>
      <div className="mt-1">{children}</div>
      {hint ? <div className="muted mt-1">{hint}</div> : null}
    </label>
  );
}
