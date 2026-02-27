import { useMemo } from "react";

function normalizeHex(input: string) {
    const v = (input ?? "").trim();
    if (!v) return "#e2e8f0";
    return v.startsWith("#") ? v : `#${v}`;
}

export function MiniShirt({ color, label }: { color: string; label?: string }) {
    const safe = useMemo(() => normalizeHex(color), [color]);

    return (
        <div className="mt-2 flex items-center gap-2">
            <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden>
                <path d="M18 12 L8 18 L14 30 L22 26 L22 14 Z" fill={safe} stroke="#0f172a" strokeOpacity="0.15" strokeWidth="2" />
                <path d="M46 12 L56 18 L50 30 L42 26 L42 14 Z" fill={safe} stroke="#0f172a" strokeOpacity="0.15" strokeWidth="2" />
                <path
                    d="M22 14 C26 18 38 18 42 14 L42 52 C42 54 40 56 38 56 H26 C24 56 22 54 22 52 Z"
                    fill={safe}
                    stroke="#0f172a"
                    strokeOpacity="0.15"
                    strokeWidth="2"
                />
                <path d="M26 14 C28 20 36 20 38 14" fill="none" stroke="#0f172a" strokeOpacity="0.25" strokeWidth="3" strokeLinecap="round" />
            </svg>

            <div className="text-xs text-slate-600">
                <div className="font-medium text-slate-700">{label ?? "—"}</div>
                <div className="text-[11px] text-slate-500">{safe.toUpperCase()}</div>
            </div>
        </div>
    );
}