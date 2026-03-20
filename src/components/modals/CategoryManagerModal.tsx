import { useEffect, useState } from "react";
import { X, Plus, Loader2, Tag, Pencil, Trash2 } from "lucide-react";
import { CalendarApi } from "../../api/endpoints";
import { extractApiError } from "../../lib/apiError";
import { toast } from "sonner";
import ModalBackdrop from "./ModalBackdrop";

interface CalendarCategory {
    id: string;
    name: string;
    color?: string | null;
    icon?: string | null;
    isSystem: boolean;
}

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

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

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

export default CategoryManagerModal;
