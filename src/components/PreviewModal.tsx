import React, { useEffect } from "react";
import { X } from "lucide-react";
import { UniformPreview } from "../domains/teamcolors/UniformPreview";

type Props = {
    open: boolean;
    onClose: () => void;
    title?: string;
    item?: any;
    isMobile?: boolean;
};

export function PreviewModal({ open, onClose, title, item, isMobile }: Props) {
    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    const name = item?.name ?? "—";
    const hex  = item?.hexValue ?? "#e2e8f0";

    return (
        <div className="fixed inset-0 z-[100]">
            {/* backdrop */}
            <button
                type="button"
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                aria-label="Fechar"
            />

            <div
                className={[
                    "absolute left-1/2 w-[92vw] max-w-sm -translate-x-1/2 shadow-2xl overflow-hidden",
                    isMobile
                        ? "bottom-0 rounded-t-3xl"
                        : "top-1/2 -translate-y-1/2 rounded-2xl",
                ].join(" ")}
                style={{ border: `1.5px solid ${hex}55` }}
            >
                {/* color strip */}
                <div className="h-1" style={{ background: hex }} />

                {/* header — dark gradient */}
                <div
                    className="px-5 py-4 flex items-center justify-between gap-3"
                    style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}
                >
                    <div className="min-w-0">
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest">
                            {title ?? "Preview do uniforme"}
                        </div>
                        <div className="text-base font-semibold text-white truncate mt-0.5">
                            {name}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                        aria-label="Fechar"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* jersey stage */}
                <div
                    className="flex items-center justify-center py-8"
                    style={{ background: "linear-gradient(160deg, #ffffff 0%, #000000 100%)" }}
                >
                    <div style={{ width: "55%", maxWidth: 160 }}>
                        <UniformPreview hex={hex} />
                    </div>
                </div>

                {/* info footer */}
                <div className="bg-white px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div
                            className="h-10 w-10 rounded-xl shrink-0"
                            style={{
                                background: hex,
                                boxShadow: `0 0 0 1px rgba(0,0,0,0.1), 0 4px 14px ${hex}66`,
                            }}
                        />
                        <div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-widest">Hex</div>
                            <div className="text-sm font-mono font-semibold text-slate-800 mt-0.5">
                                {hex.toUpperCase()}
                            </div>
                        </div>
                    </div>

                    <div className="text-right">
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest">Status</div>
                        <div
                            className="text-xs font-semibold mt-1 px-2.5 py-0.5 rounded-full inline-block"
                            style={
                                item?.isActive
                                    ? { background: `${hex}20`, color: hex, border: `1px solid ${hex}55` }
                                    : { background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0" }
                            }
                        >
                            {item?.isActive ? "Ativa" : "Inativa"}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
