import { useEffect, useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PaymentsApi } from "../../api/endpoints";

interface CreateExtraChargeModalProps {
    open: boolean;
    groupId: string; players: { id: string; name: string }[];
    onClose(): void; onSaved(): void;
}

function CreateExtraChargeModal({ open, groupId, players, onClose, onSaved }: CreateExtraChargeModalProps) {
    useEffect(() => {
        if (!open) return;
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [open, onClose]);

    if (!open) return null;

    const [name, setName]         = useState('');
    const [desc, setDesc]         = useState('');
    const [amount, setAmount]     = useState('');
    const [dueDate, setDueDate]   = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set(players.map(p => p.id)));
    const [saving, setSaving]     = useState(false);

    function toggleAll() {
        setSelected(selected.size === players.length ? new Set() : new Set(players.map(p => p.id)));
    }

    async function submit() {
        if (!name.trim() || !amount) { toast.error('Nome e valor são obrigatórios'); return; }
        if (selected.size === 0)     { toast.error('Selecione ao menos um jogador'); return; }
        setSaving(true);
        try {
            const res = await PaymentsApi.createExtraCharge(groupId, {
                name: name.trim(), description: desc.trim() || undefined,
                amount: parseFloat(amount),
                dueDate: dueDate || undefined,
                playerIds: [...selected],
            });
            if (res.data.message) toast.success(res.data.message);
            onSaved(); onClose();
        } catch { toast.error('Erro ao criar cobrança'); }
        finally { setSaving(false); }
    }

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-slate-900 mb-4">Nova cobrança extra</h3>
                <div className="space-y-3 mb-4">
                    <div>
                        <label className="text-xs font-medium text-slate-600 block mb-1">Nome *</label>
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Churrasco da patota"
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-600 block mb-1">Descrição</label>
                        <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="Opcional"
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium text-slate-600 block mb-1">Valor (R$) *</label>
                            <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-600 block mb-1">Vencimento</label>
                            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                        </div>
                    </div>
                </div>

                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-slate-600">Jogadores *</label>
                        <button onClick={toggleAll} className="text-xs text-slate-500 hover:text-slate-800 underline">
                            {selected.size === players.length ? 'Desmarcar todos' : 'Marcar todos'}
                        </button>
                    </div>
                    <div className="border border-slate-200 rounded-lg max-h-44 overflow-y-auto divide-y divide-slate-100">
                        {players.map(p => (
                            <label key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                                <input type="checkbox" checked={selected.has(p.id)}
                                    onChange={() => {
                                        const s = new Set(selected);
                                        s.has(p.id) ? s.delete(p.id) : s.add(p.id);
                                        setSelected(s);
                                    }}
                                    className="rounded border-slate-300 text-slate-900" />
                                <span className="text-sm text-slate-700">{p.name}</span>
                            </label>
                        ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{selected.size} de {players.length} selecionados</p>
                </div>

                <div className="flex gap-2">
                    <button onClick={submit} disabled={saving}
                        className="flex-1 bg-slate-900 text-white rounded-lg py-2 text-sm font-semibold hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center gap-2">
                        {saving ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>}
                        Criar cobrança
                    </button>
                    <button onClick={onClose} className="px-4 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CreateExtraChargeModal;
