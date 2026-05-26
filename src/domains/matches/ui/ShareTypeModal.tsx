import { useEffect } from "react";
import { Globe, Lock, X } from "lucide-react";

type Props = {
    title?: string;
    onInternal: () => void;
    onExternal: () => void;
    onClose: () => void;
};

export function ShareTypeModal({ title = "Compartilhar link", onInternal, onExternal, onClose }: Props) {
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="relative w-full max-w-xs bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6" onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-3.5 right-3.5 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                    <X size={14} className="text-slate-500" />
                </button>

                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 pr-6">{title}</h2>
                <p className="text-[11px] text-slate-400 mt-0.5 mb-5">Escolha o tipo de acesso</p>

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onInternal}
                        className="flex-1 flex flex-col items-center gap-2 py-4 px-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition group"
                    >
                        <div className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition">
                            <Lock size={16} className="text-slate-600 dark:text-slate-300" />
                        </div>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Interno</span>
                        <span className="text-[10px] text-slate-400 text-center leading-tight">Requer<br />login</span>
                    </button>

                    <button
                        type="button"
                        onClick={onExternal}
                        className="flex-1 flex flex-col items-center gap-2 py-4 px-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition group"
                    >
                        <div className="w-9 h-9 flex items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 transition">
                            <Globe size={16} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Externo</span>
                        <span className="text-[10px] text-slate-400 text-center leading-tight">Acesso<br />público</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
