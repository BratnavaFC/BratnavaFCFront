// src/components/modals/CreatorLeaveModal.tsx
import { useEffect, useState } from "react";
import { Loader2, LogOut, X } from "lucide-react";
import { GroupsApi } from "../../api/endpoints";

type PlayerDto = {
    id: string;
    userId?: string | null;
    userName?: string | null;
    name: string;
    skillPoints: number;
    isGoalkeeper: boolean;
    isGuest: boolean;
    status: number;
    guestStarRating?: number | null;
};

type GroupDto = {
    id: string;
    name: string;
    adminIds: string[];
    players: PlayerDto[];
    createdByUserId: string;
};

export function CreatorLeaveModal({
    open,
    group,
    currentUserId,
    activePlayerId: _activePlayerId,
    onClose,
    onDone,
}: {
    open: boolean;
    group: GroupDto | null;
    currentUserId: string;
    activePlayerId: string;
    onClose: () => void;
    onDone: () => void;
}) {
    const otherAdminPlayers = (group?.players ?? []).filter(p =>
        p.userId &&
        p.userId !== currentUserId &&
        (group?.adminIds ?? []).includes(p.userId) &&
        p.status === 1
    );

    const eligibleForPromotion = (group?.players ?? []).filter(p =>
        p.userId &&
        p.status === 1 &&
        !p.isGuest &&
        !(group?.adminIds ?? []).includes(p.userId)
    );

    const [step, setStep] = useState<
        'initial' |
        'pick_admin' |
        'confirm_single' |
        'no_admins_choice' |
        'pick_promote' |
        'confirm_delete_1' |
        'confirm_delete_2'
    >('initial');

    const [selectedAdminId, setSelectedAdminId] = useState<string>("");
    const [selectedPromoteId, setSelectedPromoteId] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // ESC key handler
    useEffect(() => {
        if (!open) return;
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [open, onClose]);

    useEffect(() => {
        if (open && group) {
            setErr(null);
            setLoading(false);
            setSelectedAdminId("");
            setSelectedPromoteId("");
            if (otherAdminPlayers.length >= 2) setStep('pick_admin');
            else if (otherAdminPlayers.length === 1) setStep('confirm_single');
            else setStep('no_admins_choice');
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    async function handleTransferToExisting(adminUserId: string) {
        setLoading(true); setErr(null);
        try {
            await GroupsApi.leaveAsCreator(group!.id, { transferToUserId: adminUserId });
            onDone();
        } catch (e: any) {
            setErr(e?.response?.data?.error ?? "Erro ao sair da patota.");
        } finally { setLoading(false); }
    }

    async function handlePromoteAndTransfer(promoteUserId: string) {
        setLoading(true); setErr(null);
        try {
            await GroupsApi.leaveAsCreator(group!.id, { promoteAndTransferUserId: promoteUserId });
            onDone();
        } catch (e: any) {
            setErr(e?.response?.data?.error ?? "Erro ao sair da patota.");
        } finally { setLoading(false); }
    }

    async function handleDeleteGroup() {
        setLoading(true); setErr(null);
        try {
            await GroupsApi.leaveAsCreator(group!.id, { deleteGroup: true });
            onDone();
        } catch (e: any) {
            setErr(e?.response?.data?.error ?? "Erro ao deletar a patota.");
        } finally { setLoading(false); }
    }

    if (!open || !group) return null;

    return (
        <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-2xl dark:shadow-none dark:ring-1 dark:ring-slate-700 border dark:border-slate-700 overflow-hidden flex flex-col">

                    {/* Header fixo */}
                    <div className="flex items-center justify-between px-5 py-4 border-b dark:border-slate-700 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                                <LogOut size={16} />
                            </div>
                            <div>
                                <div className="text-base font-semibold text-slate-900 dark:text-white">Sair da patota</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{group?.name}</div>
                            </div>
                        </div>
                        <button type="button" onClick={onClose} className="h-9 w-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Conteúdo por step */}
                    {step === 'confirm_single' && (
                        <>
                            <div className="px-5 py-5 space-y-4">
                                <p className="text-sm text-slate-700 dark:text-slate-300">
                                    <span className="font-semibold">{otherAdminPlayers[0]?.name}</span> assumirá como responsável pela patota.
                                    Seu perfil será convertido para convidado.
                                </p>
                                {err && <p className="text-sm text-rose-500">{err}</p>}
                            </div>
                            <div className="px-5 pb-5 flex gap-2">
                                <button type="button" className="btn btn-secondary flex-1" onClick={onClose} disabled={loading}>Cancelar</button>
                                <button
                                    type="button"
                                    className="flex-1 btn flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
                                    onClick={() => handleTransferToExisting(otherAdminPlayers[0].userId!)}
                                    disabled={loading}
                                >
                                    {loading ? <><Loader2 size={14} className="animate-spin" /> Saindo...</> : "Confirmar saída"}
                                </button>
                            </div>
                        </>
                    )}

                    {step === 'pick_admin' && (
                        <>
                            <div className="px-5 py-5 space-y-4">
                                <p className="text-sm text-slate-700 dark:text-slate-300">Escolha quem assumirá como responsável pela patota:</p>
                                <select
                                    className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-500"
                                    value={selectedAdminId}
                                    onChange={e => setSelectedAdminId(e.target.value)}
                                    disabled={loading}
                                >
                                    <option value="">Selecione um admin...</option>
                                    {otherAdminPlayers.map(p => (
                                        <option key={p.userId} value={p.userId!}>{p.name}</option>
                                    ))}
                                </select>
                                {err && <p className="text-sm text-rose-500">{err}</p>}
                            </div>
                            <div className="px-5 pb-5 flex gap-2">
                                <button type="button" className="btn btn-secondary flex-1" onClick={onClose} disabled={loading}>Cancelar</button>
                                <button
                                    type="button"
                                    className="flex-1 btn flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
                                    onClick={() => handleTransferToExisting(selectedAdminId)}
                                    disabled={loading || !selectedAdminId}
                                >
                                    {loading ? <><Loader2 size={14} className="animate-spin" /> Saindo...</> : "Confirmar saída"}
                                </button>
                            </div>
                        </>
                    )}

                    {step === 'no_admins_choice' && (
                        <>
                            <div className="px-5 py-5 space-y-3">
                                <p className="text-sm text-slate-700 dark:text-slate-300">Você é o único admin da patota. Escolha o que fazer:</p>
                                <button
                                    type="button"
                                    className="w-full flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-600 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left disabled:opacity-50 disabled:cursor-not-allowed"
                                    onClick={() => setStep('pick_promote')}
                                    disabled={eligibleForPromotion.length === 0}
                                >
                                    <div className="text-sm font-medium text-slate-900 dark:text-white">Promover um jogador como admin</div>
                                    <span className="ml-auto text-slate-400 dark:text-slate-500 text-xs">
                                        {eligibleForPromotion.length === 0 ? "Nenhum elegível" : `${eligibleForPromotion.length} disponíveis`}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    className="w-full flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 hover:bg-rose-100 text-left"
                                    onClick={() => setStep('confirm_delete_1')}
                                >
                                    <div className="text-sm font-medium text-rose-700">Excluir a patota</div>
                                </button>
                            </div>
                            <div className="px-5 pb-5">
                                <button type="button" className="btn btn-secondary w-full" onClick={onClose}>Cancelar</button>
                            </div>
                        </>
                    )}

                    {step === 'pick_promote' && (
                        <>
                            <div className="px-5 py-5 space-y-4">
                                <p className="text-sm text-slate-700 dark:text-slate-300">Escolha um jogador para promover a admin e assumir a patota:</p>
                                <select
                                    className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-500"
                                    value={selectedPromoteId}
                                    onChange={e => setSelectedPromoteId(e.target.value)}
                                    disabled={loading}
                                >
                                    <option value="">Selecione um jogador...</option>
                                    {eligibleForPromotion.map(p => (
                                        <option key={p.userId} value={p.userId!}>{p.name}</option>
                                    ))}
                                </select>
                                {err && <p className="text-sm text-rose-500">{err}</p>}
                            </div>
                            <div className="px-5 pb-5 flex gap-2">
                                <button type="button" className="btn btn-secondary flex-1" onClick={() => setStep('no_admins_choice')} disabled={loading}>Voltar</button>
                                <button
                                    type="button"
                                    className="flex-1 btn flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
                                    onClick={() => handlePromoteAndTransfer(selectedPromoteId)}
                                    disabled={loading || !selectedPromoteId}
                                >
                                    {loading ? <><Loader2 size={14} className="animate-spin" /> Saindo...</> : "Confirmar"}
                                </button>
                            </div>
                        </>
                    )}

                    {step === 'confirm_delete_1' && (
                        <>
                            <div className="px-5 py-5 space-y-3">
                                <p className="text-sm text-slate-700 dark:text-slate-300">
                                    Tem certeza que deseja <span className="font-semibold text-rose-600">excluir permanentemente</span> a patota <span className="font-semibold">{group?.name}</span>?
                                </p>
                                <p className="text-xs text-slate-400 dark:text-slate-500">Todos os dados da patota serão perdidos.</p>
                            </div>
                            <div className="px-5 pb-5 flex gap-2">
                                <button type="button" className="btn btn-secondary flex-1" onClick={() => setStep('no_admins_choice')} disabled={loading}>Cancelar</button>
                                <button
                                    type="button"
                                    className="flex-1 btn bg-rose-600 hover:bg-rose-700 text-white rounded-xl px-4 py-2 text-sm font-medium"
                                    onClick={() => setStep('confirm_delete_2')}
                                >
                                    Sim, excluir
                                </button>
                            </div>
                        </>
                    )}

                    {step === 'confirm_delete_2' && (
                        <>
                            <div className="px-5 py-5 space-y-3">
                                <p className="text-sm font-semibold text-rose-700">Confirmação final</p>
                                <p className="text-sm text-slate-700 dark:text-slate-300">
                                    Essa ação é <span className="font-semibold">irreversível</span>. A patota e todos os seus dados serão excluídos para sempre.
                                </p>
                                {err && <p className="text-sm text-rose-500">{err}</p>}
                            </div>
                            <div className="px-5 pb-5 flex gap-2">
                                <button type="button" className="btn btn-secondary flex-1" onClick={onClose} disabled={loading}>Cancelar</button>
                                <button
                                    type="button"
                                    className="flex-1 btn flex items-center justify-center gap-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
                                    onClick={handleDeleteGroup}
                                    disabled={loading}
                                >
                                    {loading ? <><Loader2 size={14} className="animate-spin" /> Excluindo...</> : "Excluir definitivamente"}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default CreatorLeaveModal;
