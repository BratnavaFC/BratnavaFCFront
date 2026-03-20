import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
    CheckCircle2, XCircle, Plus, Trash2, ChevronDown, ChevronUp,
    Upload, Download, Loader2, CreditCard, DollarSign, Calendar, Users
} from 'lucide-react';
import useAccountStore from '../auth/accountStore';
import { PaymentsApi, GroupSettingsApi } from '../api/endpoints';
import MonthlyPaymentModal from '../components/modals/MonthlyPaymentModal';
import CreateExtraChargeModal from '../components/modals/CreateExtraChargeModal';
import ExtraPaymentModal from '../components/modals/ExtraPaymentModal';
import BulkExtraDiscountModal from '../components/modals/BulkExtraDiscountModal';

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
                    open={true}
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
                    open={true}
                    groupId={groupId}
                    charge={bulkDiscountCharge}
                    onClose={() => setBulkDiscountCharge(null)}
                    onSaved={loadExtra}
                />
            )}
            {createModal && (
                <CreateExtraChargeModal
                    open={true}
                    groupId={groupId}
                    players={mensalistas}
                    onClose={() => setCreateModal(false)}
                    onSaved={loadExtra}
                />
            )}
            {extraModal && (
                <ExtraPaymentModal
                    open={true}
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
