import { useEffect, useState, useCallback } from "react";
import {
    ChevronLeft, ChevronRight, Plus, Settings2, CalendarCheck, Loader2,
} from "lucide-react";
import useAccountStore from "../auth/accountStore";
import { CalendarApi } from "../api/endpoints";
import { extractApiError } from "../lib/apiError";
import { toast } from "sonner";
import EventDetailModal from "../components/modals/EventDetailModal";
import CreateEditEventModal from "../components/modals/CreateEditEventModal";
import CategoryManagerModal from "../components/modals/CategoryManagerModal";
import DayDetailModal from "../components/modals/DayDetailModal";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ViewMode = "month" | "week" | "day";

interface CalendarEvent {
    id?: string;
    type: "manual" | "birthday" | "match" | "holiday";
    title: string;
    date: string;        // "YYYY-MM-DD"
    time?: string | null;
    timeTBD: boolean;
    categoryId?: string | null;
    categoryName?: string | null;
    categoryColor?: string | null;
    categoryIcon?: string | null;
    sourceId?: string | null;
    description?: string | null;
}

interface CalendarCategory {
    id: string;
    name: string;
    color?: string | null;
    icon?: string | null;
    isSystem: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, "0"); }

function toDateStr(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getRangeForView(view: ViewMode, cursor: Date): { start: Date; end: Date } {
    const y = cursor.getFullYear(), m = cursor.getMonth(), day = cursor.getDate();
    if (view === "month") {
        return {
            start: new Date(y, m, 1),
            end:   new Date(y, m + 1, 0),
        };
    }
    if (view === "week") {
        const d = new Date(y, m, day);
        // Monday = 0 offset
        const dow = d.getDay(); // 0=Sun, 1=Mon...6=Sat
        const diffToMon = (dow === 0 ? -6 : 1 - dow);
        const mon = new Date(d); mon.setDate(day + diffToMon);
        const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
        return { start: mon, end: sun };
    }
    // day
    const d = new Date(y, m, day);
    return { start: d, end: d };
}

function getMonthWeeks(year: number, month: number): Date[][] {
    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);
    // Offset to Monday
    let startDow = firstDay.getDay(); // 0=Sun
    if (startDow === 0) startDow = 7;
    const startDate = new Date(year, month, 1 - (startDow - 1));

    const weeks: Date[][] = [];
    let cur = new Date(startDate);
    while (cur <= lastDay || weeks.length < 1) {
        const week: Date[] = [];
        for (let i = 0; i < 7; i++) {
            week.push(new Date(cur));
            cur.setDate(cur.getDate() + 1);
        }
        weeks.push(week);
        if (cur > lastDay && weeks.length >= 4) break;
    }
    return weeks;
}

function getWeekDays(cursor: Date): Date[] {
    const { start } = getRangeForView("week", cursor);
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start); d.setDate(start.getDate() + i); return d;
    });
}

function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth()    === b.getMonth() &&
           a.getDate()     === b.getDate();
}

function isToday(d: Date) { return isSameDay(d, new Date()); }

