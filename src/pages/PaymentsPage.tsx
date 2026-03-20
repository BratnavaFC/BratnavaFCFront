import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
    CheckCircle2, XCircle, Plus, Trash2, ChevronDown, ChevronUp,
    Upload, Download, Loader2, CreditCard, DollarSign, Calendar, Users
} from 'lucide-react';
import useAccountStore from '../auth/accountStore';
import { PaymentsApi, GroupSettingsApi } from '../api/endpoints';

// ── Tipos locais ──────────────────────────────────────────────────────────────
interface MonthlyCell {
    month: number; status: number; amount: number; discount: number;
    discountReason?: string; paidAt?: string; hasProof: boolean; proofFileName?: string;
}
interface PlayerRow  { playerId: string; playerName: string; months: MonthlyCell[]; }
interface MonthlyGrid { year: number; monthlyFee?: number; players: PlayerRow[]; }

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

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const cls = (...c: (string|false|undefined)[]) => c.filter(Boolean).join(' ');

// ── Helpers ───────────────────────────────────────────────────────────────────
function fileToBase64(file: File): Promise<string> {
    return new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload  = () => res((reader.result as string).split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
    });
}

// ── Modal de pagamento mensal ─────────────────────────────────────────────────
interface MonthlyModalProps {
    groupId: string; row: PlayerRow; month: number; isAdmin: boolean;
    onClose(): void; onSaved(): void;
}
function MonthlyPaymentModal({ groupId, row, month, isAdmin, onClose, onSaved }: MonthlyModalProps) {
    const cell   = (row.months ?? []).find(c => c.month === month);
    const isPaid = cell?.status === 1;
    const [discount, setDiscount]   = useState(String(cell?.discount ?? 0));
    const [discReason, setDiscReason] = useState(cell?.discountReason ?? '');
    const [file, setFile]           = useState<File | null>(null);
    const [saving, setSaving]       = useState(false);

    async function submit(status: 0 | 1) {
        setSaving(true);
        try {
            let proofBase64: string | undefined;
            let proofFileName: string | undefined;
            let proofMimeType: string | undefined;
            if (file) {
                proofBase64   = await fileToBase64(file);
                proofFileName = file.name;
                proofMimeType = file.type;
            }
            await PaymentsApi.upsertMonthly(groupId, {
                playerId: row.playerId,
                year: new Date().getFullYear(),
                month,
                status,
                discount: isAdmin ? parseFloat(discount) || 0 : undefined,
                discountReason: isAdmin ? discReason || undefined : undefined,
                proofBase64, proofFileName, proofMimeType,
            });
            toast.success(status === 1 ? 'Marcado como pago!' : 'Marcado como pendente');
            onSaved();
            onClose();
        } catch { toast.error('Erro ao salvar pagamento'); }
        finally { setSaving(false); }
    }

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-slate-900 mb-1">
                    {row.playerName} — {MONTHS[month-1]}
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                    Valor: <span className="font-semibold">R$ {(cell?.amount ?? 0).toFixed(2)}</span>
                    {(cell?.discount ?? 0) > 0 && <> · Desconto: <span className="text-green-600 font-semibold">R$ {cell!.discount.toFixed(2)}</span></>}
                </p>

                {isAdmin && (
                    <div className="space-y-3 mb-4">
                        <div>
                            <label className="text-xs font-medium text-slate-600 block mb-1">Desconto (R$)</label>
                            <input type="number" min="0" step="0.01"
                                value={discount} onChange={e => setDiscount(e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-600 block mb-1">Motivo do desconto</label>
                            <input type="text" value={discReason} onChange={e => setDiscReason(e.target.value)}
                                placeholder="Opcional"
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                        </div>
                    </div>
                )}

                <div className="mb-5">
                    <label className="text-xs font-medium text-slate-600 block mb-1">
                        Comprovante {isAdmin ? '(opcional)' : '(opcional)'}
                    </label>
                    <input type="file" accept="image/*,application/pdf"
                        onChange={e => setFile(e.target.files?.[0] ?? null)}
                        className="block w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200" />
                    {cell?.hasProof && <p className="text-xs text-slate-400 mt-1">Comprovante já enviado: {cell.proofFileName}</p>}
                </div>

                <div className="flex gap-2">
                    {!isPaid && (
                        <button onClick={() => submit(1)} disabled={saving}
                            className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                            {saving ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>}
                            Marcar como pago
                        </button>
                    )}
                    {isPaid && isAdmin && (
                        <button onClick={() => submit(0)} disabled={saving}
                            className="flex-1 bg-rose-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-2">
                            {saving ? <Loader2 size={14} className="animate-spin"/> : <XCircle size={14}/>}
                            Marcar pendente
                        </button>
                    )}
                    {!isPaid && isAdmin && (
                        <button onClick={() => submit(0)} disabled={saving}
                            className="flex-1 border border-slate-200 text-slate-700 rounded-lg py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
                            Só salvar desconto
                        </button>
                    )}
                    <button onClick={onClose}
                        className="px-4 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Modal criar cobrança extra ─────────────────────────────────────────────────
interface CreateExtraChargeModalProps {
    groupId: string; players: { id: string; name: string }[];
    onClose(): void; onSaved(): void;
}
function CreateExtraChargeModal({ groupId, players, onClose, onSaved }: CreateExtraChargeModalProps) {
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
            await PaymentsApi.createExtraCharge(groupId, {
                name: name.trim(), description: desc.trim() || undefined,
                amount: parseFloat(amount),
                dueDate: dueDate || undefined,
                playerIds: [...selected],
            });
            toast.success('Cobrança criada!');
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

// ── Modal de pagamento de cobrança extra ──────────────────────────────────────
interface ExtraPaymentModalProps {
    groupId: string; charge: ExtraCharge; payment: ExtraChargePayment;
    isAdmin: boolean; onClose(): void; onSaved(): void;
}
function ExtraPaymentModal({ groupId, charge, payment, isAdmin, onClose, onSaved }: ExtraPaymentModalProps) {
    const isPaid = payment.status === 1;
    const [discount, setDiscount]     = useState(String(payment.discount ?? 0));
    const [discReason, setDiscReason] = useState(payment.discountReason ?? '');
    const [file, setFile]             = useState<File | null>(null);
    const [saving, setSaving]         = useState(false);

    async function submit(status: 0 | 1) {
        setSaving(true);
        try {
            let proofBase64: string | undefined;
            let proofFileName: string | undefined;
            let proofMimeType: string | undefined;
            if (file) {
                proofBase64   = await fileToBase64(file);
                proofFileName = file.name;
                proofMimeType = file.type;
            }
            await PaymentsApi.upsertExtraChargePayment(groupId, charge.id, payment.playerId, {
                status,
                discount: isAdmin ? parseFloat(discount) || 0 : undefined,
                discountReason: isAdmin ? discReason || undefined : undefined,
                proofBase64, proofFileName, proofMimeType,
            });
            toast.success(status === 1 ? 'Marcado como pago!' : 'Marcado como pendente');
            onSaved(); onClose();
        } catch { toast.error('Erro ao salvar pagamento'); }
        finally { setSaving(false); }
    }

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-slate-900 mb-1">{payment.playerName}</h3>
                <p className="text-sm text-slate-500 mb-4">
                    {charge.name} · R$ {payment.amount.toFixed(2)}
                    {payment.discount > 0 && <> · Desconto: <span className="text-green-600 font-semibold">R$ {payment.discount.toFixed(2)}</span></>}
                </p>

                {isAdmin && (
                    <div className="space-y-3 mb-4">
                        <div>
                            <label className="text-xs font-medium text-slate-600 block mb-1">Desconto (R$)</label>
                            <input type="number" min="0" step="0.01"
                                value={discount} onChange={e => setDiscount(e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-600 block mb-1">Motivo do desconto</label>
                            <input type="text" value={discReason} onChange={e => setDiscReason(e.target.value)} placeholder="Opcional"
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                        </div>
                    </div>
                )}

                <div className="mb-5">
                    <label className="text-xs font-medium text-slate-600 block mb-1">Comprovante (opcional)</label>
                    <input type="file" accept="image/*,application/pdf"
                        onChange={e => setFile(e.target.files?.[0] ?? null)}
                        className="block w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200" />
                    {payment.hasProof && <p className="text-xs text-slate-400 mt-1">Já enviado: {payment.proofFileName}</p>}
                </div>

                <div className="flex gap-2">
                    {!isPaid && (
                        <button onClick={() => submit(1)} disabled={saving}
                            className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                            {saving ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>}
                            Marcar como pago
                        </button>
                    )}
                    {isPaid && isAdmin && (
                        <button onClick={() => submit(0)} disabled={saving}
                            className="flex-1 bg-rose-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-2">
                            {saving ? <Loader2 size={14} className="animate-spin"/> : <XCircle size={14}/>}
                            Marcar pendente
                        </button>
                    )}
                    {!isPaid && isAdmin && (
                        <button onClick={() => submit(0)} disabled={saving}
                            className="flex-1 border border-slate-200 text-slate-700 rounded-lg py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
                            Só desconto
                        </button>
                    )}
                    <button onClick={onClose} className="px-4 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Modal desconto em massa (cobranças extras) ────────────────────────────────
interface BulkExtraDiscountModalProps {
    groupId: string; charge: ExtraCharge;
    onClose(): void; onSaved(): void;
}
function BulkExtraDiscountModal({ groupId, charge, onClose, onSaved }: BulkExtraDiscountModalProps) {
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
            await PaymentsApi.bulkDiscountExtraCharge(groupId, charge.id, {
                discount: parseFloat(discount),
                discountReason: reason.trim() || undefined,
                playerIds: [...selected],
            });
            toast.success(`Desconto aplicado para ${selected.size} jogador${selected.size !== 1 ? 'es' : ''}!`);
            onSaved(); onClose();
        } catch { toast.error('Erro ao aplicar desconto'); }
        finally { setSaving(false); }
    }

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Desconto em massa</h3>
                <p className="text-sm text-slate-500 mb-4">
                    Cobrança: <span className="font-semibold text-slate-700">{charge.name}</span> · R$ {charge.amount.toFixed(2)}
                </p>

                <div className="space-y-3 mb-4">
                    <div>
                        <label className="text-xs font-medium text-slate-600 block mb-1">Desconto (R$) *</label>
                        <input type="number" min="0.01" step="0.01" placeholder="0,00"
                            value={discount} onChange={e => setDiscount(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-600 block mb-1">Motivo (opcional)</label>
                        <input type="text" placeholder="Ex: Desconto de fidelidade"
                            value={reason} onChange={e => setReason(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                    </div>
                </div>

                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-slate-600">Jogadores *</label>
                        <button onClick={toggleAll} className="text-xs text-slate-500 hover:text-slate-800 underline">
                            {selected.size === allPlayers.length ? 'Desmarcar todos' : 'Marcar todos'}
                        </button>
                    </div>
                    <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {allPlayers.map(p => (
                            <label key={p.playerId} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                                <input type="checkbox" checked={selected.has(p.playerId)}
                                    onChange={() => {
                                        const s = new Set(selected);
                                        s.has(p.playerId) ? s.delete(p.playerId) : s.add(p.playerId);
                                        setSelected(s);
                                    }}
                                    className="rounded border-slate-300 text-slate-900" />
                                <span className="flex-1 text-sm text-slate-700">{p.playerName}</span>
                                <span className={cls(
                                    'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                                    p.status === 1 ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-500'
                                )}>
                                    {p.status === 1 ? 'Pago' : 'Pendente'}
                                </span>
                            </label>
                        ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{selected.size} de {allPlayers.length} selecionados</p>
                </div>

                {discount && parseFloat(discount) > 0 && selected.size > 0 && (
                    <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                        Aplicará <strong>R$ {parseFloat(discount).toFixed(2)}</strong> de desconto para{' '}
                        <strong>{selected.size} jogador{selected.size !== 1 ? 'es' : ''}</strong>.
                    </div>
                )}

                <div className="flex gap-2">
                    <button onClick={submit} disabled={saving}
                        className="flex-1 bg-slate-900 text-white rounded-lg py-2 text-sm font-semibold hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center gap-2">
                        {saving ? <Loader2 size={14} className="animate-spin"/> : <DollarSign size={14}/>}
                        Aplicar desconto
                    </button>
                    <button onClick={onClose} className="px-4 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Componente de card de cobrança extra (admin) ──────────────────────────────
interface ChargeCardProps {
    charge: ExtraCharge; open: boolean; paidCt: number; pendCt: number;
    finalized?: boolean; groupId: string;
    onToggle(): void; onBulkDiscount(): void; onCancel(): void;
    onEditPayment(payment: ExtraChargePayment): void;
}
function ChargeCard({ charge, open, paidCt, pendCt, finalized, groupId, onToggle, onBulkDiscount, onCancel, onEditPayment }: ChargeCardProps) {
    return (
        <div className={cls(
            'border rounded-xl overflow-hidden',
            charge.isCancelled ? 'opacity-50 border-slate-200 bg-white' :
            finalized ? 'border-green-200 bg-green-50/30' : 'border-slate-200 bg-white'
        )}>
            <div className="flex items-center gap-3 px-4 py-3">
                <button className="flex-1 text-left" onClick={onToggle}>
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900">{charge.name}</span>
                        {charge.isCancelled && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Cancelada</span>}
                        {finalized && !charge.isCancelled && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 size={10}/>Finalizada</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                        <span>R$ {charge.amount.toFixed(2)}</span>
                        {charge.dueDate && <span>Venc. {new Date(charge.dueDate).toLocaleDateString('pt-BR')}</span>}
                        <span className="text-green-600 font-medium">{paidCt} pago{paidCt !== 1 ? 's' : ''}</span>
                        {pendCt > 0 && <span className="text-red-500 font-medium">{pendCt} pendente{pendCt !== 1 ? 's' : ''}</span>}
                    </div>
                </button>
                <div className="flex items-center gap-2">
                    {!charge.isCancelled && charge.payments.length > 0 && (
                        <button onClick={e => { e.stopPropagation(); onBulkDiscount(); }}
                            className="flex items-center gap-1 px-2 py-1 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-medium transition"
                            title="Desconto em massa">
                            <DollarSign size={12} /> Desc. massa
                        </button>
                    )}
                    {!charge.isCancelled && (
                        <button onClick={onCancel}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                            title="Cancelar cobrança">
                            <Trash2 size={14} />
                        </button>
                    )}
                    {open ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
                </div>
            </div>
            {open && (
                <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {charge.payments.length === 0 && (
                        <p className="text-xs text-slate-400 px-4 py-3">Nenhum jogador atribuído.</p>
                    )}
                    {charge.payments.map(payment => {
                        const paid = payment.status === 1;
                        return (
                            <div key={payment.playerId} className="flex items-center gap-3 px-4 py-2.5">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-800 truncate">{payment.playerName}</p>
                                    <p className="text-xs text-slate-500">
                                        R$ {payment.finalAmount.toFixed(2)}
                                        {payment.discount > 0 && <span className="text-green-600 ml-1">(desconto R$ {payment.discount.toFixed(2)})</span>}
                                        {payment.paidAt && <span className="ml-2">· {new Date(payment.paidAt).toLocaleDateString('pt-BR')}</span>}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {payment.hasProof && (
                                        <button onClick={async () => {
                                            try {
                                                const res = await PaymentsApi.getExtraChargeProof(groupId, charge.id, payment.playerId);
                                                const { base64, fileName, mimeType } = res.data;
                                                const link = document.createElement('a');
                                                link.href = `data:${mimeType};base64,${base64}`;
                                                link.download = fileName; link.click();
                                            } catch { toast.error('Erro ao baixar comprovante'); }
                                        }} title="Baixar comprovante" className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                                            <Download size={13} />
                                        </button>
                                    )}
                                    <span className={cls(
                                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                                        paid ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-500'
                                    )}>
                                        {paid ? <CheckCircle2 size={11}/> : <XCircle size={11}/>}
                                        {paid ? 'Pago' : 'Pendente'}
                                    </span>
                                    {!charge.isCancelled && (
                                        <button onClick={() => onEditPayment(payment)}
                                            className="text-xs px-2 py-1 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition">
                                            Editar
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function PaymentsPage() {
    const active             = useAccountStore(s => s.getActive());
    const isGroupFinanceiro  = useAccountStore(s => s.isGroupFinanceiro);
    const groupId            = active?.activeGroupId ?? '';
    const activePlayerId     = active?.activePlayerId ?? '';
    const isAdmin = !!(active && (
        active.roles.includes('GodMode') ||
        (active.activeGroupId && isGroupFinanceiro(active.activeGroupId))
    ));

    const [paymentMode, setPaymentMode] = useState<number>(0); // 0=Monthly, 1=PerGame
    const [tab, setTab]           = useState<'monthly' | 'extra'>('monthly');
    const [year, setYear]         = useState(new Date().getFullYear());
    const [grid, setGrid]         = useState<MonthlyGrid | null>(null);
    const [charges, setCharges]   = useState<ExtraCharge[]>([]);
    const [loading, setLoading]   = useState(false);
    const [extraYear, setExtraYear]   = useState(new Date().getFullYear());
    const [extraMonth, setExtraMonth] = useState(new Date().getMonth() + 1);

    // Modais
    const [monthModal, setMonthModal]             = useState<{ row: PlayerRow; month: number } | null>(null);
    const [createModal, setCreateModal]           = useState(false);
    const [bulkDiscountCharge, setBulkDiscountCharge] = useState<ExtraCharge | null>(null);
    const [extraModal, setExtraModal]             = useState<{ charge: ExtraCharge; payment: ExtraChargePayment } | null>(null);
    const [expanded, setExpanded]                 = useState<Set<string>>(new Set());

    // User (non-admin) view data
    const [myRow, setMyRow]           = useState<PlayerRow | null | undefined>(undefined); // undefined=loading, null=sem player
    const [myCharges, setMyCharges]   = useState<ExtraCharge[]>([]);

    // Load payment mode from group settings
    useEffect(() => {
        if (!groupId) return;
        GroupSettingsApi.get(groupId)
            .then(res => {
                const mode = (res.data as any)?.paymentMode ?? 0;
                setPaymentMode(mode);
                // If PerGame, switch to extra tab
                if (mode === 1) setTab('extra');
            })
            .catch(() => {/* silently ignore */});
    }, [groupId]);

    // Loaders para usuário não-admin
    const loadMyData = useCallback(async () => {
        if (!groupId || isAdmin) return;
        try {
            const [rowRes, chargesRes] = await Promise.all([
                PaymentsApi.getMyMonthlyRow(groupId, year),
                PaymentsApi.getMyExtraCharges(groupId),
            ]);
            const rowData = rowRes.data;
            setMyRow(rowData ? { ...rowData, months: rowData.months ?? [] } : null);
            setMyCharges(chargesRes.data ?? []);
        } catch { toast.error('Erro ao carregar seus pagamentos'); }
    }, [groupId, year, isAdmin, activePlayerId]);

    useEffect(() => { if (!isAdmin && groupId) loadMyData(); }, [isAdmin, groupId, year, loadMyData]);

    const loadMonthly = useCallback(async () => {
        if (!groupId) return;
        setLoading(true);
        try {
            const res = await PaymentsApi.getMonthlyGrid(groupId, year);
            setGrid(res.data);
        } catch { toast.error('Erro ao carregar grade mensal'); }
        finally { setLoading(false); }
    }, [groupId, year]);

    const loadExtra = useCallback(async () => {
        if (!groupId) return;
        setLoading(true);
        try {
            const res = await PaymentsApi.getExtraCharges(groupId);
            setCharges(res.data);
        } catch { toast.error('Erro ao carregar cobranças'); }
        finally { setLoading(false); }
    }, [groupId]);

    useEffect(() => { if (isAdmin && tab === 'monthly') loadMonthly(); }, [isAdmin, tab, loadMonthly]);
    useEffect(() => { if (isAdmin && tab === 'extra')   loadExtra();   }, [isAdmin, tab, loadExtra]);

    // Jogadores para a modal de criar cobrança extra
    const mensalistas = grid?.players.map(p => ({ id: p.playerId, name: p.playerName })) ?? [];

    async function cancelCharge(chargeId: string) {
        if (!confirm('Cancelar esta cobrança?')) return;
        try {
            await PaymentsApi.cancelExtraCharge(groupId, chargeId);
            toast.success('Cobrança cancelada');
            loadExtra();
        } catch { toast.error('Erro ao cancelar'); }
    }

    // ── Helpers para cobranças extras mensais ─────────────────────────────────
    const cYear  = (c: ExtraCharge) => new Date(c.createdAt).getFullYear();
    const cMonth = (c: ExtraCharge) => new Date(c.createdAt).getMonth() + 1;
    const isFinalizada = (c: ExtraCharge) =>
        !c.isCancelled && c.payments.length > 0 && c.payments.every(p => p.status === 1);

    // Status de cada mês para o seletor (admin)
    const extraMonthsStatus = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const mc = charges.filter(c => cYear(c) === extraYear && cMonth(c) === m);
        const active = mc.filter(c => !c.isCancelled);
        return {
            month: m,
            count: mc.length,
            allPaid: active.length > 0 && active.every(isFinalizada),
            hasPending: active.some(c => !isFinalizada(c)),
        };
    });
    const selectedCharges    = charges.filter(c => cYear(c) === extraYear && cMonth(c) === extraMonth);
    const currentAdminCharges  = selectedCharges.filter(c => !isFinalizada(c));
    const finalizedAdminCharges = selectedCharges.filter(isFinalizada);

    // Status de cada mês para o seletor (non-admin)
    const myExtraMonthsStatus = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const mc = myCharges.filter(c => cYear(c) === extraYear && cMonth(c) === m);
        const active = mc.filter(c => !c.isCancelled);
        return {
            month: m,
            count: mc.length,
            allPaid: active.length > 0 && active.every(c => { const p = c.payments[0]; return !!p && p.status === 1; }),
            hasPending: active.some(c => { const p = c.payments[0]; return !p || p.status !== 1; }),
        };
    });
    const mySelectedCharges    = myCharges.filter(c => cYear(c) === extraYear && cMonth(c) === extraMonth);
    const myCurrentCharges     = mySelectedCharges.filter(c => { const p = c.payments[0]; return !c.isCancelled && (!p || p.status !== 1); });
    const myFinalizedCharges   = mySelectedCharges.filter(c => { const p = c.payments[0]; return !c.isCancelled && !!p && p.status === 1; });

    if (!groupId) {
        return (
            <div className="p-6 text-slate-500 text-sm">Selecione uma patota para ver os pagamentos.</div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* ── Header ── */}
            <div className="relative flex-none bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-4 sm:px-6 py-4 sm:py-5 overflow-hidden shadow-lg">
                <div className="absolute inset-0 pointer-events-none opacity-[0.06]"
                    style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4 pointer-events-none" />

                {/* Row 1: icon + title */}
                <div className="relative flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                        <CreditCard size={20} />
                    </div>
                    <div>
                        <h1 className="text-lg font-black leading-tight">Pagamentos</h1>
                        <p className="text-xs text-white/50">Mensalidades e cobranças extras da patota</p>
                    </div>
                </div>

                {/* Row 2: abas */}
                <div className="relative flex gap-1">
                    {paymentMode === 0 && (
                        <button onClick={() => setTab('monthly')}
                            className={cls(
                                'px-4 py-1.5 rounded-lg text-xs font-semibold transition',
                                tab === 'monthly' ? 'bg-white text-slate-900' : 'bg-white/10 text-white/80 hover:bg-white/20'
                            )}>
                            📅 Mensalidades
                        </button>
                    )}
                    <button onClick={() => setTab('extra')}
                        className={cls(
                            'px-4 py-1.5 rounded-lg text-xs font-semibold transition',
                            tab === 'extra' ? 'bg-white text-slate-900' : 'bg-white/10 text-white/80 hover:bg-white/20'
                        )}>
                        💰 Cobranças extras
                    </button>
                </div>
            </div>

            {/* Conteúdo */}
            <div className="flex-1 overflow-auto px-4 sm:px-6 py-4">

                {/* === VIEW NÃO-ADMIN === */}
                {/* Mensalidades do usuário */}
                {!isAdmin && tab === 'monthly' && paymentMode === 0 && (
                    <div>
                        <div className="flex items-center gap-3 mb-4 flex-wrap">
                            <h2 className="text-base font-semibold text-slate-800">📅 Minhas mensalidades</h2>
                            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                                <button onClick={() => setYear(y => y - 1)} className="px-2 py-1 rounded text-slate-600 hover:bg-white text-sm">‹</button>
                                <span className="px-3 text-sm font-semibold text-slate-800">{year}</span>
                                <button onClick={() => setYear(y => y + 1)} className="px-2 py-1 rounded text-slate-600 hover:bg-white text-sm">›</button>
                            </div>
                        </div>

                                {myRow === undefined ? (
                                    <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
                                ) : myRow === null ? (
                                    <div className="text-center py-10 text-slate-400 text-sm">
                                        Você não tem um jogador vinculado nesta patota.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                        {(myRow.months ?? [])
                                            .filter(cell => year < new Date().getFullYear()
                                                ? true
                                                : cell.month <= new Date().getMonth() + 1)
                                            .map(cell => {
                                            const paid = cell.status === 1;
                                            return (
                                                <button
                                                    key={cell.month}
                                                    onClick={() => setMonthModal({ row: myRow, month: cell.month })}
                                                    className={cls(
                                                        'rounded-xl border p-3 text-center transition hover:shadow-sm',
                                                        paid ? 'border-green-200 bg-green-50' : 'border-red-100 bg-red-50/60'
                                                    )}>
                                                    <div className="text-xs font-semibold text-slate-500 mb-1">{MONTHS[cell.month - 1]}</div>
                                                    {paid
                                                        ? <CheckCircle2 size={20} className="text-green-500 mx-auto" />
                                                        : <XCircle size={20} className="text-red-400 mx-auto" />}
                                                    {cell.amount > 0 && (
                                                        <div className="text-[10px] text-slate-400 mt-1">R$ {cell.amount.toFixed(2)}</div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                {/* Cobranças extras do usuário */}
                {!isAdmin && tab === 'extra' && (
                    <div>
                        {/* Seletor de ano+mês */}
                        <div className="flex items-center gap-2 mb-4 flex-wrap">
                            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                                <button onClick={() => setExtraYear(y => y - 1)} className="px-2 py-1 rounded text-slate-600 hover:bg-white text-sm">‹</button>
                                <span className="px-3 text-sm font-semibold text-slate-800">{extraYear}</span>
                                <button onClick={() => setExtraYear(y => y + 1)} className="px-2 py-1 rounded text-slate-600 hover:bg-white text-sm">›</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 mb-5">
                            {myExtraMonthsStatus.map(({ month, count, allPaid, hasPending }) => (
                                <button key={month} onClick={() => setExtraMonth(month)}
                                    className={cls(
                                        'rounded-lg py-1.5 text-center text-xs transition border flex flex-col items-center gap-0.5',
                                        extraMonth === month ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 hover:bg-slate-50',
                                        count === 0 && extraMonth !== month && 'opacity-40'
                                    )}>
                                    <span className="font-medium">{MONTHS[month - 1]}</span>
                                    <span className={cls(
                                        'w-2 h-2 rounded-full',
                                        count === 0 ? 'bg-transparent' :
                                        allPaid ? (extraMonth === month ? 'bg-green-300' : 'bg-green-400') :
                                        hasPending ? (extraMonth === month ? 'bg-red-300' : 'bg-red-400') : 'bg-slate-300'
                                    )} />
                                </button>
                            ))}
                        </div>

                        {myCurrentCharges.length === 0 && myFinalizedCharges.length === 0 ? (
                            <div className="text-center py-10 text-slate-400">
                                <DollarSign size={32} className="mx-auto mb-2 opacity-40" />
                                <p className="text-sm">Nenhuma cobrança em {MONTHS[extraMonth - 1]}/{extraYear}.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {myCurrentCharges.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-700 mb-2">📌 Pendentes</h3>
                                        <div className="space-y-2">
                                            {myCurrentCharges.map(charge => {
                                                const payment = charge.payments[0];
                                                if (!payment) return null;
                                                const paid = payment.status === 1;
                                                return (
                                                    <div key={charge.id} className="border border-slate-200 rounded-xl bg-white p-4 flex items-center gap-4">
                                                        <div className="flex-1 min-w-0">
                                                            <span className="font-semibold text-sm text-slate-900">{charge.name}</span>
                                                            <div className="text-xs text-slate-500 mt-0.5 flex gap-3 flex-wrap">
                                                                <span>R$ {payment.finalAmount.toFixed(2)}</span>
                                                                {payment.discount > 0 && <span className="text-green-600">Desconto: R$ {payment.discount.toFixed(2)}</span>}
                                                                {charge.dueDate && <span>Venc. {new Date(charge.dueDate).toLocaleDateString('pt-BR')}</span>}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-500">
                                                                <XCircle size={11}/> Pendente
                                                            </span>
                                                            <button onClick={() => setExtraModal({ charge, payment })}
                                                                className="text-xs px-2 py-1 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                                                                {paid ? 'Ver' : 'Pagar'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                {myFinalizedCharges.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-700 mb-2">✅ Pagas</h3>
                                        <div className="space-y-2">
                                            {myFinalizedCharges.map(charge => {
                                                const payment = charge.payments[0];
                                                if (!payment) return null;
                                                return (
                                                    <div key={charge.id} className="border border-green-100 rounded-xl bg-green-50/40 p-4 flex items-center gap-4">
                                                        <div className="flex-1 min-w-0">
                                                            <span className="font-semibold text-sm text-slate-700">{charge.name}</span>
                                                            <div className="text-xs text-slate-500 mt-0.5 flex gap-3 flex-wrap">
                                                                <span>R$ {payment.finalAmount.toFixed(2)}</span>
                                                                {payment.discount > 0 && <span className="text-green-600">Desconto: R$ {payment.discount.toFixed(2)}</span>}
                                                                {payment.paidAt && <span>Pago em {new Date(payment.paidAt).toLocaleDateString('pt-BR')}</span>}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {payment.hasProof && (
                                                                <button onClick={async () => {
                                                                    try {
                                                                        const res = await PaymentsApi.getExtraChargeProof(groupId, charge.id, payment.playerId);
                                                                        const { base64, fileName, mimeType } = res.data;
                                                                        const link = document.createElement('a'); link.href = `data:${mimeType};base64,${base64}`; link.download = fileName; link.click();
                                                                    } catch { toast.error('Erro ao baixar comprovante'); }
                                                                }} title="Baixar comprovante" className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg">
                                                                    <Download size={14} />
                                                                </button>
                                                            )}
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                                <CheckCircle2 size={11}/> Pago
                                                            </span>
                                                            <button onClick={() => setExtraModal({ charge, payment })}
                                                                className="text-xs px-2 py-1 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                                                                Ver
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        </div>
                )}

                {/* === ABA MENSALIDADES (admin only) === */}
                {isAdmin && tab === 'monthly' && (
                    <div>
                        <div className="flex items-center gap-3 mb-4 flex-wrap">
                            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                                <button onClick={() => setYear(y => y - 1)}
                                    className="px-2 py-1 rounded text-slate-600 hover:bg-white text-sm">‹</button>
                                <span className="px-3 text-sm font-semibold text-slate-800">{year}</span>
                                <button onClick={() => setYear(y => y + 1)}
                                    className="px-2 py-1 rounded text-slate-600 hover:bg-white text-sm">›</button>
                            </div>
                            {grid?.monthlyFee != null && (
                                <span className="text-sm text-slate-500">
                                    Mensalidade: <strong>R$ {grid.monthlyFee.toFixed(2)}</strong>
                                </span>
                            )}
                            {!grid?.monthlyFee && (
                                <span className="text-sm text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">
                                    Mensalidade não configurada nas settings da patota
                                </span>
                            )}
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-16">
                                <Loader2 size={28} className="animate-spin text-slate-400" />
                            </div>
                        ) : !grid || grid.players.length === 0 ? (
                            <div className="text-center py-16 text-slate-400">
                                <Users size={40} className="mx-auto mb-2 opacity-40" />
                                <p className="text-sm">Nenhum mensalista encontrado nesta patota.</p>
                                <p className="text-xs mt-1">Jogadores sem conta vinculada ou convidados não aparecem aqui.</p>
                            </div>
                        ) : (
                            /* Grade responsiva */
                            (() => {
                                const currentMonth = year < new Date().getFullYear() ? 12 : new Date().getMonth() + 1;
                                return (
                                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                                        <table className="w-full text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200">
                                                    <th className="text-left px-3 py-2 font-semibold text-slate-600 sticky left-0 bg-slate-50 z-10 min-w-[120px]">Jogador</th>
                                                    {MONTHS.map((m, i) => (
                                                        <th key={i} className={cls('px-2 py-2 font-semibold text-center w-10', i + 1 <= currentMonth ? 'text-slate-500' : 'text-slate-300')}>{m}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {grid.players.map(row => (
                                                    <tr key={row.playerId} className="hover:bg-slate-50/50">
                                                        <td className="px-3 py-2 font-medium text-slate-800 sticky left-0 bg-white z-10 whitespace-nowrap border-r border-slate-100">
                                                            {row.playerName}
                                                        </td>
                                                        {MONTHS.map((_, i) => {
                                                            const m = i + 1;
                                                            const cell = row.months.find(c => c.month === m);
                                                            // Mês futuro ou antes da entrada — traço cinza
                                                            if (!cell) {
                                                                return <td key={m} className="px-1 py-1.5 text-center"><span className="text-slate-200 text-xs">—</span></td>;
                                                            }
                                                            const paid = cell.status === 1;
                                                            return (
                                                                <td key={m} className="px-1 py-1.5 text-center">
                                                                    <button
                                                                        onClick={() => isAdmin && setMonthModal({ row, month: cell.month })}
                                                                        title={paid ? `Pago${cell.discount > 0 ? ` (desconto R$ ${cell.discount.toFixed(2)})` : ''}` : 'Pendente'}
                                                                        className={cls(
                                                                            'w-7 h-7 rounded-full flex items-center justify-center mx-auto transition',
                                                                            paid
                                                                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                                                : 'bg-red-50 text-red-400 hover:bg-red-100',
                                                                            !isAdmin && 'cursor-default',
                                                                        )}>
                                                                        {paid
                                                                            ? <CheckCircle2 size={14} />
                                                                            : <XCircle size={14} />}
                                                                    </button>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })()
                        )}
                    </div>
                )}

                {/* === ABA COBRANÇAS EXTRAS (admin only) === */}
                {isAdmin && tab === 'extra' && (
                    <div>
                        {/* Toolbar */}
                        <div className="flex items-center gap-3 mb-4 flex-wrap">
                            <button onClick={() => { if (!grid) { loadMonthly(); } setCreateModal(true); }}
                                className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-700 transition">
                                <Plus size={16} /> Nova cobrança
                            </button>
                            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                                <button onClick={() => setExtraYear(y => y - 1)} className="px-2 py-1 rounded text-slate-600 hover:bg-white text-sm">‹</button>
                                <span className="px-3 text-sm font-semibold text-slate-800">{extraYear}</span>
                                <button onClick={() => setExtraYear(y => y + 1)} className="px-2 py-1 rounded text-slate-600 hover:bg-white text-sm">›</button>
                            </div>
                        </div>

                        {/* Seletor de mês */}
                        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 mb-5">
                            {extraMonthsStatus.map(({ month, count, allPaid, hasPending }) => (
                                <button key={month} onClick={() => setExtraMonth(month)}
                                    className={cls(
                                        'rounded-lg py-1.5 text-center text-xs transition border flex flex-col items-center gap-0.5',
                                        extraMonth === month ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 hover:bg-slate-50',
                                        count === 0 && extraMonth !== month && 'opacity-40'
                                    )}>
                                    <span className="font-medium">{MONTHS[month - 1]}</span>
                                    <span className={cls(
                                        'w-2 h-2 rounded-full',
                                        count === 0 ? 'bg-transparent' :
                                        allPaid ? (extraMonth === month ? 'bg-green-300' : 'bg-green-500') :
                                        hasPending ? (extraMonth === month ? 'bg-red-300' : 'bg-red-500') : 'bg-slate-300'
                                    )} />
                                </button>
                            ))}
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-16">
                                <Loader2 size={28} className="animate-spin text-slate-400" />
                            </div>
                        ) : currentAdminCharges.length === 0 && finalizedAdminCharges.length === 0 ? (
                            <div className="text-center py-16 text-slate-400">
                                <DollarSign size={40} className="mx-auto mb-2 opacity-40" />
                                <p className="text-sm">Nenhuma cobrança em {MONTHS[extraMonth - 1]}/{extraYear}.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Cobranças correntes */}
                                {currentAdminCharges.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-700 mb-2">📌 Cobranças correntes</h3>
                                        <div className="space-y-2">
                                            {currentAdminCharges.map(charge => {
                                                const open   = expanded.has(charge.id);
                                                const paidCt = charge.payments.filter(p => p.status === 1).length;
                                                const pendCt = charge.payments.filter(p => p.status !== 1).length;
                                                return <ChargeCard key={charge.id} charge={charge} open={open}
                                                    paidCt={paidCt} pendCt={pendCt}
                                                    onToggle={() => { const s = new Set(expanded); s.has(charge.id) ? s.delete(charge.id) : s.add(charge.id); setExpanded(s); }}
                                                    onBulkDiscount={() => setBulkDiscountCharge(charge)}
                                                    onCancel={() => cancelCharge(charge.id)}
                                                    onEditPayment={(payment) => setExtraModal({ charge, payment })}
                                                    groupId={groupId} />;
                                            })}
                                        </div>
                                    </div>
                                )}
                                {/* Cobranças finalizadas */}
                                {finalizedAdminCharges.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-700 mb-2">✅ Cobranças finalizadas</h3>
                                        <div className="space-y-2">
                                            {finalizedAdminCharges.map(charge => {
                                                const open   = expanded.has(charge.id);
                                                const paidCt = charge.payments.filter(p => p.status === 1).length;
                                                return <ChargeCard key={charge.id} charge={charge} open={open}
                                                    paidCt={paidCt} pendCt={0} finalized
                                                    onToggle={() => { const s = new Set(expanded); s.has(charge.id) ? s.delete(charge.id) : s.add(charge.id); setExpanded(s); }}
                                                    onBulkDiscount={() => setBulkDiscountCharge(charge)}
                                                    onCancel={() => cancelCharge(charge.id)}
                                                    onEditPayment={(payment) => setExtraModal({ charge, payment })}
                                                    groupId={groupId} />;
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modais */}
            {monthModal && (
                <MonthlyPaymentModal
                    groupId={groupId}
                    row={monthModal.row}
                    month={monthModal.month}
                    isAdmin={isAdmin}
                    onClose={() => setMonthModal(null)}
                    onSaved={isAdmin ? loadMonthly : loadMyData}
                />
            )}
            {bulkDiscountCharge && (
                <BulkExtraDiscountModal
                    groupId={groupId}
                    charge={bulkDiscountCharge}
                    onClose={() => setBulkDiscountCharge(null)}
                    onSaved={loadExtra}
                />
            )}
            {createModal && (
                <CreateExtraChargeModal
                    groupId={groupId}
                    players={mensalistas}
                    onClose={() => setCreateModal(false)}
                    onSaved={loadExtra}
                />
            )}
            {extraModal && (
                <ExtraPaymentModal
                    groupId={groupId}
                    charge={extraModal.charge}
                    payment={extraModal.payment}
                    isAdmin={isAdmin}
                    onClose={() => setExtraModal(null)}
                    onSaved={isAdmin ? loadExtra : loadMyData}
                />
            )}
        </div>
    );
}
