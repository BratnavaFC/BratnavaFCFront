import { useEffect, useState } from "react";
import { DollarSign, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PaymentsApi } from "../../api/endpoints";

interface ExtraChargePayment {
    playerId: string; playerName: string; amount: number; discount: number;
    finalAmount: number; discountReason?: string; status: number;
    paidAt?: string; hasProof: boolean; proofFileName?: string;
}
interface ExtraCharge {
    id: string; name: string; description?: string; amount: number;
    dueDate?: string; createdAt: string; isCancelled: boolean;
    payments: ExtraChargePayment[];
}

const cls = (...c: (string|false|undefined)[]) => c.filter(Boolean).join(' ');

interface BulkExtraDiscountModalProps {
    open: boolean;
    groupId: string; charge: ExtraCharge;
    onClose(): void; onSaved(): void;
}

function BulkExtraDiscountModal({ open, groupId, charge, onClose, onSaved }: BulkExtraDiscountModalProps) {
    useEffect(() => {
        if (!open) return;
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [open, onClose]);

    if (!open) return null;

    const pendingPlayers = charge.payments.filter(p => p.status !== 1);
    const [discount, setDiscount] = useState('');
    const [reason, setReason]     = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set(pendingPlayers.map(p => p.playerId)));
    const [saving, setSaving]     = useState(false);
    const allPlayers              = charge.payments;

    function toggleAll() {
        setSelected(selected.size === allPlayers.length ? new Set() : new Set(allPlayers.map(p => p.playerId)));
    }

    async function submit() {
        if (!discount || parseFloat(discount) <= 0) { toast.error('Informe um valor de desconto'); return; }
        if (selected.size === 0) { toast.error('Selecione ao menos um jogador'); return; }
        setSaving(true);
        try {
            const res = await PaymentsApi.bulkDiscountExtraCharge(groupId, charge.id, {
                discount: parseFloat(discount),
                discountReason: reason.trim() || undefined,
                playerIds: [...selected],
            });
            if (res.data.message) toast.success(res.data.message);
            onSaved(); onClose();
        } catch { toast.error('Erro ao aplicar desconto'); }
        finally { setSaving(false); }
    }

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl dark:shadow-none dark:ring-1 dark:ring-slate-700 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Desconto em massa</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    Cobrança: <span className="font-semibold text-slate-700 dark:text-slate-200">{charge.name}</span> · R$ {charge.amount.toFixed(2)}
                </p>

                <div className="space-y-3 mb-4">
                    <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">Desconto (R$) *</label>
                        <input type="number" min="0.01" step="0.01" placeholder="0,00"
                            value={discount} onChange={e => setDiscount(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400 dark:focus:ring-slate-400" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">Motivo (opcional)</label>
                        <input type="text" placeholder="Ex: Desconto de fidelidade"
                            value={reason} onChange={e => setReason(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400 dark:focus:ring-slate-400" />
                    </div>
                </div>

                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Jogadores *</label>
                        <button onClick={toggleAll} className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline">
                            {selected.size === allPlayers.length ? 'Desmarcar todos' : 'Marcar todos'}
                        </button>
                    </div>
                    <div className="border border-slate-200 dark:border-slate-600 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                        {allPlayers.map(p => (
                            <label key={p.playerId} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer">
                                <input type="checkbox" checked={selected.has(p.playerId)}
                                    onChange={() => {
                                        const s = new Set(selected);
                                        s.has(p.playerId) ? s.delete(p.playerId) : s.add(p.playerId);
                                        setSelected(s);
                                    }}
                                    className="rounded border-slate-300 text-slate-900" />
                                <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">{p.playerName}</span>
                                <span className={cls(
                                    'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                                    p.status === 1 ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-500'
                                )}>
                                    {p.status === 1 ? 'Pago' : 'Pendente'}
                                </span>
                            </label>
                        ))}
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{selected.size} de {allPlayers.length} selecionados</p>
                </div>

                {discount && parseFloat(discount) > 0 && selected.size > 0 && (
                    <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                        Aplicará <strong>R$ {parseFloat(discount).toFixed(2)}</strong> de desconto para{' '}
                        <strong>{selected.size} jogador{selected.size !== 1 ? 'es' : ''}</strong>.
                    </div>
                )}

                <div className="flex gap-2">
                    <button onClick={submit} disabled={saving}
                        className="flex-1 bg-slate-900 text-white rounded-lg py-2 text-sm font-semibold hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center gap-2 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100">
                        {saving ? <Loader2 size={14} className="animate-spin"/> : <DollarSign size={14}/>}
                        Aplicar desconto
                    </button>
                    <button onClick={onClose} className="px-4 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
}

export default BulkExtraDiscountModal;
