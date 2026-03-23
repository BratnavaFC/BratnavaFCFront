import { useEffect } from "react";
import { X, CalendarCheck, Clock, Pencil, Trash2 } from "lucide-react";
import ModalBackdrop from "./ModalBackdrop";
import type { CalendarEvent } from "../../types/calendar";

function EventDetailModal({
    event, isAdmin, onClose, onEdit, onDelete,
}: {
    event: CalendarEvent;
    isAdmin: boolean;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const isMatchPast = event.type === "match" && (() => {
        const pad = (n: number) => String(n).padStart(2, "0");
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
        return event.date < todayStr;
    })();
    const icon = event.type === "birthday" ? "🎂"
        : event.type === "match"   ? (isMatchPast ? "✅" : "⚽")
        : event.type === "holiday" ? "🎉"
        : (event.categoryIcon ?? "📅");
    const typeLabel = event.type === "birthday" ? "Aniversário"
        : event.type === "match"   ? (isMatchPast ? "Jogo encerrado" : "Jogo")
        : event.type === "holiday" ? "Feriado"
        : "Evento";

    const dateLabel = (() => {
        if (!event.date) return "—";
        const [y, mo, d] = event.date.split("-").map(Number);
        return new Date(y, mo - 1, d).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    })();

    return (
        <ModalBackdrop onClose={onClose}>
            <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-800 shadow-2xl dark:shadow-none dark:ring-1 dark:ring-slate-700 border-t sm:border flex flex-col overflow-hidden">
                {/* Drag indicator (mobile only) */}
                <div className="sm:hidden flex justify-center pt-2 pb-0">
                    <div className="w-8 h-1 rounded-full bg-slate-200 dark:bg-slate-600" />
                </div>
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-lg shrink-0">
                            {icon}
                        </div>
                        <div>
                            <div className="text-base font-semibold text-slate-900 dark:text-white leading-tight">{event.title}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{typeLabel}{event.categoryName && event.type === "manual" ? ` · ${event.categoryName}` : ""}</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="h-9 w-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white" type="button">
                        <X size={18} />
                    </button>
                </div>

                <div className="px-4 sm:px-5 py-4 space-y-3">
                    <div className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                        <CalendarCheck size={16} className="shrink-0 mt-0.5 text-slate-400 dark:text-slate-500" />
                        <span className="capitalize">{dateLabel}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                        <Clock size={16} className="shrink-0 text-slate-400 dark:text-slate-500" />
                        <span>{event.timeTBD ? "Horário a confirmar" : (event.time ?? "—")}</span>
                    </div>
                    {event.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2 border border-slate-100 dark:border-slate-700">
                            {event.description}
                        </p>
                    )}
                </div>

                {isAdmin && event.type === "manual" && (
                    <div className="px-4 sm:px-5 py-3 border-t dark:border-slate-700 flex gap-2 justify-end">
                        <button
                            onClick={onDelete}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-sm font-medium hover:bg-rose-100 transition-colors"
                            type="button"
                        >
                            <Trash2 size={14} />Excluir
                        </button>
                        <button
                            onClick={onEdit}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                            type="button"
                        >
                            <Pencil size={14} />Editar
                        </button>
                    </div>
                )}
                {/* Safe area bottom padding (mobile) */}
                <div className="sm:hidden h-safe-area-bottom" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} />
            </div>
        </ModalBackdrop>
    );
}

export default EventDetailModal;
