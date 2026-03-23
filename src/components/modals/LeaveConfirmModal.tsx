// src/components/modals/LeaveConfirmModal.tsx
import { useEffect, useState } from "react";
import { Loader2, LogOut, X } from "lucide-react";

export function LeaveConfirmModal({
    open,
    onClose,
    onConfirm,
}: {
    open: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}) {
    const [loading, setLoading] = useState(false);

    // ESC key handler
    useEffect(() => {
        if (!open) return;
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [open, onClose]);

    async function handleConfirm() {
        setLoading(true);
        try {
            await onConfirm();
        } finally {
            setLoading(false);
        }
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50">
            {/* backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
                onClick={onClose}
            />

            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 shadow-2xl dark:shadow-none dark:ring-1 dark:ring-slate-700 border dark:border-slate-700 flex flex-col overflow-hidden">

                    {/* header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b dark:border-slate-700 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                                <LogOut size={17} />
                            </div>
                            <div className="text-base font-semibold text-slate-900 dark:text-white">Sair da patota</div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-9 w-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center"
                            aria-label="Fechar"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* body */}
                    <div className="px-5 py-5">
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            Tem certeza? Seu perfil será convertido para convidado e você perderá o status de mensalista.
                        </p>
                    </div>

                    {/* footer */}
                    <div className="px-5 pb-5 flex items-center justify-end gap-2 shrink-0">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className="btn flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
                            onClick={handleConfirm}
                            disabled={loading}
                        >
                            {loading
                                ? <><Loader2 size={15} className="animate-spin" /> Saindo...</>
                                : "Sair"
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LeaveConfirmModal;
