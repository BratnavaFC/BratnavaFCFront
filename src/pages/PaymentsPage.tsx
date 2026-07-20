import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import {
    CheckCircle2, XCircle, Plus, Trash2, ChevronDown, ChevronUp,
    Upload, Download, Loader2, DollarSign, Calendar, Users,
    TrendingUp, TrendingDown, Wallet, ArrowUpCircle, ArrowDownCircle, RefreshCw,
    Pencil, RotateCcw, Info
} from 'lucide-react';
import useAccountStore from '../auth/accountStore';
import { PaymentsApi, GroupSettingsApi, TransactionsApi } from '../api/endpoints';
import { getResponseMessage } from '../api/apiResponse';
import { usePaymentStore, calcPendingPaymentsCount } from '../stores/paymentStore';
import MonthlyPaymentModal from '../components/modals/MonthlyPaymentModal';
import CreateExtraChargeModal from '../components/modals/CreateExtraChargeModal';
import ExtraPaymentModal from '../components/modals/ExtraPaymentModal';
import BulkExtraDiscountModal from '../components/modals/BulkExtraDiscountModal';
import PaymentSelectModal from '../components/modals/PaymentSelectModal';
import LoadMoreButton from '../components/LoadMoreButton';
import { useConfirm } from '../components/ConfirmDialog';

// ── Tipos locais ──────────────────────────────────────────────────────────────
interface MonthlyCell {
    month: number; status: number; amount: number; discount: number;
    discountReason?: string; paidAt?: string; markedByUserId?: string;
    markedByUserName?: string; markedByUserKind?: string;
    hasProof: boolean; proofFileName?: string;
}
interface PlayerRow  { playerId: string; playerName: string; months: MonthlyCell[]; isGoalkeeper?: boolean; }
interface MonthlyGrid { year: number; monthlyFee?: number; goalkeeperMonthlyFee?: number; players: PlayerRow[]; }

interface ExtraChargePayment {
    playerId: string; playerName: string; amount: number; discount: number;
    finalAmount: number; discountReason?: string; status: number;
    paidAt?: string; markedByUserId?: string; markedByUserName?: string;
    markedByUserKind?: string; hasProof: boolean; proofFileName?: string;
}
interface ExtraCharge {
    id: string; name: string; description?: string; amount: number;
    dueDate?: string; createdAt: string; isCancelled: boolean;
    payments: ExtraChargePayment[];
}

const MONTHS      = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const CATEGORY_NAMES = ['Aluguel de Quadra','Arbitragem','Uniforme','Material','Outros'];

const cls = (...c: (string|false|undefined)[]) => c.filter(Boolean).join(' ');
const paymentAuditText = (paidAt?: string, markedByUserName?: string, markedByUserKind?: string) => {
    if (!paidAt) return '';
    const date = new Date(paidAt).toLocaleDateString('pt-BR');
    if (!markedByUserName) return `Pago em ${date}`;
    const suffix = markedByUserKind === 'self' ? ' (próprio usuário)' : '';
    return `Pago em ${date} por ${markedByUserName}${suffix}`;
};

