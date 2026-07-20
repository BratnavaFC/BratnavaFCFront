import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PaymentsApi } from '../../api/endpoints';
import { getResponseMessage } from '../../api/apiResponse';

export type ExitPendingItem = {
    id: string;
    description: string;
    amount: number;
    discount: number;
    finalAmount: number;
    type: 0 | 1;
    year?: number | null;
    month?: number | null;
    chargeId?: string | null;
    isPaid?: boolean;
};

export type ExitPendingGroup = {
    groupId: string;
    groupName: string;
    playerId: string;
    playerName: string;
    items: ExitPendingItem[];
    total: number;
};

export type ExitPendingPayments = {
    groups: ExitPendingGroup[];
    total: number;
    count: number;
    hasPending?: boolean;
};

type Props = {
    open: boolean;
    pending: ExitPendingPayments | null;
    title: string;
    forceLabel: string;
    onClose: () => void;
    onContinueAfterPayment: () => Promise<void>;
    onForceContinue: () => Promise<void>;
};

const currency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ExitPendingPaymentsModal({
    open,
    pending,
    title,
    forceLabel,
    onClose,
    onContinueAfterPayment,
    onForceContinue,
}: Props) {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);

    const groups = pending?.groups ?? [];
    const allItems = useMemo(
        () => groups.flatMap(group => group.items.map(item => ({ group, item }))),
        [groups],
    );
    const selectedTotal = allItems
        .filter(({ item }) => selected.has(item.id))
        .reduce((sum, { item }) => sum + item.finalAmount, 0);

    useEffect(() => {
        if (!open) return;
        setSelected(new Set(allItems.map(({ item }) => item.id)));
    }, [open, allItems]);

    if (!open || !pending) return null;

    const toggle = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    async function payAndContinue() {
        setSaving(true);
        try {
            for (const group of groups) {
                const items = group.items.filter(item => selected.has(item.id));
                if (items.length === 0) continue;
                await PaymentsApi.paySelected(group.groupId, {
                    items: items.map(item => ({
                        type: item.type,
                        year: item.year ?? null,
                        month: item.month ?? null,
                        chargeId: item.chargeId ?? null,
                        isPaid: true,
                    })),
                });
            }
            await onContinueAfterPayment();
        } catch (e) {
            toast.error(getResponseMessage(e, 'Erro ao pagar pendências.'));
        } finally {
            setSaving(false);
        }
    }

    async function forceContinue() {
        setSaving(true);
        try {
            await onForceContinue();
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={onClose}>
            <div className="w-full sm:max-w-2xl max-h-[90vh] rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                            <AlertTriangle size={20} />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Encontramos {pending.count} pendência{pending.count === 1 ? '' : 's'} em {groups.length} patota{groups.length === 1 ? '' : 's'}.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {groups.map(group => (
                        <div key={group.groupId} className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{group.groupName}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{group.playerName}</p>
                                </div>
                                <p className="text-sm font-black text-slate-900 dark:text-white">{currency(group.total)}</p>
                            </div>
                            <div className="p-3 space-y-2">
                                {group.items.map(item => {
                                    const checked = selected.has(item.id);
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => toggle(item.id)}
                                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 flex items-center gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
                                        >
                                            <span className={[
                                                'h-5 w-5 rounded-md border flex items-center justify-center shrink-0',
                                                checked ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:text-slate-900' : 'border-slate-300 dark:border-slate-600',
                                            ].join(' ')}>
                                                {checked && <Check size={14} />}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{item.description}</span>
                                                {item.discount > 0 && (
                                                    <span className="text-xs text-green-600">desconto de {currency(item.discount)}</span>
                                                )}
                                            </span>
                                            <span className="text-sm font-bold text-slate-900 dark:text-white">{currency(item.finalAmount)}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Selecionado para pagar</span>
                        <span className="font-black text-slate-900 dark:text-white">{currency(selectedTotal)}</span>
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row gap-2">
                        <button
                            type="button"
                            onClick={forceContinue}
                            disabled={saving}
                            className="flex-1 rounded-xl border border-amber-200 text-amber-700 bg-amber-50 py-2.5 text-sm font-semibold hover:bg-amber-100 disabled:opacity-50"
                        >
                            {forceLabel}
                        </button>
                        <button
                            type="button"
                            onClick={payAndContinue}
                            disabled={saving || selected.size === 0}
                            className="flex-1 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {saving && <Loader2 size={15} className="animate-spin" />}
                            Pagar e continuar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
