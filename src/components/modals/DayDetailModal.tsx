import React, { useEffect } from "react";
import { X, Plus } from "lucide-react";
import ModalBackdrop from "./ModalBackdrop";

interface CalendarEvent {
    id?: string;
    type: "manual" | "birthday" | "match" | "holiday";
    title: string;
    date: string;
    time?: string | null;
    timeTBD: boolean;
    categoryId?: string | null;
    categoryName?: string | null;
    categoryColor?: string | null;
    categoryIcon?: string | null;
    sourceId?: string | null;
    description?: string | null;
}

function pad(n: number) { return String(n).padStart(2, "0"); }

function toDateStr(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function eventStyle(ev: CalendarEvent): { bg: string; text: string; border: string } {
    if (ev.type === "birthday")
        return { bg: "bg-pink-100", text: "text-pink-800", border: "border-pink-200" };
    if (ev.type === "match")
        return { bg: "bg-green-100", text: "text-green-800", border: "border-green-200" };
    if (ev.type === "holiday")
        return { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-200" };
    if (ev.categoryColor) {
        return { bg: "bg-[var(--ev-bg)]", text: "text-[var(--ev-text)]", border: "border-[var(--ev-border)]" };
    }
    return { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" };
}

function eventCSSVars(ev: CalendarEvent): React.CSSProperties {
    if (ev.type === "manual" && ev.categoryColor) {
        const hex = ev.categoryColor;
        return {
            "--ev-bg": `${hex}22`,
            "--ev-text": hex,
            "--ev-border": `${hex}55`,
        } as React.CSSProperties;
    }
    return {};
}

function EventPill({ ev, onClick, compact = false }: { ev: CalendarEvent; onClick: () => void; compact?: boolean }) {
    const s = eventStyle(ev);
    const icon = ev.type === "birthday" ? "🎂"
        : ev.type === "match"   ? "⚽"
        : ev.type === "holiday" ? "🎉"
        : (ev.categoryIcon ?? "📅");
    return (
        <button
            onClick={onClick}
            title={ev.title}
            style={eventCSSVars(ev)}
            className={`w-full text-left truncate rounded px-1 py-0.5 text-[11px] font-medium border ${s.bg} ${s.text} ${s.border} hover:opacity-80 transition-opacity`}
        >
            <span className="mr-0.5">{icon}</span>
            {!compact && ev.time && !ev.timeTBD && <span className="mr-1 font-normal opacity-70">{ev.time}</span>}
            {ev.title}
        </button>
    );
}

function DayDetailModal({
    day, events, isAdmin, onClose, onEventClick, onNewEvent,
}: {
    day: Date;
    events: CalendarEvent[];
    isAdmin: boolean;
    onClose: () => void;
    onEventClick: (ev: CalendarEvent) => void;
    onNewEvent: (date: string) => void;
}) {
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const dateLabel = day.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    return (
        <ModalBackdrop onClose={onClose}>
            <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border-t sm:border flex flex-col overflow-hidden">
                {/* Drag indicator (mobile only) */}
                <div className="sm:hidden flex justify-center pt-2 pb-0">
                    <div className="w-8 h-1 rounded-full bg-slate-200" />
                </div>
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b">
                    <div className="text-base font-semibold text-slate-900 capitalize">{dateLabel}</div>
                    <button onClick={onClose} className="h-9 w-9 rounded-xl hover:bg-slate-100 flex items-center justify-center" type="button">
                        <X size={18} />
                    </button>
                </div>
                <div className="px-4 sm:px-5 py-3 space-y-2 overflow-y-auto max-h-[55vh] sm:max-h-72">
                    {events.length === 0 && (
                        <p className="text-sm text-slate-400 text-center py-4">Nenhum evento neste dia.</p>
                    )}
                    {events.map((ev, i) => (
                        <EventPill key={`${ev.id ?? ev.type}_${i}`} ev={ev} onClick={() => { onClose(); onEventClick(ev); }} />
                    ))}
                </div>
                {isAdmin && (
                    <div className="px-4 sm:px-5 py-3 border-t">
                        <button
                            onClick={() => { onClose(); onNewEvent(toDateStr(day)); }}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition-colors"
                            type="button"
                        >
                            <Plus size={14} />Novo evento neste dia
                        </button>
                    </div>
                )}
                <div className="sm:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} />
            </div>
        </ModalBackdrop>
    );
}

export default DayDetailModal;