function PaymentAuditInfoButton({ paidAt, markedByUserName, markedByUserKind }: {
    paidAt?: string; markedByUserName?: string; markedByUserKind?: string;
}) {
    if (!paidAt) return null;
    const text = paymentAuditText(paidAt, markedByUserName, markedByUserKind);
    return (
        <button
            type="button"
            title={text}
            aria-label={text}
            onClick={(e) => {
                e.stopPropagation();
                toast.info(text);
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition"
        >
            <Info size={16} />
        </button>
    );
}

// ── Tipos do Caixa ────────────────────────────────────────────────────────────
interface TransactionDto {
    id: string; type: number; amount: number; description: string;
    date: string; category?: number | null; isAutomatic: boolean;
    sourceType: number; playerName?: string | null; createdAt: string;
}
interface TransactionMonthSummaryDto {
    year: number; month: number;
    totalIncome: number; totalExpense: number;
    netBalance: number; accumulatedBalance: number;
}
interface PendingTotalsDto {
    totalMonthlyPending: number; totalExtraChargesPending: number; grandTotal: number;
}
interface ExitDebtAlertDto {
    notificationId: string;
    groupId: string;
    playerId: string;
    playerName: string;
    count: number;
    total: number;
    createdAt: string;
}

// ── Componente de card de cobrança extra (admin) ──────────────────────────────
interface ChargeCardProps {
    charge: ExtraCharge; open: boolean; paidCt: number; pendCt: number;
    finalized?: boolean; groupId: string;
    onToggle(): void; onBulkDiscount(): void; onCancel(): void;
    onEditPayment(payment: ExtraChargePayment): void;
    onReactivate(): void;
    onEditDetails(dto: { name?: string; description?: string | null; amount?: number | null }): Promise<void>;
}
function ChargeCard({ charge, open, paidCt, pendCt, finalized, groupId, onToggle, onBulkDiscount, onCancel, onEditPayment, onReactivate, onEditDetails }: ChargeCardProps) {
    const [showEdit, setShowEdit] = useState(false);
    const [nameDraft, setNameDraft]   = useState(charge.name);
    const [descDraft, setDescDraft]   = useState(charge.description ?? '');
    const [amtDraft, setAmtDraft]     = useState(charge.amount.toString());
    const [saving, setSaving]         = useState(false);

    async function submitEdit() {
        setSaving(true);
        try {
            await onEditDetails({
                name: nameDraft.trim() || undefined,
                description: descDraft.trim() || null,
                amount: parseFloat(amtDraft) || undefined,
            });
            setShowEdit(false);
        } finally { setSaving(false); }
    }

    return (
        <div className={cls(
            'border rounded-xl overflow-hidden',
            charge.isCancelled ? 'opacity-60 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900' :
            finalized ? 'border-green-200 bg-green-50/30 dark:border-green-800/50 dark:bg-green-900/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
        )}>
            <div className="flex items-center gap-3 px-4 py-3">
                <button className="flex-1 text-left" onClick={onToggle}>
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900 dark:text-white">{charge.name}</span>
                        {charge.isCancelled && <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">Cancelada</span>}
                        {finalized && !charge.isCancelled && <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 size={10}/>Finalizada</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        <span>R$ {charge.amount.toFixed(2)}</span>
                        {charge.dueDate && <span>Venc. {new Date(charge.dueDate).toLocaleDateString('pt-BR')}</span>}
                        <span className="text-green-600 font-medium">{paidCt} pago{paidCt !== 1 ? 's' : ''}</span>
                        {pendCt > 0 && <span className="text-red-500 font-medium">{pendCt} pendente{pendCt !== 1 ? 's' : ''}</span>}
                    </div>
                </button>
                <div className="flex items-center gap-2">
                    {charge.isCancelled && (
                        <button onClick={e => { e.stopPropagation(); onReactivate(); }}
                            className="flex items-center gap-1 px-2 py-1 border border-emerald-300 dark:border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg text-xs font-medium transition"
                            title="Reativar cobrança">
                            <RotateCcw size={12} /> Reativar
                        </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); setShowEdit(v => !v); setNameDraft(charge.name); setDescDraft(charge.description ?? ''); setAmtDraft(charge.amount.toString()); }}
                        className={cls(
                            'p-1.5 rounded-lg transition',
                            showEdit ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 'text-slate-400 dark:text-slate-500 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                        )}
                        title="Editar cobrança">
                        <Pencil size={14} />
                    </button>
                    {!charge.isCancelled && charge.payments.length > 0 && (
                        <button onClick={e => { e.stopPropagation(); onBulkDiscount(); }}
                            className="flex items-center gap-1 px-2 py-1 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg text-xs font-medium transition"
                            title="Desconto em massa">
                            <DollarSign size={12} /> Desc. massa
                        </button>
                    )}
                    {!charge.isCancelled && (
                        <button onClick={onCancel}
                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                            title="Cancelar cobrança">
                            <Trash2 size={14} />
                        </button>
                    )}
                    {open ? <ChevronUp size={16} className="text-slate-400 dark:text-slate-500"/> : <ChevronDown size={16} className="text-slate-400 dark:text-slate-500"/>}
                </div>
            </div>
            {showEdit && (
                <div className="border-t border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20 px-4 py-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nome</label>
                            <input value={nameDraft} onChange={e => setNameDraft(e.target.value)}
                                className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Valor (R$)</label>
                            <input type="number" min="0.01" step="0.01" value={amtDraft} onChange={e => setAmtDraft(e.target.value)}
                                className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Descrição</label>
                            <input value={descDraft} onChange={e => setDescDraft(e.target.value)}
                                placeholder="Opcional"
                                className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowEdit(false)}
                            className="px-3 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                            Cancelar
                        </button>
                        <button onClick={submitEdit} disabled={saving || !nameDraft.trim() || !amtDraft}
                            className="px-3 py-1 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition disabled:opacity-50">
                            {saving ? <Loader2 size={12} className="animate-spin inline" /> : 'Salvar'}
                        </button>
                    </div>
                </div>
            )}
            {open && (
                <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800">
                    {charge.payments.length === 0 && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 px-4 py-3">Nenhum jogador atribuído.</p>
                    )}
                    {charge.payments.map(payment => {
                        const paid = payment.status === 1;
                        return (
                            <div key={payment.playerId} className="flex items-center gap-3 px-4 py-2.5">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{payment.playerName}</p>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        <p>R$ {payment.finalAmount.toFixed(2)}</p>
                                        {payment.discount > 0 && <p className="text-green-600 mt-0.5">Desconto R$ {payment.discount.toFixed(2)}</p>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {payment.hasProof && (
                                        <button onClick={async () => {
                                            try {
                                                const res = await PaymentsApi.getExtraChargeProof(groupId, charge.id, payment.playerId);
                                                const { base64, fileName, mimeType } = res.data.data as any;
                                                const link = document.createElement('a');
                                                link.href = `data:${mimeType};base64,${base64}`;
                                                link.download = fileName; link.click();
                                            } catch (e) { toast.error(getResponseMessage(e, 'Erro ao baixar comprovante')); }
                                        }} title="Baixar comprovante" className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                                            <Download size={13} />
                                        </button>
                                    )}
                                    <span className={cls(
                                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                                        paid ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400'
                                    )}>
                                        {paid ? <CheckCircle2 size={11}/> : <XCircle size={11}/>}
                                        {paid ? 'Pago' : 'Pendente'}
                                    </span>
                                    <PaymentAuditInfoButton paidAt={payment.paidAt} markedByUserName={payment.markedByUserName} markedByUserKind={payment.markedByUserKind} />
                                    {!charge.isCancelled && (
                                        <button onClick={() => onEditPayment(payment)}
                                            className="text-xs px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
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
    const active         = useAccountStore(s => s.getActive());
    const groupId        = active?.activeGroupId ?? '';
    const activePlayerId = active?.activePlayerId ?? '';
    const isAdmin = useAccountStore(s =>
        s.accounts.find(a => a.userId === s.activeAccountId)?.activeGroupIsFinanceiro ?? false
    );

    const setPendingPaymentsCount = usePaymentStore((s) => s.setPendingPaymentsCount);
    const { confirm, confirmDialog } = useConfirm();

    const [paymentMode, setPaymentMode] = useState<number>(0); // 0=Monthly, 1=PerGame
    const [tab, setTab]           = useState<'monthly' | 'extra' | 'caixa'>('monthly');
    const [year, setYear]         = useState(new Date().getFullYear());
    const [grid, setGrid]         = useState<MonthlyGrid | null>(null);
    const [charges, setCharges]   = useState<ExtraCharge[]>([]);
    const [loading, setLoading]   = useState(false);
    const [extraYear, setExtraYear]   = useState(new Date().getFullYear());
    const [extraMonth, setExtraMonth] = useState(new Date().getMonth() + 1);

    // Paginação das cobranças extras (mês selecionado) + resumo por mês (badges)
    const EXTRA_PAGE_SIZE = 20;
    interface MonthSummary { month: number; count: number; allPaid: boolean; hasPending: boolean }
    const [chargesTotal, setChargesTotal]             = useState(0);
    const [chargesPage, setChargesPage]               = useState(1);
    const [loadingMoreCharges, setLoadingMoreCharges] = useState(false);
    const [monthsSummary, setMonthsSummary]           = useState<MonthSummary[]>([]);
    const [myChargesTotal, setMyChargesTotal]             = useState(0);
    const [myChargesPage, setMyChargesPage]               = useState(1);
    const [loadingMoreMyCharges, setLoadingMoreMyCharges] = useState(false);
    const [mySummary, setMySummary]                       = useState<any>(null);

    // Modais
    const [monthModal, setMonthModal]             = useState<{ row: PlayerRow; month: number } | null>(null);
    const [createModal, setCreateModal]           = useState(false);
    const [bulkDiscountCharge, setBulkDiscountCharge] = useState<ExtraCharge | null>(null);
    const [extraModal, setExtraModal]             = useState<{ charge: ExtraCharge; payment: ExtraChargePayment } | null>(null);
    const [expanded, setExpanded]                 = useState<Set<string>>(new Set());

    // ── Caixa state ───────────────────────────────────────────────────────────
    const [caixaSubTab, setCaixaSubTab]   = useState<'mes' | 'geral'>('mes');
    const [txYear, setTxYear]             = useState(new Date().getFullYear());
    const [txMonth, setTxMonth]           = useState(new Date().getMonth() + 1);
    const [transactions, setTransactions] = useState<TransactionDto[]>([]);
    const [summaries, setSummaries]       = useState<TransactionMonthSummaryDto[]>([]);
    const [pendingTotals, setPendingTotals] = useState<PendingTotalsDto | null>(null);
    const [exitDebtAlerts, setExitDebtAlerts] = useState<ExitDebtAlertDto[]>([]);
    const [txLoading, setTxLoading]       = useState(false);
    // Add transaction modal
    const [addModal, setAddModal]         = useState<{ type: 0 | 1 } | null>(null);
    const [addForm, setAddForm]           = useState({ amount: '', description: '', date: new Date().toISOString().split('T')[0], category: '' });
    const [addSaving, setAddSaving]       = useState(false);
    const [syncing, setSyncing]           = useState(false);
    const [clearing, setClearing]         = useState(false);
    const [clearingPayments, setClearingPayments] = useState(false);

    // User (non-admin) view data
    const [myRow, setMyRow]           = useState<PlayerRow | null | undefined>(undefined); // undefined=loading, null=sem player
    const [myCharges, setMyCharges]   = useState<ExtraCharge[]>([]);
    const [payModal, setPayModal]     = useState(false);

    // Load payment mode from group settings
    useEffect(() => {
        if (!groupId) return;
        GroupSettingsApi.get(groupId)
            .then(res => {
                const mode = (res.data.data as any)?.paymentMode ?? 0;
                setPaymentMode(mode);
                // If PerGame, switch to extra tab
                if (mode === 1) setTab('extra');
            })
            .catch(() => {/* silently ignore */});
    }, [groupId]);

    // Atualiza o badge do sidebar para QUALQUER usuário (admin ou não)
    useEffect(() => {
        if (!groupId) return;
        PaymentsApi.getMySummary(groupId)
            .then((res) => setPendingPaymentsCount(calcPendingPaymentsCount((res.data as any)?.data)))
            .catch(() => { /* silencioso */ });
    }, [groupId, setPendingPaymentsCount]);

    // Loaders para usuário não-admin
    const loadMyData = useCallback(async () => {
        if (!groupId) return;
        try {
            const [rowRes, chargesRes, summaryRes, monthsRes] = await Promise.all([
                PaymentsApi.getMyMonthlyRow(groupId, year),
                PaymentsApi.getMyExtraCharges(groupId, { year: extraYear, month: extraMonth, page: 1, pageSize: EXTRA_PAGE_SIZE }),
                PaymentsApi.getMySummary(groupId),
                PaymentsApi.getExtraChargesSummary(groupId, extraYear),
            ]);
            const rowData = rowRes.data.data as any;
            setMyRow(rowData ? { ...rowData, months: rowData.months ?? [] } : null);
            const paged = chargesRes.data.data as any;
            setMyCharges((paged?.items as any[]) ?? []);
            setMyChargesTotal(paged?.total ?? 0);
            setMyChargesPage(1);
            const summaryData = (summaryRes.data as any)?.data;
            setMySummary(summaryData ?? null);
            setPendingPaymentsCount(calcPendingPaymentsCount(summaryData));
            setMonthsSummary(((monthsRes.data as any)?.data as MonthSummary[]) ?? []);
        } catch (e) { toast.error(getResponseMessage(e, 'Erro ao carregar seus pagamentos')); }
    }, [groupId, year, extraYear, extraMonth, activePlayerId, setPendingPaymentsCount]);

    const loadMoreMyCharges = useCallback(async () => {
        if (!groupId) return;
        setLoadingMoreMyCharges(true);
        try {
            const next = myChargesPage + 1;
            const res  = await PaymentsApi.getMyExtraCharges(groupId, { year: extraYear, month: extraMonth, page: next, pageSize: EXTRA_PAGE_SIZE });
            const paged = res.data.data as any;
            setMyCharges(prev => [...prev, ...((paged?.items as any[]) ?? [])]);
            setMyChargesTotal(paged?.total ?? 0);
            setMyChargesPage(next);
        } catch (e) { toast.error(getResponseMessage(e, 'Erro ao carregar mais cobranças')); }
        finally { setLoadingMoreMyCharges(false); }
    }, [groupId, extraYear, extraMonth, myChargesPage]);

    useEffect(() => { if (groupId) loadMyData(); }, [groupId, year, loadMyData]);

    const loadMonthly = useCallback(async () => {
        if (!groupId) return;
        setLoading(true);
        try {
            const res = await PaymentsApi.getMonthlyGrid(groupId, year);
            setGrid(res.data.data as any);
        } catch (e) { toast.error(getResponseMessage(e, 'Erro ao carregar grade mensal')); }
        finally { setLoading(false); }
    }, [groupId, year]);

    const loadExtra = useCallback(async () => {
        if (!groupId) return;
        setLoading(true);
        try {
            const [res, sumRes] = await Promise.all([
                PaymentsApi.getExtraCharges(groupId, { year: extraYear, month: extraMonth, page: 1, pageSize: EXTRA_PAGE_SIZE }),
                PaymentsApi.getExtraChargesSummary(groupId, extraYear),
            ]);
            const paged = res.data.data as any;
            setCharges((paged?.items as any[]) ?? []);
            setChargesTotal(paged?.total ?? 0);
            setChargesPage(1);
            setMonthsSummary(((sumRes.data as any)?.data as MonthSummary[]) ?? []);
        } catch (e) { toast.error(getResponseMessage(e, 'Erro ao carregar cobranças')); }
        finally { setLoading(false); }
    }, [groupId, extraYear, extraMonth]);

    const loadMoreExtra = useCallback(async () => {
        if (!groupId) return;
        setLoadingMoreCharges(true);
        try {
            const next = chargesPage + 1;
            const res  = await PaymentsApi.getExtraCharges(groupId, { year: extraYear, month: extraMonth, page: next, pageSize: EXTRA_PAGE_SIZE });
            const paged = res.data.data as any;
            setCharges(prev => [...prev, ...((paged?.items as any[]) ?? [])]);
            setChargesTotal(paged?.total ?? 0);
            setChargesPage(next);
        } catch (e) { toast.error(getResponseMessage(e, 'Erro ao carregar mais cobranças')); }
        finally { setLoadingMoreCharges(false); }
    }, [groupId, extraYear, extraMonth, chargesPage]);

    const loadCaixaMes = useCallback(async () => {
        if (!groupId) return;
        setTxLoading(true);
        try {
            const res = await TransactionsApi.getByMonth(groupId, txYear, txMonth);
            setTransactions((res.data as any)?.data ?? []);
        } catch (e) { toast.error(getResponseMessage(e, 'Erro ao carregar lançamentos')); }
        finally { setTxLoading(false); }
    }, [groupId, txYear, txMonth]);

    const loadCaixaGeral = useCallback(async () => {
        if (!groupId) return;
        setTxLoading(true);
        try {
            const [summRes, totRes] = await Promise.all([
                TransactionsApi.getMonthlySummaries(groupId),
                TransactionsApi.getPendingTotals(groupId),
            ]);
            setSummaries((summRes.data as any)?.data ?? []);
            setPendingTotals((totRes.data as any)?.data ?? null);
        } catch (e) { toast.error(getResponseMessage(e, 'Erro ao carregar resumo')); }
        finally { setTxLoading(false); }
    }, [groupId]);

    const loadPendingTotals = useCallback(async () => {
        if (!groupId) return;
        try {
            const res = await TransactionsApi.getPendingTotals(groupId);
            setPendingTotals((res.data as any)?.data ?? null);
        } catch { /* silencioso */ }
    }, [groupId]);

    const loadExitDebtAlerts = useCallback(async () => {
        if (!groupId || !isAdmin) return;
        try {
            const res = await PaymentsApi.getExitDebtAlerts(groupId);
            setExitDebtAlerts(((res.data as any)?.data ?? []) as ExitDebtAlertDto[]);
        } catch { /* silencioso */ }
    }, [groupId, isAdmin]);

    const keepExitDebtAlert = useCallback(async (notificationId: string) => {
        if (!groupId) return;
        try {
            await PaymentsApi.keepExitDebtAlert(groupId, notificationId);
            toast.success('Pendência mantida.');
            loadExitDebtAlerts();
        } catch (e) { toast.error(getResponseMessage(e, 'Erro ao manter pendência.')); }
    }, [groupId, loadExitDebtAlerts]);

    const payExitDebtAlert = useCallback(async (notificationId: string) => {
        if (!groupId) return;
        try {
            await PaymentsApi.markExitDebtAlertAsPaid(groupId, notificationId);
            toast.success('Pendências marcadas como pagas.');
            loadExitDebtAlerts();
            loadMonthly();
            loadExtra();
            loadPendingTotals();
            if (caixaSubTab === 'mes') loadCaixaMes();
            else loadCaixaGeral();
        } catch (e) { toast.error(getResponseMessage(e, 'Erro ao marcar como pago.')); }
    }, [groupId, loadExitDebtAlerts, loadMonthly, loadExtra, loadPendingTotals, caixaSubTab, loadCaixaMes, loadCaixaGeral]);

    const syncCaixa = useCallback(async () => {
        if (!groupId || syncing) return;
        setSyncing(true);
        try {
            const res = await TransactionsApi.syncTransactions(groupId);
            const { created = 0, updated = 0 } = (res.data as any)?.data ?? {};
            const total = created + updated;
            if (total > 0) {
                const parts = [];
                if (created > 0) parts.push(`${created} criado(s)`);
                if (updated > 0) parts.push(`${updated} atualizado(s)`);
                toast.success(`Sincronizado: ${parts.join(', ')}`);
                if (caixaSubTab === 'mes') loadCaixaMes();
                else loadCaixaGeral();
            } else {
                toast.success('Caixa já está sincronizado');
            }
        } catch (e) { toast.error(getResponseMessage(e, 'Erro ao sincronizar')); }
        finally { setSyncing(false); }
    }, [groupId, syncing, caixaSubTab, loadCaixaMes, loadCaixaGeral]);

    const clearPayments = useCallback(async () => {
        if (!groupId || clearingPayments) return;
        if (!(await confirm({ title: 'Limpar todos os pagamentos', message: 'Isso vai apagar TODAS as mensalidades, resetar TODOS os pagamentos de cobranças extras para pendente e limpar o caixa.\n\nEssa ação não pode ser desfeita.', confirmLabel: 'Apagar tudo', danger: true }))) return;
        setClearingPayments(true);
        try {
            const res = await PaymentsApi.clearAllPayments(groupId);
            const msg = (res.data as any)?.message ?? 'Pagamentos limpos.';
            toast.success(msg);
            // Recarrega tudo
            loadMonthly();
            loadExtra();
            if (caixaSubTab === 'mes') loadCaixaMes();
            else loadCaixaGeral();
        } catch (e) { toast.error(getResponseMessage(e, 'Erro ao limpar pagamentos')); }
        finally { setClearingPayments(false); }
    }, [groupId, clearingPayments, caixaSubTab, loadMonthly, loadExtra, loadCaixaMes, loadCaixaGeral, confirm]);

    const clearCaixa = useCallback(async () => {
        if (!groupId || clearing) return;
        if (!(await confirm({ title: 'Limpar o caixa', message: 'Isso vai apagar TODOS os lançamentos do caixa, inclusive os manuais.\n\nEssa ação não pode ser desfeita.', confirmLabel: 'Apagar tudo', danger: true }))) return;
        setClearing(true);
        try {
            const res = await TransactionsApi.clearAllTransactions(groupId);
            const count = (res.data as any)?.data ?? 0;
            toast.success(`${count} lançamento(s) removido(s). Clique em Sincronizar para recriar.`);
            if (caixaSubTab === 'mes') loadCaixaMes();
            else loadCaixaGeral();
        } catch (e) { toast.error(getResponseMessage(e, 'Erro ao limpar caixa')); }
        finally { setClearing(false); }
    }, [groupId, clearing, caixaSubTab, loadCaixaMes, loadCaixaGeral, confirm]);

    useEffect(() => { if (isAdmin && tab === 'monthly') loadMonthly(); }, [isAdmin, tab, loadMonthly]);
    useEffect(() => { if (isAdmin && tab === 'extra')   loadExtra();   }, [isAdmin, tab, loadExtra]);
    useEffect(() => { if (isAdmin && tab === 'caixa' && caixaSubTab === 'mes')   loadCaixaMes();   }, [isAdmin, tab, caixaSubTab, loadCaixaMes]);
    useEffect(() => { if (isAdmin && tab === 'caixa' && caixaSubTab === 'geral') loadCaixaGeral(); }, [isAdmin, tab, caixaSubTab, loadCaixaGeral]);
    useEffect(() => { if (isAdmin && tab === 'caixa') loadPendingTotals(); }, [isAdmin, tab, loadPendingTotals]);
    useEffect(() => { if (isAdmin) loadExitDebtAlerts(); }, [isAdmin, loadExitDebtAlerts]);

    // Jogadores para a modal de criar cobrança extra
    const mensalistas = grid?.players.map(p => ({ id: p.playerId, name: p.playerName })) ?? [];

    async function cancelCharge(chargeId: string) {
        if (!(await confirm({ title: 'Cancelar cobrança', message: 'Cancelar esta cobrança? Ela ficará marcada como cancelada e poderá ser reativada depois.', confirmLabel: 'Cancelar cobrança', danger: true }))) return;
        try {
            const res = await PaymentsApi.cancelExtraCharge(groupId, chargeId);
            if (res.data.message) toast.success(res.data.message);
            loadExtra();
        } catch (e) { toast.error(getResponseMessage(e, 'Erro ao cancelar')); }
    }

    async function reactivateCharge(chargeId: string) {
        try {
            const res = await PaymentsApi.reactivateExtraCharge(groupId, chargeId);
            const msg = (res.data as any)?.message ?? 'Cobrança reativada.';
            toast.success(msg);
            loadExtra();
        } catch (e) { toast.error(getResponseMessage(e, 'Erro ao reativar')); }
    }

    async function editChargeDetails(chargeId: string, dto: { name?: string; description?: string | null; amount?: number | null }) {
        const res = await PaymentsApi.updateExtraChargeDetails(groupId, chargeId, dto);
        const msg = (res.data as any)?.message ?? 'Cobrança atualizada.';
        toast.success(msg);
        loadExtra();
    }

    // ── Helpers para cobranças extras mensais ─────────────────────────────────
    const isFinalizada = (c: ExtraCharge) =>
        !c.isCancelled && c.payments.length > 0 && c.payments.every(p => p.status === 1);

    // Status de cada mês para o seletor — vem do endpoint de summary (badges)
    const monthsStatusFromSummary = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const s = monthsSummary.find(x => x.month === m);
        return {
            month: m,
            count: s?.count ?? 0,
            allPaid: s?.allPaid ?? false,
            hasPending: s?.hasPending ?? false,
        };
    });
    const extraMonthsStatus   = monthsStatusFromSummary;
    const myExtraMonthsStatus = monthsStatusFromSummary;

    // A lista já vem filtrada por ano/mês do servidor
    const currentAdminCharges   = charges.filter(c => !isFinalizada(c));
    const finalizedAdminCharges = charges.filter(isFinalizada);

    const myCurrentCharges   = myCharges.filter(c => { const p = c.payments[0]; return !c.isCancelled && (!p || p.status !== 1); });
    const myFinalizedCharges = myCharges.filter(c => { const p = c.payments[0]; return !c.isCancelled && !!p && p.status === 1; });

    // Total de débitos pendentes
    const pendingTotal = useMemo(() => {
        const nowYear  = new Date().getFullYear();
        const nowMonth = new Date().getMonth() + 1;
        let total = 0;

        // Mensalidades pendentes (somente modo Monthly)
        if (paymentMode === 0 && myRow) {
            (myRow.months ?? [])
                .filter(cell => {
                    if (cell.status === 1) return false;
                    if (year === nowYear && cell.month > nowMonth) return false;
                    return true;
                })
                .forEach(cell => { total += Math.max(0, cell.amount - cell.discount); });
        }

        // Cobranças extras pendentes — vem do summary (independe do mês selecionado)
        const pendingExtras: any[] = mySummary?.pendingExtraCharges ?? [];
        pendingExtras.forEach(p => { total += p.finalAmount ?? 0; });

        return total;
    }, [paymentMode, myRow, year, mySummary]);

    if (!groupId) {
        return (
            <div className="p-6 text-slate-500 dark:text-slate-400 text-sm">Selecione uma patota para ver os pagamentos.</div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* ── Header ── */}
            <div className="relative rounded-2xl flex-none bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-4 sm:px-6 py-4 sm:py-5 overflow-hidden shadow-lg">
                <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
                    style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

                {/* Row 1: icon + title */}
                <div className="relative flex items-center gap-3 mb-3">
                    <div className="page-header-icon">
                        <DollarSign size={18} />
                    </div>
                    <div>
                        <h1 className="text-lg font-black leading-tight">Pagamentos</h1>
                        <p className="text-xs text-white/60">Mensalidades e cobranças extras da patota</p>
                    </div>
                </div>

                {/* Row 2: abas */}
                <div className="relative flex gap-1">
                    {paymentMode === 0 && (
                        <button onClick={() => setTab('monthly')}
                            className={cls(
                                'px-4 py-1.5 rounded-full text-sm font-semibold transition border',
                                tab === 'monthly' ? 'bg-white text-slate-900 border-white' : 'bg-transparent text-white/70 border-white/30 hover:bg-white/10'
                            )}>
                            📅 Mensalidades
                        </button>
                    )}
                    <button onClick={() => setTab('extra')}
                        className={cls(
                            'px-4 py-1.5 rounded-full text-sm font-semibold transition border',
                            tab === 'extra' ? 'bg-white text-slate-900 border-white' : 'bg-transparent text-white/70 border-white/30 hover:bg-white/10'
                        )}>
                        💰 Cobranças extras
                    </button>
                    {isAdmin && (
                        <button onClick={() => setTab('caixa')}
                            className={cls(
                                'px-4 py-1.5 rounded-full text-sm font-semibold transition border',
                                tab === 'caixa' ? 'bg-white text-slate-900 border-white' : 'bg-transparent text-white/70 border-white/30 hover:bg-white/10'
                            )}>
                            🏦 Caixa
                        </button>
                    )}
                </div>
            </div>

            {/* Conteúdo */}
            <div className="flex-1 overflow-auto px-4 sm:px-6 py-4">
                {isAdmin && exitDebtAlerts.length > 0 && (
                    <div className="mb-4 space-y-2">
                        {exitDebtAlerts.map(alert => (
                            <div key={alert.notificationId} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <p className="text-sm font-bold">
                                        {alert.playerName} saiu com {alert.count} pendência{alert.count === 1 ? '' : 's'} financeira{alert.count === 1 ? '' : 's'}.
                                    </p>
                                    <p className="text-xs text-amber-700">
                                        Total em aberto: R$ {alert.total.toFixed(2)}. O que deseja fazer?
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => keepExitDebtAlert(alert.notificationId)}
                                        className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                                    >
                                        Manter pendência
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => payExitDebtAlert(alert.notificationId)}
                                        className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                                    >
                                        Marcar tudo como pago
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* === VIEW NÃO-ADMIN === */}
                {/* Mensalidades do usuário */}
                {!isAdmin && tab === 'monthly' && paymentMode === 0 && (
                    <div>
                        <div className="flex items-center gap-3 mb-4 flex-wrap">
                            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">📅 Minhas mensalidades</h2>
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                                <button onClick={() => setYear(y => y - 1)} className="px-2 py-1 rounded text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 text-sm">‹</button>
                                <span className="px-3 text-sm font-semibold text-slate-800 dark:text-slate-100">{year}</span>
                                <button onClick={() => setYear(y => y + 1)} className="px-2 py-1 rounded text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 text-sm">›</button>
                            </div>
                        </div>

                                {myRow === undefined ? (
                                    <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
                                ) : myRow === null ? (
                                    <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-sm">
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
                                                        paid ? 'border-green-200 bg-green-50 dark:border-green-800/50 dark:bg-green-900/10' : 'border-red-100 bg-red-50/60 dark:border-red-900/40 dark:bg-red-900/10'
                                                    )}>
                                                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">{MONTHS[cell.month - 1]}</div>
                                                    {paid
                                                        ? <CheckCircle2 size={20} className="text-green-500 mx-auto" />
                                                        : <XCircle size={20} className="text-red-400 mx-auto" />}
                                                    {cell.amount > 0 && (
                                                        <div className="text-[10px] text-slate-500 dark:text-slate-300 mt-1">R$ {cell.amount.toFixed(2)}</div>
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
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                                <button onClick={() => setExtraYear(y => y - 1)} className="px-2 py-1 rounded text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 text-sm">‹</button>
                                <span className="px-3 text-sm font-semibold text-slate-800 dark:text-slate-100">{extraYear}</span>
                                <button onClick={() => setExtraYear(y => y + 1)} className="px-2 py-1 rounded text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 text-sm">›</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 mb-5">
                            {myExtraMonthsStatus.map(({ month, count, allPaid, hasPending }) => (
                                <button key={month} onClick={() => setExtraMonth(month)}
                                    className={cls(
                                        'rounded-lg py-1.5 text-center text-xs transition border flex flex-col items-center gap-0.5',
                                        extraMonth === month ? 'border-slate-900 bg-slate-900 text-white dark:bg-white dark:text-slate-900 dark:border-white' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50',
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
                            <div className="text-center py-10 text-slate-400 dark:text-slate-500">
                                <DollarSign size={32} className="mx-auto mb-2 opacity-40" />
                                <p className="text-sm">Nenhuma cobrança em {MONTHS[extraMonth - 1]}/{extraYear}.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {myCurrentCharges.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">📌 Pendentes</h3>
                                        <div className="space-y-2">
                                            {myCurrentCharges.map(charge => {
                                                const payment = charge.payments[0];
                                                if (!payment) return null;
                                                const paid = payment.status === 1;
                                                return (
                                                    <div key={charge.id} className="border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 p-4 flex items-center gap-4">
                                                        <div className="flex-1 min-w-0">
                                                            <span className="font-semibold text-sm text-slate-900 dark:text-white">{charge.name}</span>
                                                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex gap-3 flex-wrap">
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
                                                                className="text-xs px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50">
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
                                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">✅ Pagas</h3>
                                        <div className="space-y-2">
                                            {myFinalizedCharges.map(charge => {
                                                const payment = charge.payments[0];
                                                if (!payment) return null;
                                                return (
                                                    <div key={charge.id} className="border border-green-100 rounded-xl bg-green-50/40 p-4 flex items-center gap-4">
                                                        <div className="flex-1 min-w-0">
                                                            <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">{charge.name}</span>
                                                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                                <p>R$ {payment.finalAmount.toFixed(2)}</p>
                                                                {payment.discount > 0 && <p className="text-green-600 mt-0.5">Desconto R$ {payment.discount.toFixed(2)}</p>}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {payment.hasProof && (
                                                                <button onClick={async () => {
                                                                    try {
                                                                        const res = await PaymentsApi.getExtraChargeProof(groupId, charge.id, payment.playerId);
                                                                        const { base64, fileName, mimeType } = res.data.data as any;
                                                                        const link = document.createElement('a'); link.href = `data:${mimeType};base64,${base64}`; link.download = fileName; link.click();
                                                                    } catch (e) { toast.error(getResponseMessage(e, 'Erro ao baixar comprovante')); }
                                                                }} title="Baixar comprovante" className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg">
                                                                    <Download size={14} />
                                                                </button>
                                                            )}
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                                <CheckCircle2 size={11}/> Pago
                                                            </span>
                                                            <PaymentAuditInfoButton paidAt={payment.paidAt} markedByUserName={payment.markedByUserName} markedByUserKind={payment.markedByUserKind} />
                                                            <button onClick={() => setExtraModal({ charge, payment })}
                                                                className="text-xs px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                                Ver
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <LoadMoreButton loaded={myCharges.length} total={myChargesTotal}
                                    loading={loadingMoreMyCharges} onClick={loadMoreMyCharges} />
                            </div>
                        )}
                        </div>
                )}

                {/* === ABA MENSALIDADES (admin only) === */}
                {isAdmin && tab === 'monthly' && (
                    <div>
                        <div className="flex items-center gap-3 mb-4 flex-wrap">
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                                <button onClick={() => setYear(y => y - 1)}
                                    className="px-2 py-1 rounded text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 text-sm">‹</button>
                                <span className="px-3 text-sm font-semibold text-slate-800 dark:text-slate-100">{year}</span>
                                <button onClick={() => setYear(y => y + 1)}
                                    className="px-2 py-1 rounded text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 text-sm">›</button>
                            </div>
                            {grid?.monthlyFee != null ? (
                                <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-3 flex-wrap">
                                    {grid.goalkeeperMonthlyFee != null ? (
                                        <>
                                            <span>Jogador: <strong>R$ {grid.monthlyFee.toFixed(2)}</strong></span>
                                            <span>Goleiro: <strong>R$ {grid.goalkeeperMonthlyFee.toFixed(2)}</strong></span>
                                        </>
                                    ) : (
                                        <span>Mensalidade: <strong>R$ {grid.monthlyFee.toFixed(2)}</strong></span>
                                    )}
                                </span>
                            ) : (
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
                            <div className="text-center py-16 text-slate-400 dark:text-slate-500">
                                <Users size={40} className="mx-auto mb-2 opacity-40" />
                                <p className="text-sm">Nenhum mensalista encontrado nesta patota.</p>
                                <p className="text-xs mt-1">Jogadores sem conta vinculada ou convidados não aparecem aqui.</p>
                            </div>
                        ) : (
                            /* Grade responsiva */
                            (() => {
                                const currentMonth = year < new Date().getFullYear() ? 12 : new Date().getMonth() + 1;
                                return (
                                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                        <table className="w-full text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                                    <th className="text-left px-3 py-2 font-semibold text-slate-600 dark:text-slate-400 sticky left-0 bg-slate-50 dark:bg-slate-800 z-10 min-w-[120px]">Jogador</th>
                                                    {MONTHS.map((m, i) => (
                                                        <th key={i} className={cls('px-2 py-2 font-semibold text-center w-10', i + 1 <= currentMonth ? 'text-slate-500 dark:text-slate-400' : 'text-slate-300 dark:text-slate-600')}>{m}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {grid.players.map(row => (
                                                    <tr key={row.playerId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                                        <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-900 z-10 whitespace-nowrap border-r border-slate-100 dark:border-slate-800">
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
                                className="flex items-center gap-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-700 dark:hover:bg-slate-100 transition">
                                <Plus size={16} /> Nova cobrança
                            </button>
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                                <button onClick={() => setExtraYear(y => y - 1)} className="px-2 py-1 rounded text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 text-sm">‹</button>
                                <span className="px-3 text-sm font-semibold text-slate-800 dark:text-slate-100">{extraYear}</span>
                                <button onClick={() => setExtraYear(y => y + 1)} className="px-2 py-1 rounded text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 text-sm">›</button>
                            </div>
                        </div>

                        {/* Seletor de mês */}
                        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 mb-5">
                            {extraMonthsStatus.map(({ month, count, allPaid, hasPending }) => (
                                <button key={month} onClick={() => setExtraMonth(month)}
                                    className={cls(
                                        'rounded-lg py-1.5 text-center text-xs transition border flex flex-col items-center gap-0.5',
                                        extraMonth === month ? 'border-slate-900 bg-slate-900 text-white dark:bg-white dark:text-slate-900 dark:border-white' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50',
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
                            <div className="text-center py-16 text-slate-400 dark:text-slate-500">
                                <DollarSign size={40} className="mx-auto mb-2 opacity-40" />
                                <p className="text-sm">Nenhuma cobrança em {MONTHS[extraMonth - 1]}/{extraYear}.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Cobranças correntes */}
                                {currentAdminCharges.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">📌 Cobranças correntes</h3>
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
                                                    onReactivate={() => reactivateCharge(charge.id)}
                                                    onEditDetails={(dto) => editChargeDetails(charge.id, dto)}
                                                    groupId={groupId} />;
                                            })}
                                        </div>
                                    </div>
                                )}
                                {/* Cobranças finalizadas */}
                                {finalizedAdminCharges.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">✅ Cobranças finalizadas</h3>
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
                                                    onReactivate={() => reactivateCharge(charge.id)}
                                                    onEditDetails={(dto) => editChargeDetails(charge.id, dto)}
                                                    groupId={groupId} />;
                                            })}
                                        </div>
                                    </div>
                                )}

                                <LoadMoreButton loaded={charges.length} total={chargesTotal}
                                    loading={loadingMoreCharges} onClick={loadMoreExtra} />
                            </div>
                        )}
                    </div>
                )}
                {/* === ABA CAIXA (financeiro only) === */}
                {isAdmin && tab === 'caixa' && (
                    <div>
                        {/* Pendências em aberto */}
                        {pendingTotals && pendingTotals.grandTotal > 0 && (
                            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-700/40 dark:bg-amber-900/10 p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Wallet size={15} className="text-amber-600" />
                                    <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">Pendências em aberto</span>
                                </div>
                                <div className="flex flex-wrap gap-4 text-sm">
                                    {pendingTotals.totalMonthlyPending > 0 && (
                                        <div>
                                            <p className="text-xs text-amber-700/70 dark:text-amber-400/70">Mensalidades</p>
                                            <p className="font-bold text-amber-800 dark:text-amber-300">R$ {pendingTotals.totalMonthlyPending.toFixed(2)}</p>
                                        </div>
                                    )}
                                    {pendingTotals.totalExtraChargesPending > 0 && (
                                        <div>
                                            <p className="text-xs text-amber-700/70 dark:text-amber-400/70">Cobranças extras</p>
                                            <p className="font-bold text-amber-800 dark:text-amber-300">R$ {pendingTotals.totalExtraChargesPending.toFixed(2)}</p>
                                        </div>
                                    )}
                                    <div className="ml-auto text-right">
                                        <p className="text-xs text-amber-700/70 dark:text-amber-400/70">Total pendente</p>
                                        <p className="font-black text-lg text-amber-800 dark:text-amber-300">R$ {pendingTotals.grandTotal.toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Sub-tabs + Sync */}
                        <div className="flex items-center gap-1 mb-5 flex-wrap">
                            {(['mes', 'geral'] as const).map(st => (
                                <button key={st} onClick={() => setCaixaSubTab(st)}
                                    className={cls(
                                        'px-4 py-1.5 rounded-lg text-xs font-semibold transition border',
                                        caixaSubTab === st
                                            ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-800/50'
                                    )}>
                                    {st === 'mes' ? '📅 Mês' : '📊 Geral'}
                                </button>
                            ))}
                            <div className="ml-auto flex items-center gap-1.5">
                                <button onClick={clearPayments} disabled={clearingPayments || clearing || syncing}
                                    title="Apaga todas as mensalidades e reseta cobranças extras para pendente (+ limpa caixa)"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition">
                                    {clearingPayments ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                    Limpar pagamentos
                                </button>
                                <button onClick={clearCaixa} disabled={clearing || syncing || clearingPayments}
                                    title="Remove todos os lançamentos do caixa para re-sincronizar do zero"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 dark:border-red-900 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition">
                                    {clearing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                    Limpar caixa
                                </button>
                                <button onClick={syncCaixa} disabled={syncing || clearing || clearingPayments}
                                    title="Sincroniza pagamentos marcados como pago que ainda não aparecem no caixa"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 disabled:opacity-50 transition">
                                    {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                    Sincronizar
                                </button>
                            </div>
                        </div>

                        {/* ── Sub-tab: Mês ─────────────────────────────────────── */}
                        {caixaSubTab === 'mes' && (
                            <div>
                                {/* Navegação mês/ano */}
                                <div className="flex items-center gap-3 mb-4 flex-wrap">
                                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                                        <button onClick={() => setTxYear(y => y - 1)} className="px-2 py-1 rounded text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 text-sm">‹</button>
                                        <span className="px-3 text-sm font-semibold text-slate-800 dark:text-slate-100">{txYear}</span>
                                        <button onClick={() => setTxYear(y => y + 1)} className="px-2 py-1 rounded text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 text-sm">›</button>
                                    </div>
                                    <div className="flex gap-1 flex-wrap">
                                        {MONTHS.map((m, i) => (
                                            <button key={i} onClick={() => setTxMonth(i + 1)}
                                                className={cls(
                                                    'px-2.5 py-1 rounded-lg text-xs font-medium border transition',
                                                    txMonth === i + 1
                                                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                                                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                                )}>
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {txLoading ? (
                                    <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
                                ) : transactions.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400 dark:text-slate-500">
                                        <Wallet size={36} className="mx-auto mb-2 opacity-40" />
                                        <p className="text-sm">Nenhum lançamento em {MONTH_NAMES[txMonth - 1]}/{txYear}.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 mb-4">
                                        {transactions.map(tx => {
                                            const isIncome = tx.type === 0;
                                            return (
                                                <div key={tx.id} className={cls(
                                                    'flex items-center gap-3 rounded-xl border p-3',
                                                    isIncome
                                                        ? 'border-green-100 bg-green-50/40 dark:border-green-800/30 dark:bg-green-900/10'
                                                        : 'border-red-100 bg-red-50/40 dark:border-red-800/30 dark:bg-red-900/10'
                                                )}>
                                                    <div className={cls('shrink-0', isIncome ? 'text-green-500' : 'text-red-400')}>
                                                        {isIncome ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{tx.description}</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-2 mt-0.5">
                                                            <span>
                                                                {new Date(tx.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                                                                {' às '}
                                                                {new Date(tx.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                            {tx.category != null && <span className="text-slate-400">{CATEGORY_NAMES[tx.category]}</span>}
                                                            {tx.isAutomatic && <span className="text-blue-400 dark:text-blue-500">automático</span>}
                                                        </p>
                                                    </div>
                                                    <div className="shrink-0 text-right">
                                                        <p className={cls('font-bold text-sm', isIncome ? 'text-green-600' : 'text-red-500')}>
                                                            {isIncome ? '+' : '-'} R$ {tx.amount.toFixed(2)}
                                                        </p>
                                                    </div>
                                                    {!tx.isAutomatic && (
                                                        <button
                                                            onClick={async () => {
                                                                if (!(await confirm({ title: 'Excluir lançamento', message: 'Excluir este lançamento do caixa?', confirmLabel: 'Excluir', danger: true }))) return;
                                                                try {
                                                                    await TransactionsApi.deleteTransaction(groupId, tx.id);
                                                                    toast.success('Lançamento excluído');
                                                                    loadCaixaMes();
                                                                } catch (e) { toast.error(getResponseMessage(e, 'Erro ao excluir')); }
                                                            }}
                                                            className="shrink-0 p-1.5 text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                                            title="Excluir lançamento">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Saldo do mês */}
                                {transactions.length > 0 && (() => {
                                    const income  = transactions.filter(t => t.type === 0).reduce((s, t) => s + t.amount, 0);
                                    const expense = transactions.filter(t => t.type === 1).reduce((s, t) => s + t.amount, 0);
                                    const net     = income - expense;
                                    return (
                                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 flex flex-wrap gap-4 text-sm mb-4">
                                            <div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">Entradas</p>
                                                <p className="font-bold text-green-600">+ R$ {income.toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">Saídas</p>
                                                <p className="font-bold text-red-500">- R$ {expense.toFixed(2)}</p>
                                            </div>
                                            <div className="ml-auto text-right">
                                                <p className="text-xs text-slate-500 dark:text-slate-400">Saldo do mês</p>
                                                <p className={`font-black text-base ${net >= 0 ? 'text-slate-800 dark:text-white' : 'text-red-500'}`}>
                                                    {net >= 0 ? '+ ' : '- '}R$ {Math.abs(net).toFixed(2)}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Botões de ação */}
                                <div className="flex gap-2 pt-2">
                                    <button onClick={() => { setAddModal({ type: 0 }); setAddForm({ amount: '', description: '', date: new Date().toISOString().split('T')[0], category: '' }); }}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-700/50 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40 text-sm font-semibold transition">
                                        <Plus size={15} /> Entrada
                                    </button>
                                    <button onClick={() => { setAddModal({ type: 1 }); setAddForm({ amount: '', description: '', date: new Date().toISOString().split('T')[0], category: '' }); }}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 text-sm font-semibold transition">
                                        <Plus size={15} /> Saída
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── Sub-tab: Geral ───────────────────────────────────── */}
                        {caixaSubTab === 'geral' && (
                            <div>
                                {txLoading ? (
                                    <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
                                ) : summaries.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400 dark:text-slate-500">
                                        <Wallet size={36} className="mx-auto mb-2 opacity-40" />
                                        <p className="text-sm">Nenhum lançamento registrado ainda.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                        <table className="w-full text-sm border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                                                    <th className="text-left px-4 py-2.5 font-semibold">Mês</th>
                                                    <th className="text-right px-4 py-2.5 font-semibold text-green-600">Entradas</th>
                                                    <th className="text-right px-4 py-2.5 font-semibold text-red-500">Saídas</th>
                                                    <th className="text-right px-4 py-2.5 font-semibold">Saldo do Mês</th>
                                                    <th className="text-right px-4 py-2.5 font-semibold">Saldo Acumulado</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {summaries.map(s => {
                                                    const negNet  = s.netBalance < 0;
                                                    const negAcc  = s.accumulatedBalance < 0;
                                                    return (
                                                        <tr key={`${s.year}-${s.month}`}
                                                            className={cls(
                                                                'hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition',
                                                                negNet && 'bg-red-50/30 dark:bg-red-900/10'
                                                            )}>
                                                            <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
                                                                {MONTH_NAMES[s.month - 1]}/{s.year}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right text-green-600 font-medium">
                                                                R$ {s.totalIncome.toFixed(2)}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right text-red-500 font-medium">
                                                                R$ {s.totalExpense.toFixed(2)}
                                                            </td>
                                                            <td className={cls('px-4 py-2.5 text-right font-bold', negNet ? 'text-red-500' : 'text-green-600')}>
                                                                {negNet ? '-' : '+'}R$ {Math.abs(s.netBalance).toFixed(2)}
                                                            </td>
                                                            <td className={cls('px-4 py-2.5 text-right font-black', negAcc ? 'text-red-500' : 'text-slate-800 dark:text-white')}>
                                                                {negAcc ? '-' : ''}R$ {Math.abs(s.accumulatedBalance).toFixed(2)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            {summaries.length > 0 && (() => {
                                                const last = summaries[summaries.length - 1];
                                                return (
                                                    <tfoot>
                                                        <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold text-xs text-slate-600 dark:text-slate-300">
                                                            <td className="px-4 py-2.5">Saldo atual</td>
                                                            <td className="px-4 py-2.5 text-right text-green-600">
                                                                R$ {summaries.reduce((a, s) => a + s.totalIncome, 0).toFixed(2)}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right text-red-500">
                                                                R$ {summaries.reduce((a, s) => a + s.totalExpense, 0).toFixed(2)}
                                                            </td>
                                                            <td className="px-4 py-2.5" />
                                                            <td className={cls('px-4 py-2.5 text-right font-black', last.accumulatedBalance < 0 ? 'text-red-500' : 'text-slate-900 dark:text-white')}>
                                                                {last.accumulatedBalance < 0 ? '-' : ''}R$ {Math.abs(last.accumulatedBalance).toFixed(2)}
                                                            </td>
                                                        </tr>
                                                    </tfoot>
                                                );
                                            })()}
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Rodapé de pagamento (qualquer usuário com débitos pendentes) */}
            {myRow !== undefined && pendingTotal > 0 && (
                <div className="flex-none border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
                    <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">Total pendente</p>
                        <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                            R$ {pendingTotal.toFixed(2)}
                        </p>
                    </div>
                    <button
                        onClick={() => setPayModal(true)}
                        className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-black tracking-wide hover:bg-slate-700 dark:hover:bg-slate-100 active:scale-[0.98] transition"
                    >
                        PAGAR
                    </button>
                </div>
            )}

            {/* Modais */}
            {monthModal && (
                <MonthlyPaymentModal
                    open={true}
                    groupId={groupId}
                    row={monthModal.row}
                    month={monthModal.month}
                    year={year}
                    isAdmin={isAdmin}
                    onClose={() => setMonthModal(null)}
                    onSaved={isAdmin ? () => { loadMonthly(); loadPendingTotals(); } : loadMyData}
                />
            )}
            {bulkDiscountCharge && (
                <BulkExtraDiscountModal
                    open={true}
                    groupId={groupId}
                    charge={bulkDiscountCharge}
                    onClose={() => setBulkDiscountCharge(null)}
                    onSaved={() => { loadExtra(); loadPendingTotals(); }}
                />
            )}
            {createModal && (
                <CreateExtraChargeModal
                    open={true}
                    groupId={groupId}
                    players={mensalistas}
                    onClose={() => setCreateModal(false)}
                    onSaved={() => { loadExtra(); loadPendingTotals(); }}
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
                    onSaved={isAdmin
                        ? () => { loadExtra(); if (caixaSubTab === 'mes') loadCaixaMes(); else loadCaixaGeral(); loadPendingTotals(); }
                        : loadMyData}
                />
            )}
            <PaymentSelectModal
                open={payModal}
                groupId={groupId}
                onClose={() => setPayModal(false)}
                onSaved={() => {
                    loadMyData();
                    if (isAdmin) {
                        loadMonthly();
                        loadExtra();
                        if (caixaSubTab === 'mes') loadCaixaMes();
                        else loadCaixaGeral();
                        loadPendingTotals();
                    }
                }}
            />

            {/* Modal: adicionar lançamento manual */}
            {addModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0" onClick={() => setAddModal(null)}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h2 className={cls('text-base font-black mb-4', addModal.type === 0 ? 'text-green-600' : 'text-red-500')}>
                            {addModal.type === 0 ? '+ Nova Entrada' : '- Nova Saída'}
                        </h2>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Valor (R$)</label>
                                <input type="number" min="0.01" step="0.01" placeholder="0,00"
                                    value={addForm.amount}
                                    onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))}
                                    className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-400" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Descrição</label>
                                <input type="text" placeholder="Ex: Aluguel quadra"
                                    value={addForm.description}
                                    onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                                    className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-400" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Data</label>
                                <input type="date"
                                    value={addForm.date}
                                    onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))}
                                    className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-400" />
                            </div>
                            {addModal.type === 1 && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Categoria</label>
                                    <select
                                        value={addForm.category}
                                        onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}
                                        className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-400">
                                        <option value="">Selecione...</option>
                                        {CATEGORY_NAMES.map((name, i) => (
                                            <option key={i} value={String(i)}>{name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2 mt-5">
                            <button onClick={() => setAddModal(null)}
                                className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                                Cancelar
                            </button>
                            <button
                                disabled={addSaving}
                                onClick={async () => {
                                    const amount = parseFloat(addForm.amount);
                                    if (!amount || amount <= 0) { toast.error('Valor inválido'); return; }
                                    if (!addForm.description.trim()) { toast.error('Descrição obrigatória'); return; }
                                    if (addModal.type === 1 && addForm.category === '') { toast.error('Categoria obrigatória'); return; }
                                    setAddSaving(true);
                                    try {
                                        await TransactionsApi.createTransaction(groupId, {
                                            type: addModal.type,
                                            amount,
                                            description: addForm.description.trim(),
                                            date: addForm.date,
                                            category: addModal.type === 1 ? parseInt(addForm.category) : null,
                                        });
                                        toast.success('Lançamento salvo');
                                        setAddModal(null);
                                        loadCaixaMes();
                                        loadPendingTotals();
                                    } catch (e) {
                                        toast.error(getResponseMessage(e, 'Erro ao salvar lançamento'));
                                    } finally { setAddSaving(false); }
                                }}
                                className={cls(
                                    'flex-1 py-2 rounded-lg text-sm font-black text-white transition flex items-center justify-center gap-2',
                                    addModal.type === 0
                                        ? 'bg-green-600 hover:bg-green-700'
                                        : 'bg-red-500 hover:bg-red-600',
                                    addSaving && 'opacity-70 cursor-not-allowed'
                                )}>
                                {addSaving && <Loader2 size={14} className="animate-spin" />}
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirmDialog}
        </div>
    );
}
