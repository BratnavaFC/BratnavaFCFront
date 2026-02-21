import React from 'react';

export type Step = { key: string; title: string; subtitle?: string; done?: boolean; };

export function Stepper({ steps, activeKey }: { steps: Step[]; activeKey: string }){
  return (
    <div className="card p-4">
      <div className="flex flex-wrap gap-2">
        {steps.map((s, idx) => {
          const active = s.key === activeKey;
          return (
            <div key={s.key} className={[
              "flex items-center gap-3 rounded-xl border px-3 py-2",
              active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white",
            ].join(" ")}>
              <div className={[
                "h-6 w-6 rounded-full grid place-items-center text-xs font-bold",
                active ? "bg-white text-slate-900" : (s.done ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600")
              ].join(" ")}>
                {idx+1}
              </div>
              <div>
                <div className="text-sm font-semibold">{s.title}</div>
                {s.subtitle ? <div className={active ? "text-xs text-slate-200" : "text-xs text-slate-500"}>{s.subtitle}</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
