import React from 'react';

export function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }){
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