function formatMonthTitle(cursor: Date) {
    return cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function formatWeekTitle(cursor: Date) {
    const { start, end } = getRangeForView("week", cursor);
    if (start.getMonth() === end.getMonth())
        return `${start.getDate()}–${end.getDate()} ${start.toLocaleDateString("pt-BR", { month: "short" })} ${start.getFullYear()}`;
    return `${start.getDate()} ${start.toLocaleDateString("pt-BR", { month: "short" })} – ${end.getDate()} ${end.toLocaleDateString("pt-BR", { month: "short" })} ${end.getFullYear()}`;
}

function formatDayTitle(cursor: Date) {
    return cursor.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

function formatDayTitleShort(cursor: Date) {
    return cursor.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

function prevCursor(view: ViewMode, cursor: Date): Date {
    const d = new Date(cursor);
    if (view === "month") d.setMonth(d.getMonth() - 1);
    else if (view === "week") d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    return d;
}

function nextCursor(view: ViewMode, cursor: Date): Date {
    const d = new Date(cursor);
    if (view === "month") d.setMonth(d.getMonth() + 1);
    else if (view === "week") d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    return d;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event styling
// ─────────────────────────────────────────────────────────────────────────────

function eventStyle(ev: CalendarEvent): { bg: string; text: string; border: string } {
    if (ev.type === "birthday")
        return { bg: "bg-pink-100", text: "text-pink-800", border: "border-pink-200" };
    if (ev.type === "match")
        return { bg: "bg-green-100", text: "text-green-800", border: "border-green-200" };
    if (ev.type === "holiday")
        return { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-200" };
    // manual: use category color if available
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

// ─────────────────────────────────────────────────────────────────────────────
// Modal helpers
// ─────────────────────────────────────────────────────────────────────────────

function cls(...xs: (string | false | null | undefined)[]) { return xs.filter(Boolean).join(" "); }

// ─────────────────────────────────────────────────────────────────────────────
// MonthView
// ─────────────────────────────────────────────────────────────────────────────

function MonthView({
    cursor, events, isAdmin, onDayClick,
}: {
    cursor: Date;
    events: CalendarEvent[];
    isAdmin: boolean;
    onDayClick: (day: Date, dayEvents: CalendarEvent[]) => void;
}) {
    const weeks = getMonthWeeks(cursor.getFullYear(), cursor.getMonth());
    const dayNamesFull  = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    const dayNamesShort = ["S",   "T",   "Q",   "Q",   "S",   "S",   "D"  ];

    function dayEvents(day: Date) {
        const ds = toDateStr(day);
        return events.filter(e => e.date === ds);
    }

    return (
        <div className="flex-1 flex flex-col min-h-0">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b">
                {dayNamesFull.map((d, i) => (
                    <div key={d} className="py-1.5 sm:py-2 text-center">
                        <span className="sm:hidden text-[11px] font-semibold text-slate-500">{dayNamesShort[i]}</span>
                        <span className="hidden sm:inline text-xs font-semibold text-slate-500">{d}</span>
                    </div>
                ))}
            </div>

            {/* Weeks grid */}
            <div className="flex-1 min-h-0 grid overflow-hidden" style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}>
                {weeks.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7 min-h-0">
                        {week.map((day, di) => {
                            const isCurrentMonth = day.getMonth() === cursor.getMonth();
                            const dayEvs = dayEvents(day);
                            return (
                                <button
                                    key={di}
                                    type="button"
                                    onClick={() => onDayClick(day, dayEvs)}
                                    className={cls(
                                        "border-r border-b last:border-r-0 p-0.5 sm:p-1 text-left flex flex-col items-start gap-0.5 overflow-hidden hover:bg-slate-50 transition-colors",
                                        !isCurrentMonth && "bg-slate-50/50",
                                    )}
                                >
                                    {/* Day number */}
                                    <span className={cls(
                                        "h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center rounded-full text-[11px] sm:text-xs font-semibold mb-0.5",
                                        isToday(day) ? "bg-slate-900 text-white" : isCurrentMonth ? "text-slate-900" : "text-slate-300",
                                    )}>
                                        {day.getDate()}
                                    </span>

                                    {/* Mobile: 1 pill + "+N"; Desktop: 2 pills + "+N" */}
                                    {dayEvs.slice(0, 1).map((ev, i) => (
                                        <div key={i} className="w-full">
                                            <EventPill ev={ev} onClick={() => {}} compact />
                                        </div>
                                    ))}
                                    {dayEvs.length > 1 && (
                                        <div className="hidden sm:block w-full">
                                            <EventPill ev={dayEvs[1]} onClick={() => {}} compact />
                                        </div>
                                    )}
                                    {/* +N more */}
                                    {dayEvs.length > 2 && (
                                        <span className="hidden sm:inline text-[10px] text-slate-500 font-medium px-0.5">+{dayEvs.length - 2}</span>
                                    )}
                                    {dayEvs.length > 1 && (
                                        <span className="sm:hidden text-[10px] text-slate-500 font-medium px-0.5">+{dayEvs.length - 1}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// WeekView
// ─────────────────────────────────────────────────────────────────────────────

function WeekView({
    cursor, events, onEventClick,
}: {
    cursor: Date;
    events: CalendarEvent[];
    onEventClick: (ev: CalendarEvent) => void;
}) {
    const days = getWeekDays(cursor);

    return (
        <div className="flex-1 flex min-h-0 overflow-x-auto">
            {days.map((day, i) => {
                const ds = toDateStr(day);
                const dayEvs = events.filter(e => e.date === ds);
                return (
                    <div key={i} className="flex-1 min-w-[72px] sm:min-w-[100px] border-r last:border-r-0 flex flex-col">
                        {/* Header */}
                        <div className={cls(
                            "py-1.5 sm:py-2 px-1 sm:px-2 text-center border-b",
                            isToday(day) ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-600",
                        )}>
                            <div className="text-[9px] sm:text-[10px] font-semibold uppercase">
                                {day.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
                            </div>
                            <div className={cls("text-base sm:text-lg font-bold leading-tight", isToday(day) ? "text-white" : "text-slate-900")}>
                                {day.getDate()}
                            </div>
                        </div>

                        {/* Events */}
                        <div className="flex-1 p-0.5 sm:p-1 space-y-0.5 sm:space-y-1 overflow-y-auto">
                            {dayEvs.length === 0 && (
                                <div className="h-full min-h-[60px]" />
                            )}
                            {dayEvs.map((ev, j) => (
                                <EventPill key={j} ev={ev} onClick={() => onEventClick(ev)} compact />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// DayView
// ─────────────────────────────────────────────────────────────────────────────

function DayView({
    cursor, events, isAdmin, onEventClick, onNewEvent,
}: {
    cursor: Date;
    events: CalendarEvent[];
    isAdmin: boolean;
    onEventClick: (ev: CalendarEvent) => void;
    onNewEvent: (date: string) => void;
}) {
    const ds = toDateStr(cursor);
    const dayEvs = events.filter(e => e.date === ds);

    if (dayEvs.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
                <CalendarCheck size={36} className="text-slate-200" />
                <p className="text-sm">Nenhum evento neste dia.</p>
                {isAdmin && (
                    <button
                        onClick={() => onNewEvent(ds)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition-colors"
                        type="button"
                    >
                        <Plus size={14} />Criar evento
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-2">
            {dayEvs.map((ev, i) => {
                const icon = ev.type === "birthday" ? "🎂"
                    : ev.type === "match"   ? "⚽"
                    : ev.type === "holiday" ? "🎉"
                    : (ev.categoryIcon ?? "📅");
                const s = eventStyle(ev);
                return (
                    <button
                        key={i}
                        onClick={() => onEventClick(ev)}
                        style={eventCSSVars(ev)}
                        className={`w-full text-left rounded-xl border px-3 sm:px-4 py-2.5 sm:py-3 flex items-start gap-2.5 sm:gap-3 hover:opacity-80 transition-opacity ${s.bg} ${s.border}`}
                        type="button"
                    >
                        <span className="text-xl sm:text-2xl leading-none mt-0.5">{icon}</span>
                        <div className="flex-1 min-w-0">
                            <div className={`font-semibold text-sm ${s.text}`}>{ev.title}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                                {ev.timeTBD ? "Horário a confirmar" : (ev.time ?? "Sem horário")}
                                {ev.categoryName && ` · ${ev.categoryName}`}
                            </div>
                            {ev.description && (
                                <div className="text-xs text-slate-500 mt-1 line-clamp-2">{ev.description}</div>
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// CalendarPage — main component
// ─────────────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
    const active     = useAccountStore(s => s.getActive());
    const groupId    = active?.activeGroupId;
    const isGod      = active?.roles?.includes("GodMode") || active?.roles?.includes("Admin");
    const isGroupAdm = !!groupId && (!!isGod || (active?.groupAdminIds?.includes(groupId) ?? false));

    const [view,   setView]   = useState<ViewMode>("month");
    const [cursor, setCursor] = useState(() => new Date());
    const [events,     setEvents]     = useState<CalendarEvent[]>([]);
    const [categories, setCategories] = useState<CalendarCategory[]>([]);
    const [loading, setLoading]       = useState(false);

    // Modals
    const [selectedEvent, setSelectedEvent]   = useState<CalendarEvent | null>(null);
    const [editingEvent,  setEditingEvent]    = useState<CalendarEvent | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createInitialDate, setCreateInitialDate] = useState<string | undefined>();
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [dayModal, setDayModal] = useState<{ day: Date; events: CalendarEvent[] } | null>(null);

    const fetchEvents = useCallback(async () => {
        if (!groupId) return;
        const { start, end } = getRangeForView(view, cursor);
        setLoading(true);
        try {
            const res = await CalendarApi.events(groupId, toDateStr(start), toDateStr(end));
            setEvents(res.data ?? []);
        } catch (e) {
            toast.error(extractApiError(e, "Erro ao carregar calendário."));
        } finally {
            setLoading(false);
        }
    }, [groupId, view, cursor]);

    const fetchCategories = useCallback(async () => {
        if (!groupId) return;
        try {
            const res = await CalendarApi.categories(groupId);
            setCategories(res.data ?? []);
        } catch { /* silencioso */ }
    }, [groupId]);

    useEffect(() => { fetchEvents(); }, [fetchEvents]);
    useEffect(() => { fetchCategories(); }, [fetchCategories]);

    if (!groupId) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                <CalendarCheck size={40} className="text-slate-200" />
                <p className="text-sm">Selecione um grupo para ver o calendário.</p>
            </div>
        );
    }

    function openEvent(ev: CalendarEvent) { setSelectedEvent(ev); }
    function openEdit(ev: CalendarEvent) { setEditingEvent(ev); setSelectedEvent(null); }
    function openNewEvent(date?: string) { setCreateInitialDate(date); setShowCreateModal(true); }
    function openDayModal(day: Date, dayEvs: CalendarEvent[]) { setDayModal({ day, events: dayEvs }); }

    async function handleDeleteEvent(ev: CalendarEvent) {
        if (!ev.id || !groupId) return;
        if (!confirm(`Excluir "${ev.title}"?`)) return;
        try {
            await CalendarApi.deleteEvent(groupId, ev.id);
            toast.success("Evento excluído!");
            setSelectedEvent(null);
            fetchEvents();
        } catch (e) { toast.error(extractApiError(e, "Erro ao excluir evento.")); }
    }

    const viewTitle      = view === "month" ? formatMonthTitle(cursor)
                         : view === "week"  ? formatWeekTitle(cursor)
                         :                   formatDayTitle(cursor);
    const viewTitleShort = view === "month" ? formatMonthTitle(cursor)
                         : view === "week"  ? formatWeekTitle(cursor)
                         :                   formatDayTitleShort(cursor);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* ── Header ── */}
            <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-4 sm:px-6 py-4 sm:py-5 overflow-hidden shrink-0 shadow-lg">
                <div className="absolute inset-0 pointer-events-none opacity-[0.06]"
                    style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4 pointer-events-none" />

                {/* Row 1: icon + title + admin actions */}
                <div className="relative flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                        <CalendarCheck size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-black leading-tight">Calendário</h1>
                        <p className="text-xs text-white/50 truncate capitalize">
                            {loading
                                ? <span className="inline-flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Carregando...</span>
                                : viewTitle}
                        </p>
                    </div>
                    {isGroupAdm && (
                        <div className="flex items-center gap-1.5 shrink-0">
                            <button onClick={() => setShowCategoryModal(true)}
                                title="Gerenciar categorias"
                                className="h-8 w-8 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 flex items-center justify-center transition-colors" type="button">
                                <Settings2 size={14} />
                            </button>
                            <button onClick={() => openNewEvent()}
                                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-white text-slate-900 text-xs font-semibold hover:bg-slate-100 transition-colors shrink-0" type="button">
                                <Plus size={14} />
                                <span className="hidden sm:inline">Evento</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Row 2: nav + view toggle + today */}
                <div className="relative flex items-center gap-2 flex-wrap">
                    {/* Prev / Next */}
                    <button onClick={() => setCursor(prevCursor(view, cursor))}
                        className="h-8 w-8 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 flex items-center justify-center transition-colors shrink-0" type="button">
                        <ChevronLeft size={16} />
                    </button>
                    <button onClick={() => setCursor(nextCursor(view, cursor))}
                        className="h-8 w-8 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 flex items-center justify-center transition-colors shrink-0" type="button">
                        <ChevronRight size={16} />
                    </button>

                    {/* Today */}
                    <button onClick={() => setCursor(new Date())}
                        className="h-8 px-3 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-semibold hover:bg-white/20 transition-colors shrink-0" type="button">
                        Hoje
                    </button>

                    {/* View toggle */}
                    <div className="inline-flex rounded-xl overflow-hidden border border-white/20 ml-auto">
                        {(["month", "week", "day"] as ViewMode[]).map(v => (
                            <button key={v} type="button"
                                onClick={() => setView(v)}
                                className={cls(
                                    "px-3 py-1.5 text-xs font-semibold transition-colors",
                                    view === v ? "bg-white text-slate-900" : "bg-white/10 text-white/80 hover:bg-white/20",
                                )}
                            >
                                {v === "month" ? "Mês" : v === "week" ? <span className="sm:hidden">Sem</span> : null}
                                {v === "month" ? null : v === "week" ? <span className="hidden sm:inline">Semana</span> : null}
                                {v === "day" ? "Dia" : null}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Calendar body ── */}
            <div className="flex-1 overflow-hidden flex flex-col">
                {view === "month" && (
                    <MonthView
                        cursor={cursor}
                        events={events}
                        isAdmin={isGroupAdm}
                        onDayClick={openDayModal}
                    />
                )}
                {view === "week" && (
                    <WeekView
                        cursor={cursor}
                        events={events}
                        onEventClick={openEvent}
                    />
                )}
                {view === "day" && (
                    <DayView
                        cursor={cursor}
                        events={events}
                        isAdmin={isGroupAdm}
                        onEventClick={openEvent}
                        onNewEvent={openNewEvent}
                    />
                )}
            </div>

            {/* ── Modals ── */}
            {selectedEvent && (
                <EventDetailModal
                    event={selectedEvent}
                    isAdmin={isGroupAdm}
                    onClose={() => setSelectedEvent(null)}
                    onEdit={() => openEdit(selectedEvent)}
                    onDelete={() => handleDeleteEvent(selectedEvent)}
                />
            )}

            {(showCreateModal || editingEvent) && (
                <CreateEditEventModal
                    groupId={groupId}
                    categories={categories}
                    event={editingEvent}
                    initialDate={createInitialDate}
                    onClose={() => { setShowCreateModal(false); setEditingEvent(null); setCreateInitialDate(undefined); }}
                    onSaved={() => {
                        setShowCreateModal(false);
                        setEditingEvent(null);
                        setCreateInitialDate(undefined);
                        fetchEvents();
                    }}
                />
            )}

            {showCategoryModal && (
                <CategoryManagerModal
                    groupId={groupId}
                    categories={categories}
                    onClose={() => setShowCategoryModal(false)}
                    onChanged={fetchCategories}
                />
            )}

            {dayModal && (
                <DayDetailModal
                    day={dayModal.day}
                    events={dayModal.events}
                    isAdmin={isGroupAdm}
                    onClose={() => setDayModal(null)}
                    onEventClick={openEvent}
                    onNewEvent={date => { setDayModal(null); openNewEvent(date); }}
                />
            )}
        </div>
    );
}
