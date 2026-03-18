import { useEffect, useState, useCallback } from "react";
import {
    ChevronLeft, ChevronRight, Plus, Settings2, X, Loader2,
    CalendarCheck, Clock, Pencil, Trash2, Tag,
} from "lucide-react";
import useAccountStore from "../auth/accountStore";
import { CalendarApi } from "../api/endpoints";
import { extractApiError } from "../lib/apiError";
import { toast } from "sonner";

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

function ModalBackdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
            <div className="absolute inset-0 flex items-end sm:items-center justify-center sm:p-4">
                {children}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// EventDetailModal
// ─────────────────────────────────────────────────────────────────────────────

function EventDetailModal({
    event, isAdmin, onClose, onEdit, onDelete,
}: {
    event: CalendarEvent;
    isAdmin: boolean;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const icon = event.type === "birthday" ? "🎂"
        : event.type === "match"   ? "⚽"
        : event.type === "holiday" ? "🎉"
        : (event.categoryIcon ?? "📅");
    const typeLabel = event.type === "birthday" ? "Aniversário"
        : event.type === "match"   ? "Jogo"
        : event.type === "holiday" ? "Feriado"
        : "Evento";

    const dateLabel = (() => {
        if (!event.date) return "—";
        const [y, mo, d] = event.date.split("-").map(Number);
        return new Date(y, mo - 1, d).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    })();

    return (
        <ModalBackdrop onClose={onClose}>
            <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border-t sm:border flex flex-col overflow-hidden">
                {/* Drag indicator (mobile only) */}
                <div className="sm:hidden flex justify-center pt-2 pb-0">
                    <div className="w-8 h-1 rounded-full bg-slate-200" />
                </div>
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center text-lg shrink-0">
                            {icon}
                        </div>
                        <div>
                            <div className="text-base font-semibold text-slate-900 leading-tight">{event.title}</div>
                            <div className="text-xs text-slate-500">{typeLabel}{event.categoryName && event.type === "manual" ? ` · ${event.categoryName}` : ""}</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="h-9 w-9 rounded-xl hover:bg-slate-100 flex items-center justify-center" type="button">
                        <X size={18} />
                    </button>
                </div>

                <div className="px-4 sm:px-5 py-4 space-y-3">
                    <div className="flex items-start gap-2 text-sm text-slate-700">
                        <CalendarCheck size={16} className="shrink-0 mt-0.5 text-slate-400" />
                        <span className="capitalize">{dateLabel}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                        <Clock size={16} className="shrink-0 text-slate-400" />
                        <span>{event.timeTBD ? "Horário a confirmar" : (event.time ?? "—")}</span>
                    </div>
                    {event.description && (
                        <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                            {event.description}
                        </p>
                    )}
                </div>

                {isAdmin && event.type === "manual" && (
                    <div className="px-4 sm:px-5 py-3 border-t flex gap-2 justify-end">
                        <button
                            onClick={onDelete}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-sm font-medium hover:bg-rose-100 transition-colors"
                            type="button"
                        >
                            <Trash2 size={14} />Excluir
                        </button>
                        <button
                            onClick={onEdit}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
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

// ─────────────────────────────────────────────────────────────────────────────
// CreateEditEventModal
// ─────────────────────────────────────────────────────────────────────────────

function CreateEditEventModal({
    groupId, categories, event: editEvent, initialDate,
    onClose, onSaved,
}: {
    groupId: string;
    categories: CalendarCategory[];
    event?: CalendarEvent | null;
    initialDate?: string;
    onClose: () => void;
    onSaved: () => void;
}) {
    const isEdit = !!editEvent?.id;

    const [title, setTitle]         = useState(editEvent?.title ?? "");
    const [description, setDesc]    = useState(editEvent?.description ?? "");
    const [categoryId, setCatId]    = useState(editEvent?.categoryId ?? "");
    const [date, setDate]           = useState(editEvent?.date ?? (initialDate ?? ""));
    const [time, setTime]           = useState(editEvent?.time ?? "");
    const [timeTBD, setTimeTBD]     = useState(editEvent?.timeTBD ?? false);
    const [saving, setSaving]       = useState(false);

    async function handleSave() {
        if (!title.trim()) { toast.error("Título é obrigatório."); return; }
        if (!date) { toast.error("Data é obrigatória."); return; }
        setSaving(true);
        try {
            const dto = {
                title: title.trim(),
                description: description.trim() || null,
                categoryId: categoryId || null,
                date,
                time: timeTBD ? null : (time || null),
                timeTBD,
            };
            if (isEdit && editEvent?.id) {
                await CalendarApi.updateEvent(groupId, editEvent.id, dto);
                toast.success("Evento atualizado!");
            } else {
                await CalendarApi.createEvent(groupId, dto);
                toast.success("Evento criado!");
            }
            onSaved();
        } catch (e) {
            toast.error(extractApiError(e, "Erro ao salvar evento."));
        } finally {
            setSaving(false);
        }
    }

    return (
        <ModalBackdrop onClose={onClose}>
            <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border-t sm:border flex flex-col overflow-hidden">
                {/* Drag indicator (mobile only) */}
                <div className="sm:hidden flex justify-center pt-2 pb-0">
                    <div className="w-8 h-1 rounded-full bg-slate-200" />
                </div>
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-blue-500 text-white flex items-center justify-center shrink-0">
                            <Plus size={17} />
                        </div>
                        <div className="text-base font-semibold text-slate-900">{isEdit ? "Editar evento" : "Novo evento"}</div>
                    </div>
                    <button onClick={onClose} className="h-9 w-9 rounded-xl hover:bg-slate-100 flex items-center justify-center" type="button">
                        <X size={18} />
                    </button>
                </div>

                <div className="px-4 sm:px-5 py-4 space-y-3 overflow-y-auto max-h-[65vh] sm:max-h-[60vh]">
                    {/* Título */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Título *</label>
                        <input
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                            value={title} onChange={e => setTitle(e.target.value)}
                            placeholder="Ex: Churrasco pós-jogo"
                        />
                    </div>

                    {/* Categoria */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Categoria</label>
                        <select
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                            value={categoryId} onChange={e => setCatId(e.target.value)}
                        >
                            <option value="">Sem categoria</option>
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Data */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Data *</label>
                        <input
                            type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                            value={date} onChange={e => setDate(e.target.value)}
                        />
                    </div>

                    {/* Horário */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-semibold text-slate-600">Horário</label>
                            <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                                <input type="checkbox" checked={timeTBD} onChange={e => setTimeTBD(e.target.checked)} className="accent-slate-900" />
                                Em aberto / a confirmar
                            </label>
                        </div>
                        {!timeTBD && (
                            <input
                                type="time" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                                value={time} onChange={e => setTime(e.target.value)}
                            />
                        )}
                    </div>

                    {/* Descrição */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Descrição <span className="font-normal text-slate-400">(opcional)</span></label>
                        <textarea
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-900"
                            rows={2} value={description} onChange={e => setDesc(e.target.value)}
                            placeholder="Detalhes do evento..."
                        />
                    </div>
                </div>

                <div className="px-4 sm:px-5 py-3 border-t flex gap-2 justify-end">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors" type="button">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave} disabled={saving}
                        className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                        type="button"
                    >
                        {saving && <Loader2 size={14} className="animate-spin" />}
                        {isEdit ? "Salvar" : "Criar"}
                    </button>
                </div>
                <div className="sm:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} />
            </div>
        </ModalBackdrop>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// CategoryManagerModal
// ─────────────────────────────────────────────────────────────────────────────

function CategoryManagerModal({
    groupId, categories, onClose, onChanged,
}: {
    groupId: string;
    categories: CalendarCategory[];
    onClose: () => void;
    onChanged: () => void;
}) {
    const [name, setName]   = useState("");
    const [color, setColor] = useState("#3b82f6");
    const [icon, setIcon]   = useState("");
    const [saving, setSaving]     = useState(false);
    const [editing, setEditing]   = useState<CalendarCategory | null>(null);
    const [editName, setEditName] = useState("");
    const [editColor, setEditColor] = useState("");
    const [editIcon, setEditIcon]   = useState("");
    const [deleting, setDeleting] = useState<string | null>(null);

    async function handleCreate() {
        if (!name.trim()) { toast.error("Nome é obrigatório."); return; }
        setSaving(true);
        try {
            await CalendarApi.createCategory(groupId, { name: name.trim(), color: color || null, icon: icon.trim() || null });
            toast.success("Categoria criada!");
            setName(""); setIcon("");
            onChanged();
        } catch (e) { toast.error(extractApiError(e, "Erro ao criar categoria.")); }
        finally { setSaving(false); }
    }

    async function handleUpdate() {
        if (!editing) return;
        if (!editName.trim()) { toast.error("Nome é obrigatório."); return; }
        setSaving(true);
        try {
            await CalendarApi.updateCategory(groupId, editing.id, { name: editName.trim(), color: editColor || null, icon: editIcon.trim() || null });
            toast.success("Categoria atualizada!");
            setEditing(null);
            onChanged();
        } catch (e) { toast.error(extractApiError(e, "Erro ao atualizar categoria.")); }
        finally { setSaving(false); }
    }

    async function handleDelete(id: string) {
        setDeleting(id);
        try {
            await CalendarApi.deleteCategory(groupId, id);
            toast.success("Categoria removida!");
            onChanged();
        } catch (e) { toast.error(extractApiError(e, "Erro ao remover categoria.")); }
        finally { setDeleting(null); }
    }

    function openEdit(cat: CalendarCategory) {
        setEditing(cat);
        setEditName(cat.name);
        setEditColor(cat.color ?? "#3b82f6");
        setEditIcon(cat.icon ?? "");
    }

    return (
        <ModalBackdrop onClose={onClose}>
            <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border-t sm:border flex flex-col overflow-hidden">
                {/* Drag indicator (mobile only) */}
                <div className="sm:hidden flex justify-center pt-2 pb-0">
                    <div className="w-8 h-1 rounded-full bg-slate-200" />
                </div>
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                            <Tag size={17} className="text-slate-600" />
                        </div>
                        <div className="text-base font-semibold text-slate-900">Categorias</div>
                    </div>
                    <button onClick={onClose} className="h-9 w-9 rounded-xl hover:bg-slate-100 flex items-center justify-center" type="button">
                        <X size={18} />
                    </button>
                </div>

                <div className="px-4 sm:px-5 py-4 space-y-4 overflow-y-auto max-h-[65vh] sm:max-h-[60vh]">
                    {/* Lista */}
                    <div className="space-y-2">
                        {categories.length === 0 && (
                            <p className="text-sm text-slate-400 text-center py-2">Nenhuma categoria criada.</p>
                        )}
                        {categories.map(cat => (
                            <div key={cat.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                                {editing?.id === cat.id ? (
                                    <div className="flex-1 flex flex-col gap-2">
                                        <div className="flex gap-2">
                                            <input value={editIcon} onChange={e => setEditIcon(e.target.value)}
                                                className="w-14 rounded border border-slate-200 px-2 py-1 text-sm text-center" placeholder="🎉" />
                                            <input value={editName} onChange={e => setEditName(e.target.value)}
                                                className="flex-1 rounded border border-slate-200 px-2 py-1 text-sm" placeholder="Nome" />
                                            <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)}
                                                className="h-8 w-10 rounded border border-slate-200 cursor-pointer" title="Cor" />
                                        </div>
                                        <div className="flex gap-2 justify-end">
                                            <button onClick={() => setEditing(null)} className="px-2 py-1 text-xs rounded border border-slate-200 text-slate-600" type="button">Cancelar</button>
                                            <button onClick={handleUpdate} disabled={saving} className="px-2 py-1 text-xs rounded bg-slate-900 text-white disabled:opacity-50" type="button">
                                                {saving ? <Loader2 size={12} className="animate-spin" /> : "Salvar"}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-base shrink-0"
                                            style={{ background: cat.color ? `${cat.color}22` : "#f1f5f9" }}>
                                            {cat.icon ?? <Tag size={12} />}
                                        </span>
                                        <span className="flex-1 text-sm font-medium text-slate-900">{cat.name}</span>
                                        {cat.color && (
                                            <span className="w-4 h-4 rounded-full shrink-0 border border-white shadow-sm" style={{ background: cat.color }} />
                                        )}
                                        {!cat.isSystem && (
                                            <>
                                                <button onClick={() => openEdit(cat)} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700" type="button">
                                                    <Pencil size={13} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(cat.id)}
                                                    disabled={deleting === cat.id}
                                                    className="p-1 rounded hover:bg-rose-100 text-slate-400 hover:text-rose-600 disabled:opacity-50"
                                                    type="button"
                                                >
                                                    {deleting === cat.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                                </button>
                                            </>
                                        )}
                                        {cat.isSystem && (
                                            <span className="text-[10px] text-slate-400 bg-slate-200 rounded px-1.5 py-0.5">sistema</span>
                                        )}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Nova categoria */}
                    <div className="border-t pt-3">
                        <p className="text-xs font-semibold text-slate-600 mb-2">Nova categoria</p>
                        <div className="flex gap-2 mb-2">
                            <input value={icon} onChange={e => setIcon(e.target.value)}
                                className="w-14 rounded-lg border border-slate-200 px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-slate-900"
                                placeholder="🎉" title="Ícone (emoji)" />
                            <input value={name} onChange={e => setName(e.target.value)}
                                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                                placeholder="Nome da categoria" />
                            <input type="color" value={color} onChange={e => setColor(e.target.value)}
                                className="h-10 w-12 rounded-lg border border-slate-200 cursor-pointer" title="Cor" />
                        </div>
                        <button
                            onClick={handleCreate} disabled={saving}
                            className="w-full py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                            type="button"
                        >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                            Criar categoria
                        </button>
                    </div>
                </div>
                <div className="sm:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} />
            </div>
        </ModalBackdrop>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// DayDetailModal — mostra todos os eventos de um dia (clique no grid mensal)
// ─────────────────────────────────────────────────────────────────────────────

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
            <div className="flex flex-col gap-2 px-3 sm:px-6 py-3 border-b bg-white shrink-0">
                {/* Row 1: nav + title */}
                <div className="flex items-center gap-2">
                    <button onClick={() => setCursor(prevCursor(view, cursor))}
                        className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center shrink-0" type="button">
                        <ChevronLeft size={16} />
                    </button>
                    <button onClick={() => setCursor(nextCursor(view, cursor))}
                        className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center shrink-0" type="button">
                        <ChevronRight size={16} />
                    </button>
                    {/* Short title on mobile, full on desktop */}
                    <h1 className="sm:hidden text-sm font-bold text-slate-900 capitalize truncate flex-1">{viewTitleShort}</h1>
                    <h1 className="hidden sm:block text-base font-bold text-slate-900 capitalize truncate flex-1">{viewTitle}</h1>
                    {loading && <Loader2 size={14} className="animate-spin text-slate-400 shrink-0" />}

                    {/* On mobile: today + admin actions on same row as title */}
                    <div className="sm:hidden flex items-center gap-1.5 shrink-0">
                        <button onClick={() => setCursor(new Date())}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors" type="button">
                            Hoje
                        </button>
                        {isGroupAdm && (
                            <>
                                <button onClick={() => setShowCategoryModal(true)}
                                    title="Gerenciar categorias"
                                    className="h-8 w-8 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center" type="button">
                                    <Settings2 size={14} className="text-slate-600" />
                                </button>
                                <button onClick={() => openNewEvent()}
                                    className="h-8 w-8 rounded-xl bg-slate-900 text-white hover:bg-slate-700 transition-colors flex items-center justify-center" type="button">
                                    <Plus size={16} />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Row 2: view toggle + today + admin (desktop only) */}
                <div className="hidden sm:flex items-center gap-2">
                    {/* View toggle */}
                    <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
                        {(["month", "week", "day"] as ViewMode[]).map(v => (
                            <button key={v} type="button"
                                onClick={() => setView(v)}
                                className={cls(
                                    "px-3 py-1.5 text-xs font-semibold transition-colors",
                                    view === v ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50",
                                )}
                            >
                                {v === "month" ? "Mês" : v === "week" ? "Semana" : "Dia"}
                            </button>
                        ))}
                    </div>

                    {/* Today button */}
                    <button onClick={() => setCursor(new Date())}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors" type="button">
                        Hoje
                    </button>

                    {/* Admin actions */}
                    {isGroupAdm && (
                        <>
                            <button onClick={() => setShowCategoryModal(true)}
                                title="Gerenciar categorias"
                                className="h-9 w-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center" type="button">
                                <Settings2 size={16} className="text-slate-600" />
                            </button>
                            <button onClick={() => openNewEvent()}
                                className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition-colors" type="button">
                                <Plus size={16} />
                                <span>Evento</span>
                            </button>
                        </>
                    )}
                </div>

                {/* Row 2 (mobile only): view toggle */}
                <div className="sm:hidden flex items-center gap-1">
                    <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden flex-1">
                        {(["month", "week", "day"] as ViewMode[]).map(v => (
                            <button key={v} type="button"
                                onClick={() => setView(v)}
                                className={cls(
                                    "flex-1 py-1.5 text-xs font-semibold transition-colors",
                                    view === v ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50",
                                )}
                            >
                                {v === "month" ? "Mês" : v === "week" ? "Sem" : "Dia"}
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
