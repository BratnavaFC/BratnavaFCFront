import { useEffect, useState } from "react";
import { X, Plus, Loader2 } from "lucide-react";
import { CalendarApi } from "../../api/endpoints";
import { getResponseMessage } from "../../api/apiResponse";
import { toast } from "sonner";
import ModalBackdrop from "./ModalBackdrop";
import type { CalendarEvent, CalendarCategory } from "../../types/calendar";

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

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

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
                const res = await CalendarApi.updateEvent(groupId, editEvent.id, dto);
                if (res.data.message) toast.success(res.data.message);
            } else {
                const res = await CalendarApi.createEvent(groupId, dto);
                if (res.data.message) toast.success(res.data.message);
            }
            onSaved();
        } catch (e) {
            toast.error(getResponseMessage(e, "Erro ao salvar evento."));
        } finally {
            setSaving(false);
        }
    }

    return (
        <ModalBackdrop onClose={onClose}>
            <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-800 shadow-2xl dark:shadow-none dark:ring-1 dark:ring-slate-700 border-t sm:border flex flex-col overflow-hidden">
                {/* Drag indicator (mobile only) */}
                <div className="sm:hidden flex justify-center pt-2 pb-0">
                    <div className="w-8 h-1 rounded-full bg-slate-200 dark:bg-slate-600" />
                </div>
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-blue-500 text-white flex items-center justify-center shrink-0">
                            <Plus size={17} />
                        </div>
                        <div className="text-base font-semibold text-slate-900 dark:text-white">{isEdit ? "Editar evento" : "Novo evento"}</div>
                    </div>
                    <button onClick={onClose} className="h-9 w-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white" type="button">
                        <X size={18} />
                    </button>
                </div>

                <div className="px-4 sm:px-5 py-4 space-y-3 overflow-y-auto max-h-[65vh] sm:max-h-[60vh]">
                    {/* Título */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Título *</label>
                        <input
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400 dark:focus:ring-slate-400"
                            value={title} onChange={e => setTitle(e.target.value)}
                            placeholder="Ex: Churrasco pós-jogo"
                        />
                    </div>

                    {/* Categoria */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Categoria</label>
                        <select
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400 dark:focus:ring-slate-400"
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
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Data *</label>
                        <input
                            type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400 dark:focus:ring-slate-400"
                            value={date} onChange={e => setDate(e.target.value)}
                        />
                    </div>

                    {/* Horário */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Horário</label>
                            <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer select-none">
                                <input type="checkbox" checked={timeTBD} onChange={e => setTimeTBD(e.target.checked)} className="accent-slate-900" />
                                Em aberto / a confirmar
                            </label>
                        </div>
                        {!timeTBD && (
                            <input
                                type="time" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400 dark:focus:ring-slate-400"
                                value={time} onChange={e => setTime(e.target.value)}
                            />
                        )}
                    </div>

                    {/* Descrição */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Descrição <span className="font-normal text-slate-400 dark:text-slate-500">(opcional)</span></label>
                        <textarea
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400 dark:focus:ring-slate-400"
                            rows={2} value={description} onChange={e => setDesc(e.target.value)}
                            placeholder="Detalhes do evento..."
                        />
                    </div>
                </div>

                <div className="px-4 sm:px-5 py-3 border-t dark:border-slate-700 flex gap-2 justify-end">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" type="button">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave} disabled={saving}
                        className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors flex items-center gap-2 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
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

export default CreateEditEventModal;
