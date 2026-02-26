import React, { useEffect } from "react";
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
    const hex = item?.hexValue ?? "#e2e8f0";

    return (
        <div className="fixed inset-0 z-[100]">
            {/* backdrop */}
            <button
                type="button"
                onClick={onClose}
                className="absolute inset-0 bg-black/40"
                aria-label="Fechar"
            />

            <div
                className={[
                    "absolute left-1/2 w-[92vw] max-w-xl -translate-x-1/2 bg-white shadow-xl border border-slate-200",
                    isMobile
                        ? "bottom-0 rounded-t-3xl"
                        : "top-1/2 -translate-y-1/2 rounded-3xl",
                ].join(" ")}
            >
                <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-sm text-slate-500">
                            {title ?? "Preview do uniforme"}
                        </div>
                        <div className="font-semibold truncate">{name}</div>
                    </div>

                    <button className="btn" onClick={onClose}>
                        Fechar
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    <UniformPreview hex={hex} className="w-full" />

                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl border" style={{ background: hex }} />
                        <div className="flex flex-col">
                            <div className="text-sm text-slate-600">Hex</div>
                            <div className="font-semibold">{hex}</div>
                        </div>
                    </div>

                    <div className="text-xs text-slate-500">
                        Status: {item?.isActive ? "ativa" : "inativa"}
                    </div>
                </div>
            </div>
        </div>
    );
}