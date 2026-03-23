import React from 'react';
import { Check } from 'lucide-react';

export type Step = { key: string; title: string; subtitle?: string; done?: boolean; };

export function Stepper({ steps, activeKey }: { steps: Step[]; activeKey: string }) {
  const activeIdx = steps.findIndex(s => s.key === activeKey);

  return (
    <div className="card p-4">
      {/* scrollable track */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex items-start" style={{ minWidth: `${steps.length * 76}px` }}>
          {steps.map((s, idx) => {
            const active  = s.key === activeKey;
            const done    = s.done ?? false;
            const isLast  = idx === steps.length - 1;

            return (
              <React.Fragment key={s.key}>
                {/* step node */}
                <div className="flex flex-col items-center gap-1.5 flex-none" style={{ width: 76 }}>
                  {/* circle */}
                  <div className={[
                    "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200",
                    active ? "bg-slate-900 text-white ring-4 ring-slate-200 dark:bg-white dark:text-slate-900 dark:ring-slate-700"
                           : done  ? "bg-emerald-500 text-white"
                                   : "bg-slate-100 text-slate-400 border border-slate-200 dark:bg-slate-800 dark:border-slate-700",
                  ].join(" ")}>
                    {done ? <Check size={13} strokeWidth={3} /> : idx + 1}
                  </div>

                  {/* label */}
                  <div className="text-center px-0.5">
                    <div className={[
                      "text-[11px] font-semibold leading-tight",
                      active ? "text-slate-900 dark:text-white"
                             : done  ? "text-emerald-600"
                                     : "text-slate-400",
                    ].join(" ")}>
                      {s.title}
                    </div>
                    {s.subtitle && (
                      <div className="text-[9px] text-slate-400 leading-tight mt-0.5 hidden sm:block">
                        {s.subtitle}
                      </div>
                    )}
                  </div>
                </div>

                {/* connector */}
                {!isLast && (
                  <div
                    className="flex-1 h-px mt-3.5 mx-0.5 rounded-full transition-colors duration-300"
                    style={{ background: done ? '#10b981' : '#e2e8f0', minWidth: 8 }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* mobile: active step summary */}
      <div className="mt-2.5 flex items-center justify-center gap-1.5 sm:hidden">
        <span className="text-[11px] text-slate-400 dark:text-slate-500">Etapa</span>
        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100">
          {activeIdx + 1}<span className="font-normal text-slate-400 dark:text-slate-500">/{steps.length}</span>
        </span>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">—</span>
        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{steps[activeIdx]?.title}</span>
      </div>
    </div>
  );
}
