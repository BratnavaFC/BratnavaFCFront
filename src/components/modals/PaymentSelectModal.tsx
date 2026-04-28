import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { PaymentsApi } from '../../api/endpoints';
import { getResponseMessage } from '../../api/apiResponse';

interface PendingItem {
    id: string;
    description: string;
    amount: number;
    discount: number;
    finalAmount: number;
    type: 0 | 1; // 0 = Monthly, 1 = Extra
    year?: number;
    month?: number;
    chargeId?: string;
}

interface Props {
    open: boolean;
    groupId: string;
    onClose: () => void;
    onSaved: () => void;
}

export default function PaymentSelectModal({ open, groupId, onClose, onSaved }: Props) {
    const [items, setItems]       = useState<PendingItem[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [loading, setLoading]   = useState(false);
    const [saving, setSaving]     = useState(false);

    useEffect(() => {
        if (!open || !groupId) return;
        setLoading(true);
        PaymentsApi.getMyPendingItems(groupId)
            .then(res => {
                const data: PendingItem[] = (res.data.data as any[]) ?? [];
                setItems(data);
                setSelected(new Set(data.map(item => item.id)));
            })
            .catch(e => toast.error(getResponseMessage(e, 'Erro ao carregar itens pendentes')))
            .finally(() => setLoading(false));
    }, [open, groupId]);

    if (!open) return null;

    const toggleItem = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const selectedItems = items.filter(item => selected.has(item.id));
    const total = selectedItems.reduce((sum, item) => sum + item.finalAmount, 0);

    async function handleConfirm() {
        if (selectedItems.length === 0) {
            toast.error('Selecione ao menos um item para pagar.');
            return;
        }
        setSaving(true);
        try {
            await PaymentsApi.paySelected(groupId, {
                items: selectedItems.map(item => ({
                    type: item.type,
                    year: item.year ?? null,
                    month: item.month ?? null,
                    chargeId: item.chargeId ?? null,
                })),
            });
            toast.success('Pagamentos confirmados!');
            onSaved();
            onClose();
        } catch (e) {
            toast.error(getResponseMessage(e, 'Erro ao confirmar pagamentos.'));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60">
            <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">💳 Confirmar pagamentos</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Selecione os itens que deseja marcar como pagos
                    </p>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 size={24} className="animate-spin text-slate-400" />
                        </div>
                    ) : items.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 dark:text-slate-500">
                            <CheckCircle2 size={32} className="mx-auto mb-2 text-green-400 opacity-60" />
                            <p className="text-sm">Nenhum débito pendente!</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {items.map(item => {
                                const isSelected = selected.has(item.id);
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => toggleItem(item.id)}
                                        className={[
                                            'w-full flex items-center gap-3 p-3 rounded-xl border transition text-left',
                                            isSelected
                                                ? 'border-slate-900 dark:border-slate-300 bg-slate-50 dark:bg-slate-800'
                                                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50',
                                        ].join(' ')}
                                    >
                                        {/* Checkbox */}
                                        <div className={[
                                            'h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition',
                                            isSelected
                                                ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white'
                                                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800',
                                        ].join(' ')}>
                                            {isSelected && (
                                                <svg viewBox="0 0 12 12" className="w-3 h-3 text-white dark:text-slate-900" fill="none">
                                                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            )}
                                        </div>

                                        {/* Label */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                                {item.description}
                                            </p>
                                            {item.discount > 0 && (
                                                <p className="text-xs text-slate-400 dark:text-slate-500 line-through">
                                                    R$ {item.amount.toFixed(2)}
                                                </p>
                                            )}
                                        </div>

                                        {/* Amount */}
                                        <div className="text-right shrink-0">
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                                                R$ {item.finalAmount.toFixed(2)}
                                            </p>
                                            {item.discount > 0 && (
                                                <p className="text-xs text-green-600 font-medium">
                                                    -R$ {item.discount.toFixed(2)}
                                                </p>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
                    {items.length > 0 && (
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-slate-500 dark:text-slate-400">
                                Total selecionado
                            </span>
                            <span className="text-xl font-black text-slate-900 dark:text-white">
                                R$ {total.toFixed(2)}
                            </span>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            disabled={saving}
                            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={saving || loading || selectedItems.length === 0}
                            className="flex-1 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:bg-slate-700 dark:hover:bg-slate-100 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {saving && <Loader2 size={15} className="animate-spin" />}
                            {saving ? 'Confirmando...' : 'Confirmar pagamento'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
