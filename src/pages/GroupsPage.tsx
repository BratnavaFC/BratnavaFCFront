// src/pages/GroupsPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Section } from "../components/Section";
import { AddGuestModal, StarRating } from "../components/AddGuestModal";
import { GroupInvitesApi, GroupsApi, PaymentsApi, PlayersApi, UsersApi } from "../api/endpoints";
import { useAccountStore } from "../auth/accountStore";
import { AlertCircle, Check, CheckCircle2, ChevronDown, Loader2, LogOut, Pencil, Plus, Search, UserPlus, X } from "lucide-react";
import { isGodMode } from "../auth/guards";
import { useGroupIcons } from "../hooks/useGroupIcons";
import { IconRenderer } from "../components/IconRenderer";
import { resolveIcon } from "../lib/groupIcons";

// ─── DTOs ────────────────────────────────────────────────────────────────────

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

type UserResult = {
    id: string;
    userName: string;
    firstName: string;
    lastName: string;
    email: string;
};

type MyPlayerItem = {
    playerId: string;
    userId?: string | null;
    groupId: string;
    playerName: string;
    isGoalkeeper: boolean;
    skillPoints: number;
    status: number;
    groupName: string;
    isGuest: boolean;
};

function fullName(u: UserResult) {
    return `${u.firstName} ${u.lastName}`.trim();
}

function initials(u: UserResult) {
    return [u.firstName[0], u.lastName[0]]
        .filter(Boolean)
        .join("")
        .toUpperCase();
}


// ─── InviteModal ─────────────────────────────────────────────────────────────

function InviteModal({
    open,
    onClose,
    groupId,
    groupName,
    existingUserIds,
    guestPlayers,
}: {
    open: boolean;
    onClose: () => void;
    groupId: string;
    groupName: string;
    existingUserIds: Set<string>;
    guestPlayers: PlayerDto[];
}) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<UserResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [invited, setInvited] = useState<Set<string>>(new Set());
    const [inviting, setInviting] = useState<Record<string, boolean>>({});
    const [inviteErr, setInviteErr] = useState<Record<string, string>>({});
    const [searchErr, setSearchErr] = useState<string | null>(null);
    const [guestChoice, setGuestChoice] = useState<Record<string, string>>({});
    const inputRef = useRef<HTMLInputElement>(null);

    // reset ao abrir
    useEffect(() => {
        if (open) {
            setQuery("");
            setResults([]);
            setInvited(new Set());
            setInviting({});
            setInviteErr({});
            setSearchErr(null);
            setGuestChoice({});
            setTimeout(() => inputRef.current?.focus(), 60);
        }
    }, [open]);

    // ── debounce: dispara a busca 400 ms após o usuário parar de digitar ──
    useEffect(() => {
        const q = query.trim();

        if (q.length < 2) {
            setResults([]);
            setSearchErr(null);
            return;
        }

        const timer = setTimeout(async () => {
            setSearching(true);
            setSearchErr(null);
            try {
                const res = await UsersApi.list({ search: q, pageSize: 8 });
                setResults(res.data?.items ?? []);
            } catch {
                setSearchErr("Erro ao buscar usuarios.");
                setResults([]);
            } finally {
                setSearching(false);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [query]);

    async function handleInvite(user: UserResult) {
        setInviting((prev) => ({ ...prev, [user.id]: true }));
        setInviteErr((prev) => { const n = { ...prev }; delete n[user.id]; return n; });
        try {
            const guestPlayerId = guestChoice[user.id] || null;
            await GroupInvitesApi.create(groupId, {
                targetUserId: user.id,
                guestPlayerId,
            });
            setInvited((prev) => new Set(prev).add(user.id));
        } catch (e: any) {
            const msg: string =
                e?.response?.data?.error ??
                e?.response?.data?.message ??
                "Erro ao enviar convite.";
            setInviteErr((prev) => ({ ...prev, [user.id]: msg }));
        } finally {
            setInviting((prev) => {
                const next = { ...prev };
                delete next[user.id];
                return next;
            });
        }
    }

    if (!open) return null;

    const q = query.trim();
    const showResults = q.length >= 2;

    return (
        <div className="fixed inset-0 z-50">
            {/* backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
                onClick={onClose}
            />

            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border overflow-hidden flex flex-col max-h-[85vh]">

                    {/* header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                                <UserPlus size={17} />
                            </div>
                            <div>
                                <div className="text-base font-semibold text-slate-900">Convidar jogador</div>
                                <div className="text-xs text-slate-500 truncate max-w-[220px]">{groupName}</div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="h-9 w-9 rounded-xl hover:bg-slate-100 flex items-center justify-center"
                            aria-label="Fechar"
                            type="button"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* search input */}
                    <div className="px-5 pt-4 pb-3 shrink-0">
                        <div className="relative">
                            <Search
                                size={15}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                            />
                            <input
                                ref={inputRef}
                                className="input w-full pl-9 pr-9"
                                placeholder="Buscar por nome ou username..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                            {searching && (
                                <Loader2
                                    size={14}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin pointer-events-none"
                                />
                            )}
                        </div>
                    </div>

                    {/* results */}
                    <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2">
                        {!showResults ? (
                            <p className="text-sm text-slate-400 text-center py-6">
                                {q.length === 1 ? "Continue digitando..." : "Digite para buscar usuarios."}
                            </p>
                        ) : searchErr ? (
                            <p className="text-sm text-rose-500 text-center py-6">{searchErr}</p>
                        ) : searching ? null : results.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-6">
                                Nenhum usuario encontrado para "{query}".
                            </p>
                        ) : (
                            results.map((u) => {
                                const isMember = existingUserIds.has(u.id);
                                const isInvited = invited.has(u.id);
                                const isInviting = !!inviting[u.id];
                                const err = inviteErr[u.id];

                                return (
                                    <div key={u.id} className="space-y-1">
                                        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                                            {/* avatar */}
                                            <div className="h-9 w-9 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0 select-none">
                                                {initials(u)}
                                            </div>

                                            {/* info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-semibold text-slate-900 truncate">
                                                    {fullName(u)}
                                                </div>
                                                <div className="text-xs text-slate-400">
                                                    @{u.userName}
                                                </div>
                                            </div>

                                            {/* action */}
                                            {isMember ? (
                                                <span className="text-xs font-medium text-slate-400 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 shrink-0">
                                                    Membro
                                                </span>
                                            ) : isInvited ? (
                                                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 shrink-0">
                                                    <Check size={13} />
                                                    Enviado
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="btn btn-primary text-xs px-3 py-1.5 shrink-0 flex items-center gap-1.5"
                                                    disabled={isInviting}
                                                    onClick={() => handleInvite(u)}
                                                >
                                                    {isInviting
                                                        ? <><Loader2 size={12} className="animate-spin" /> Enviando...</>
                                                        : "Convidar"
                                                    }
                                                </button>
                                            )}
                                        </div>

                                        {/* guest player selector */}
                                        {!isMember && !isInvited && guestPlayers.length > 0 && (
                                            <div className="flex items-center gap-2 px-1">
                                                <label className="text-xs text-slate-400 shrink-0">Perfil:</label>
                                                <select
                                                    className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
                                                    value={guestChoice[u.id] ?? ""}
                                                    onChange={(e) =>
                                                        setGuestChoice((prev) => ({ ...prev, [u.id]: e.target.value }))
                                                    }
                                                    disabled={isInviting}
                                                >
                                                    <option value="">Criar novo perfil</option>
                                                    {guestPlayers.map((g) => (
                                                        <option key={g.id} value={g.id}>
                                                            {g.name} (convidado)
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {err && (
                                            <p className="text-xs text-rose-500 px-1">{err}</p>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}

// ─── LeaveConfirmModal ────────────────────────────────────────────────────────

function LeaveConfirmModal({
    open,
    onClose,
    onConfirm,
}: {
    open: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}) {
    const [loading, setLoading] = useState(false);

    async function handleConfirm() {
        setLoading(true);
        try {
            await onConfirm();
        } finally {
            setLoading(false);
        }
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50">
            {/* backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
                onClick={onClose}
            />

            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border flex flex-col overflow-hidden">

                    {/* header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                                <LogOut size={17} />
                            </div>
                            <div className="text-base font-semibold text-slate-900">Sair da patota</div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-9 w-9 rounded-xl hover:bg-slate-100 flex items-center justify-center"
                            aria-label="Fechar"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* body */}
                    <div className="px-5 py-5">
                        <p className="text-sm text-slate-600">
                            Tem certeza? Seu perfil será convertido para convidado e você perderá o status de mensalista.
                        </p>
                    </div>

                    {/* footer */}
                    <div className="px-5 pb-5 flex items-center justify-end gap-2 shrink-0">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className="btn flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
                            onClick={handleConfirm}
                            disabled={loading}
                        >
                            {loading
                                ? <><Loader2 size={15} className="animate-spin" /> Saindo...</>
                                : "Sair"
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── EditPlayerModal ──────────────────────────────────────────────────────────

function EditPlayerModal({
    open,
    player,
    isAdmin,
    onClose,
    onSaved,
}: {
    open: boolean;
    player: PlayerDto | null;
    isAdmin: boolean;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [name, setName] = useState("");
    const [skillPoints, setSkillPoints] = useState(0);
    const [active, setActive] = useState(true);
    const [isGuest, setIsGuest] = useState(false);
    const [starRating, setStarRating] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const nameRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open && player) {
            setName(player.name);
            setSkillPoints(player.skillPoints);
            setActive(player.status === 1);
            setIsGuest(player.isGuest);
            setStarRating(player.guestStarRating ?? null);
            setLoading(false);
            setErr(null);
            setTimeout(() => nameRef.current?.focus(), 60);
        }
    }, [open, player]);

    async function handleSave() {
        if (!player) return;
        if (!name.trim()) { setErr("Nome é obrigatório."); return; }
        if (isAdmin && isGuest && starRating === null) {
            setErr("Informe o nível estimado do convidado.");
            return;
        }
        setLoading(true);
        setErr(null);
        try {
            const dto: any = { name: name.trim() };
            if (isAdmin) {
                dto.skillPoints = skillPoints;
                dto.status = active ? 1 : 2;
                dto.isGuest = isGuest;
                if (isGuest) dto.guestStarRating = starRating ?? null;
            }
            await PlayersApi.update(player.id, dto);
            onSaved();
            onClose();
        } catch (e: any) {
            setErr(
                e?.response?.data?.error ??
                e?.response?.data?.message ??
                "Erro ao salvar alterações."
            );
        } finally {
            setLoading(false);
        }
    }

    function handleKey(e: React.KeyboardEvent) {
        if (e.key === "Enter" && !loading) handleSave();
        if (e.key === "Escape") onClose();
    }

    if (!open || !player) return null;

    return (
        <div className="fixed inset-0 z-50" onKeyDown={handleKey}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border flex flex-col overflow-hidden">

                    {/* header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                                <Pencil size={16} />
                            </div>
                            <div>
                                <div className="text-base font-semibold text-slate-900">Editar jogador</div>
                                <div className="text-xs text-slate-500 truncate max-w-[200px]">{player.name}</div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-9 w-9 rounded-xl hover:bg-slate-100 flex items-center justify-center"
                            aria-label="Fechar"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* body */}
                    <div className="px-5 py-5 space-y-4">
                        {/* Nome — disponível para todos */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">Nome</label>
                            <input
                                ref={nameRef}
                                className="input w-full"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={loading}
                            />
                        </div>

                        {/* Campos exclusivos para admin */}
                        {isAdmin && (
                            <>
                                {/* Toggle Mensalista/Convidado — só aparece para mensalistas (convidado só vira mensalista via invite) */}
                                {!player?.isGuest && <label className="flex items-center gap-3 cursor-pointer select-none">
                                    <div
                                        role="switch"
                                        aria-checked={!isGuest}
                                        onClick={() => !loading && setIsGuest((v) => !v)}
                                        className={[
                                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                                            !isGuest ? "bg-emerald-500" : "bg-slate-300",
                                            loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                                        ].join(" ")}
                                    >
                                        <span
                                            className={[
                                                "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                                                !isGuest ? "translate-x-6" : "translate-x-1",
                                            ].join(" ")}
                                        />
                                    </div>
                                    <span className="text-sm font-medium text-slate-700">
                                        {isGuest ? "Convidado" : "Mensalista"}
                                    </span>
                                </label>}

                                {/* Star rating — visível quando isGuest */}
                                {isGuest && (
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-medium text-slate-700">
                                                Nível estimado
                                                <span className="ml-1 text-xs font-normal text-slate-400">(obrigatório)</span>
                                            </label>
                                            {starRating !== null && (
                                                <button
                                                    type="button"
                                                    className="text-xs text-slate-400 hover:text-slate-600"
                                                    onClick={() => setStarRating(null)}
                                                    disabled={loading}
                                                >
                                                    limpar
                                                </button>
                                            )}
                                        </div>
                                        <StarRating value={starRating} onChange={setStarRating} disabled={loading} />
                                        <p className="text-xs text-slate-400">
                                            Usado pelo algoritmo de times até o convidado ter 3 partidas.
                                        </p>
                                    </div>
                                )}

                                {/* Toggle Ativo/Inativo */}
                                <label className="flex items-center gap-3 cursor-pointer select-none">
                                    <div
                                        role="switch"
                                        aria-checked={active}
                                        onClick={() => !loading && setActive((v) => !v)}
                                        className={[
                                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                                            active ? "bg-emerald-500" : "bg-slate-300",
                                            loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                                        ].join(" ")}
                                    >
                                        <span
                                            className={[
                                                "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                                                active ? "translate-x-6" : "translate-x-1",
                                            ].join(" ")}
                                        />
                                    </div>
                                    <span className="text-sm font-medium text-slate-700">
                                        {active ? "Ativo" : "Inativo"}
                                    </span>
                                </label>
                            </>
                        )}

                        {err && <p className="text-sm text-rose-500">{err}</p>}
                    </div>

                    {/* footer */}
                    <div className="px-5 pb-5 shrink-0">
                        <button
                            type="button"
                            className="btn btn-primary w-full flex items-center justify-center gap-2"
                            onClick={handleSave}
                            disabled={loading}
                        >
                            {loading
                                ? <><Loader2 size={15} className="animate-spin" /> Salvando...</>
                                : "Salvar"
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── CreatorLeaveModal ────────────────────────────────────────────────────────

function CreatorLeaveModal({
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
                <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border overflow-hidden flex flex-col">

                    {/* Header fixo */}
                    <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                                <LogOut size={16} />
                            </div>
                            <div>
                                <div className="text-base font-semibold text-slate-900">Sair da patota</div>
                                <div className="text-xs text-slate-500 truncate max-w-[200px]">{group?.name}</div>
                            </div>
                        </div>
                        <button type="button" onClick={onClose} className="h-9 w-9 rounded-xl hover:bg-slate-100 flex items-center justify-center">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Conteúdo por step */}
                    {step === 'confirm_single' && (
                        <>
                            <div className="px-5 py-5 space-y-4">
                                <p className="text-sm text-slate-700">
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
                                <p className="text-sm text-slate-700">Escolha quem assumirá como responsável pela patota:</p>
                                <select
                                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
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
                                <p className="text-sm text-slate-700">Você é o único admin da patota. Escolha o que fazer:</p>
                                <button
                                    type="button"
                                    className="w-full flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50 text-left disabled:opacity-50 disabled:cursor-not-allowed"
                                    onClick={() => setStep('pick_promote')}
                                    disabled={eligibleForPromotion.length === 0}
                                >
                                    <div className="text-sm font-medium text-slate-900">Promover um jogador como admin</div>
                                    <span className="ml-auto text-slate-400 text-xs">
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
                                <p className="text-sm text-slate-700">Escolha um jogador para promover a admin e assumir a patota:</p>
                                <select
                                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
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
                                <p className="text-sm text-slate-700">
                                    Tem certeza que deseja <span className="font-semibold text-rose-600">excluir permanentemente</span> a patota <span className="font-semibold">{group?.name}</span>?
                                </p>
                                <p className="text-xs text-slate-400">Todos os dados da patota serão perdidos.</p>
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
                                <p className="text-sm text-slate-700">
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

// ─── GroupsPage ──────────────────────────────────────────────────────────────

export default function GroupsPage() {
    const isGroupAdmin = useAccountStore((s) => s.isGroupAdmin);
    const active = useAccountStore((s) => s.getActive());
    const currentUserId = active?.userId ?? "";
    const isGod = isGodMode();

    // ── Estado: lista de patotas do usuário ──
    const [myPlayers, setMyPlayers] = useState<MyPlayerItem[]>([]);
    const [mineLoading, setMineLoading] = useState(true);

    // ── Estado: grupo expandido ──
    const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
    const [group, setGroup] = useState<GroupDto | null>(null);
    const [groupLoading, setGroupLoading] = useState(false);
    const [groupError, setGroupError] = useState<string | null>(null);

    // payment badges: playerId → { pendingMonths, pendingExtras }
    const [paymentMap, setPaymentMap] = useState<Map<string, { pendingMonths: number; pendingExtras: number }>>(new Map());

    // ── Estado: modais ──
    const [inviteOpen, setInviteOpen] = useState(false);
    const [addGuestOpen, setAddGuestOpen] = useState(false);
    const [editPlayer, setEditPlayer] = useState<PlayerDto | null>(null);
    const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
    const [creatorLeaveOpen, setCreatorLeaveOpen] = useState(false);

    // ── Grupos únicos do usuário (sem repetição) ──
    const myGroups = useMemo(() => {
        const seen = new Set<string>();
        return myPlayers.filter(p => {
            if (seen.has(p.groupId)) return false;
            seen.add(p.groupId);
            return true;
        }).map(p => ({ groupId: p.groupId, groupName: p.groupName }));
    }, [myPlayers]);

    // ── Derivados do grupo expandido ──
    const myPlayerInExpandedGroup = expandedGroupId
        ? myPlayers.find(p => p.groupId === expandedGroupId) ?? null
        : null;
    const activePlayerId = myPlayerInExpandedGroup?.playerId ?? "";
    const isAdminOfGroup = isGroupAdmin(expandedGroupId ?? "");

    // ── Icons ligados ao grupo expandido ──
    const _icons = useGroupIcons(expandedGroupId || null);

    // ── Players derivados do grupo expandido ──
    const activePlayers = group?.players?.filter((p) => p.status === 1 && !p.isGuest) ?? [];
    const guestPlayers = group?.players?.filter((p) => p.status === 1 && p.isGuest) ?? [];
    const inactivePlayers = (isAdminOfGroup || isGod)
        ? (group?.players?.filter((p) => p.status !== 1) ?? [])
        : [];

    const sortedPlayers = useMemo(() =>
        [...activePlayers].sort((a, b) => {
            if (a.id === activePlayerId) return -1;
            if (b.id === activePlayerId) return 1;
            return 0;
        }),
        [activePlayers, activePlayerId]);

    const existingUserIds = new Set(
        (group?.players ?? []).filter((p) => !p.isGuest).map((p) => p.userId).filter((id): id is string => !!id)
    );

    // ── Funções ──
    function loadMine() {
        setMineLoading(true);
        return PlayersApi.mine()
            .then(res => setMyPlayers((res.data as MyPlayerItem[]) ?? []))
            .catch(() => setMyPlayers([]))
            .finally(() => setMineLoading(false));
    }

    function openGroup(groupId: string) {
        setExpandedGroupId(groupId);
        setGroupLoading(true);
        setGroupError(null);
        setGroup(null);
        GroupsApi.get(groupId)
            .then(res => setGroup(res.data as GroupDto))
            .catch(() => setGroupError("Não foi possível carregar os dados da patota."))
            .finally(() => setGroupLoading(false));
    }

    function loadGroup() {
        if (expandedGroupId) openGroup(expandedGroupId);
    }

    function toggleGroup(groupId: string) {
        if (expandedGroupId === groupId) {
            setExpandedGroupId(null);
            setGroup(null);
        } else {
            openGroup(groupId);
        }
    }

    async function loadPaymentData() {
        if (!expandedGroupId) { setPaymentMap(new Map()); return; }
        if (!isGroupAdmin(expandedGroupId) && !isGodMode()) {
            setPaymentMap(new Map());
            return;
        }
        const year = new Date().getFullYear();
        try {
            const [gridRes, extraRes] = await Promise.all([
                PaymentsApi.getMonthlyGrid(expandedGroupId, year),
                PaymentsApi.getExtraCharges(expandedGroupId),
            ]);
            const grid: any = gridRes.data;
            const extras: any[] = extraRes.data ?? [];
            const hasMonthlyFee = !!(grid?.monthlyFee && grid.monthlyFee > 0);
            const now = new Date();
            const currentMonth = now.getMonth() + 1;

            const map = new Map<string, { pendingMonths: number; pendingExtras: number }>();
            for (const row of (grid?.players ?? []) as any[]) {
                const joinedYear = row.joinedYear ?? 0;
                const joinedMonth = row.joinedMonth ?? 1;
                const pendingMonths = hasMonthlyFee
                    ? ((row.months ?? []) as any[]).filter((c: any) => {
                        if (c.month > currentMonth) return false;
                        if (joinedYear === year && c.month < joinedMonth) return false;
                        return c.status === 0;
                    }).length
                    : 0;
                map.set(row.playerId, { pendingMonths, pendingExtras: 0 });
            }
            for (const charge of extras) {
                if (charge.isCancelled) continue;
                for (const payment of (charge.payments ?? []) as any[]) {
                    if (payment.status !== 0) continue;
                    const entry = map.get(payment.playerId);
                    if (entry) entry.pendingExtras += 1;
                    else map.set(payment.playerId, { pendingMonths: 0, pendingExtras: 1 });
                }
            }
            setPaymentMap(new Map(map));
        } catch {
            // silencioso
        }
    }

    // Carregar mine ao montar
    useEffect(() => { loadMine(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Carregar payment badges quando grupo muda
    useEffect(() => { loadPaymentData(); }, [expandedGroupId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-expandir quando 1 grupo
    useEffect(() => {
        if (myGroups.length === 1) {
            openGroup(myGroups[0].groupId);
        }
    }, [myGroups.length]); // eslint-disable-line react-hooks/exhaustive-deps

    async function handleLeave() {
        if (!activePlayerId) return;
        try {
            await PlayersApi.leaveGroup(activePlayerId);
            setLeaveConfirmOpen(false);
            await loadMine();
            loadGroup();
        } catch {
            // silencioso
        }
    }

    // ── Conteúdo dos jogadores (reutilizado em 1 grupo e accordion) ──
    function GroupContent() {
        if (groupError) {
            return (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {groupError}
                </div>
            );
        }
        if (groupLoading) {
            return (
                <div className="muted flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Carregando...
                </div>
            );
        }
        if (!group) return null;
        if (activePlayers.length === 0 && inactivePlayers.length === 0) {
            return <div className="muted">Nenhum jogador nesta patota.</div>;
        }
        return (
            <div className="space-y-4">
                {/* ── Jogadores Ativos ── */}
                {activePlayers.length === 0 ? (
                    <div className="muted">Nenhum jogador ativo.</div>
                ) : (
                    <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 pt-1">
                            Mensalistas ({activePlayers.length})
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                            {sortedPlayers.map((p) => {
                                const isMe = p.id === activePlayerId;
                                const canEdit = isAdminOfGroup || isGod || isMe;
                                return (
                                    <div
                                        key={p.id}
                                        className={[
                                            "group relative rounded-lg border px-3 py-2 bg-white flex flex-col gap-0.5 transition-colors",
                                            isMe ? "border-emerald-400" : "border-slate-200",
                                        ].join(" ")}
                                    >
                                        {/* name + badges row */}
                                        <div className="flex items-center justify-between gap-1 min-w-0">
                                            <div className="text-sm font-semibold truncate flex items-center gap-1 min-w-0">
                                                <span className="truncate">{p.name}</span>
                                                <span className="shrink-0"><IconRenderer value={resolveIcon(_icons, p.isGoalkeeper ? 'goalkeeper' : 'player')} size={14} /></span>
                                            </div>
                                            <div className="flex items-center gap-0.5 shrink-0">
                                                {isMe && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-white leading-none">
                                                        Você
                                                    </span>
                                                )}
                                                {canEdit && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditPlayer(p)}
                                                        className="ml-0.5 h-5 w-5 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                                                        title="Editar jogador"
                                                        aria-label="Editar jogador"
                                                    >
                                                        <Pencil size={11} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* secondary info row */}
                                        <div className="flex items-center justify-between gap-1">
                                            <span className="text-[11px] text-slate-400 truncate">
                                                {p.userName ? `@${p.userName}` : ""}
                                            </span>
                                            {p.isGuest && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-amber-50 border-amber-200 text-amber-700 leading-none shrink-0">
                                                    Convidado
                                                </span>
                                            )}
                                        </div>

                                        {/* star rating — admin only */}
                                        {p.isGuest && p.guestStarRating != null && (isAdminOfGroup || isGod) && (
                                            <div className="text-[11px] leading-none text-amber-400 mt-0.5">
                                                {"★".repeat(p.guestStarRating)}
                                                <span className="text-slate-200">{"★".repeat(5 - p.guestStarRating)}</span>
                                            </div>
                                        )}

                                        {/* payment badge — admin only */}
                                        {(isAdminOfGroup || isGod) && (() => {
                                            const pmt = paymentMap.get(p.id);
                                            if (!pmt) return null;
                                            const total = pmt.pendingMonths + pmt.pendingExtras;
                                            if (total === 0) {
                                                return (
                                                    <div className="flex items-center gap-1 mt-0.5">
                                                        <CheckCircle2 size={11} className="text-emerald-500" />
                                                        <span className="text-[10px] text-emerald-600">Em dia</span>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <AlertCircle size={11} className="text-red-500" />
                                                    <span className="text-[10px] text-red-600 font-medium">
                                                        {total} pendência{total !== 1 ? 's' : ''}
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── Convidados ── */}
                {guestPlayers.length > 0 && (
                    <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 pt-1">
                            Convidados ({guestPlayers.length})
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                            {guestPlayers.map((p) => {
                                const canEdit = isAdminOfGroup || isGod;
                                return (
                                    <div
                                        key={p.id}
                                        className="relative rounded-lg border border-slate-200 px-3 py-2 bg-white flex flex-col gap-0.5"
                                    >
                                        {/* name + edit row */}
                                        <div className="flex items-center justify-between gap-1 min-w-0">
                                            <div className="text-sm font-semibold truncate flex items-center gap-1 min-w-0">
                                                <span className="truncate">{p.name}</span>
                                                <span className="shrink-0"><IconRenderer value={resolveIcon(_icons, p.isGoalkeeper ? 'goalkeeper' : 'player')} size={14} /></span>
                                            </div>
                                            <div className="flex items-center gap-0.5 shrink-0">
                                                {canEdit && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditPlayer(p)}
                                                        className="h-5 w-5 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                                                        title="Editar jogador"
                                                        aria-label="Editar jogador"
                                                    >
                                                        <Pencil size={11} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* star rating — admin only */}
                                        {p.guestStarRating != null && (isAdminOfGroup || isGod) && (
                                            <div className="text-[11px] leading-none text-amber-400 mt-0.5">
                                                {"★".repeat(p.guestStarRating)}
                                                <span className="text-slate-200">{"★".repeat(5 - p.guestStarRating)}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── Jogadores Inativos (admin only) ── */}
                {inactivePlayers.length > 0 && (
                    <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 pt-1">
                            Jogadores Inativos ({inactivePlayers.length})
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                            {inactivePlayers.map((p) => {
                                return (
                                    <div
                                        key={p.id}
                                        className="relative rounded-lg border border-slate-200 px-3 py-2 bg-white flex flex-col gap-0.5 opacity-60"
                                    >
                                        {/* name + badges row */}
                                        <div className="flex items-center justify-between gap-1 min-w-0">
                                            <div className="text-sm font-semibold truncate flex items-center gap-1 min-w-0">
                                                <span className="truncate">{p.name}</span>
                                                <span className="shrink-0"><IconRenderer value={resolveIcon(_icons, p.isGoalkeeper ? 'goalkeeper' : 'player')} size={14} /></span>
                                            </div>
                                            <div className="flex items-center gap-0.5 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditPlayer(p)}
                                                    className="h-5 w-5 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                                                    title="Editar jogador"
                                                    aria-label="Editar jogador"
                                                >
                                                    <Pencil size={11} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* secondary info row */}
                                        <div className="flex items-center justify-between gap-1">
                                            <span className="text-[11px] text-slate-400 truncate">
                                                {p.userName ? `@${p.userName}` : ""}
                                            </span>
                                            {p.isGuest && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-amber-50 border-amber-200 text-amber-700 leading-none shrink-0">
                                                    Convidado
                                                </span>
                                            )}
                                        </div>

                                        {/* star rating — admin only */}
                                        {p.isGuest && p.guestStarRating != null && (
                                            <div className="text-[11px] leading-none text-amber-400 mt-0.5">
                                                {"★".repeat(p.guestStarRating)}
                                                <span className="text-slate-200">{"★".repeat(5 - p.guestStarRating)}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ── Botões de cabeçalho para 1 grupo ──
    function HeaderButtons() {
        return (
            <div className="flex items-center gap-2">
                {(isAdminOfGroup || isGod) && (
                    <>
                        <button
                            type="button"
                            className="btn btn-secondary flex items-center gap-1.5 text-sm"
                            onClick={() => setAddGuestOpen(true)}
                        >
                            <Plus size={15} />
                            <span className="hidden sm:inline">Convidado</span>
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary flex items-center gap-1.5 text-sm"
                            onClick={() => setInviteOpen(true)}
                        >
                            <UserPlus size={15} />
                            <span className="hidden sm:inline">Convidar</span>
                        </button>
                    </>
                )}
                {!isAdminOfGroup && !isGod && activePlayerId && myPlayerInExpandedGroup && !myPlayerInExpandedGroup.isGuest && (
                    <button
                        type="button"
                        className="btn flex items-center gap-1.5 text-sm text-rose-600 border border-rose-200 hover:bg-rose-50"
                        onClick={() => setLeaveConfirmOpen(true)}
                    >
                        <LogOut size={15} />
                        <span className="hidden sm:inline">Sair</span>
                    </button>
                )}
                {/* Sair — criador admin */}
                {(isAdminOfGroup || isGod) && group?.createdByUserId === currentUserId && (
                    <button
                        type="button"
                        className="btn flex items-center gap-1.5 text-sm text-rose-600 border border-rose-200 hover:bg-rose-50"
                        onClick={() => setCreatorLeaveOpen(true)}
                    >
                        <LogOut size={15} />
                        <span className="hidden sm:inline">Sair</span>
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Loading inicial */}
            {mineLoading ? (
                <Section title="Patotas">
                    <div className="muted flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" /> Carregando...
                    </div>
                </Section>
            ) : myGroups.length === 0 ? (
                /* 0 grupos */
                <Section title="Patotas">
                    <div className="muted">Você não faz parte de nenhuma patota.</div>
                </Section>
            ) : myGroups.length === 1 ? (
                /* 1 grupo — layout totalmente expandido */
                <Section
                    title={group ? group.name : myGroups[0].groupName}
                    right={
                        groupLoading ? (
                            <Loader2 size={16} className="animate-spin text-slate-400" />
                        ) : group ? (
                            <HeaderButtons />
                        ) : null
                    }
                >
                    <GroupContent />
                </Section>
            ) : (
                /* 2+ grupos — accordion */
                <Section title="Patotas">
                    <div className="space-y-2">
                        {myGroups.map(({ groupId, groupName }) => {
                            const isExpanded = expandedGroupId === groupId;
                            const isAdminHere = isGroupAdmin(groupId) || isGod;
                            const myPlayerHere = myPlayers.find(p => p.groupId === groupId);
                            return (
                                <div key={groupId} className="border border-slate-200 rounded-xl overflow-hidden">
                                    {/* Linha clicável */}
                                    <button
                                        type="button"
                                        onClick={() => toggleGroup(groupId)}
                                        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left"
                                    >
                                        <span className="font-semibold text-slate-900 text-sm">{groupName}</span>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {/* Botões de ação — visíveis quando expandido */}
                                            {isExpanded && (
                                                <div
                                                    className="flex items-center gap-1.5"
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    {isAdminHere && (
                                                        <>
                                                            <button type="button" className="btn btn-secondary flex items-center gap-1 text-xs px-2 py-1" onClick={() => setAddGuestOpen(true)}>
                                                                <Plus size={13} /><span className="hidden sm:inline">Convidado</span>
                                                            </button>
                                                            <button type="button" className="btn btn-primary flex items-center gap-1 text-xs px-2 py-1" onClick={() => setInviteOpen(true)}>
                                                                <UserPlus size={13} /><span className="hidden sm:inline">Convidar</span>
                                                            </button>
                                                        </>
                                                    )}
                                                    {!isAdminHere && myPlayerHere && !myPlayerHere.isGuest && (
                                                        <button type="button" className="btn flex items-center gap-1 text-xs px-2 py-1 text-rose-600 border border-rose-200 hover:bg-rose-50" onClick={() => setLeaveConfirmOpen(true)}>
                                                            <LogOut size={13} /><span className="hidden sm:inline">Sair</span>
                                                        </button>
                                                    )}
                                                    {/* Sair — criador admin */}
                                                    {isAdminHere && group?.createdByUserId === currentUserId && (
                                                        <button type="button" className="btn flex items-center gap-1 text-xs px-2 py-1 text-rose-600 border border-rose-200 hover:bg-rose-50" onClick={() => setCreatorLeaveOpen(true)}>
                                                            <LogOut size={13} /><span className="hidden sm:inline">Sair</span>
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            <ChevronDown
                                                size={16}
                                                className={["text-slate-400 transition-transform", isExpanded ? "rotate-180" : ""].join(" ")}
                                            />
                                        </div>
                                    </button>

                                    {/* Conteúdo expandido */}
                                    {isExpanded && (
                                        <div className="border-t border-slate-200 px-4 py-4">
                                            <GroupContent />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </Section>
            )}

            {/* Modais — sempre presentes */}
            <EditPlayerModal
                open={!!editPlayer}
                player={editPlayer}
                isAdmin={isAdminOfGroup || isGod}
                onClose={() => setEditPlayer(null)}
                onSaved={loadGroup}
            />

            <LeaveConfirmModal
                open={leaveConfirmOpen}
                onClose={() => setLeaveConfirmOpen(false)}
                onConfirm={handleLeave}
            />

            <AddGuestModal
                open={addGuestOpen}
                onClose={() => setAddGuestOpen(false)}
                submitLabel="Adicionar à patota"
                onSubmit={async (name, isGoalkeeper, starRating) => {
                    await PlayersApi.create({
                        name,
                        groupId: expandedGroupId,
                        skillPoints: 0,
                        isGoalkeeper,
                        isGuest: true,
                        status: 1,
                        guestStarRating: starRating ?? undefined,
                    } as any);
                    loadGroup();
                }}
            />

            <InviteModal
                open={inviteOpen}
                onClose={() => setInviteOpen(false)}
                groupId={expandedGroupId ?? ""}
                groupName={group?.name ?? ""}
                existingUserIds={existingUserIds}
                guestPlayers={guestPlayers}
            />

            <CreatorLeaveModal
                open={creatorLeaveOpen}
                group={group}
                currentUserId={currentUserId}
                activePlayerId={activePlayerId}
                onClose={() => setCreatorLeaveOpen(false)}
                onDone={() => { setCreatorLeaveOpen(false); loadMine(); loadGroup(); }}
            />
        </div>
    );
}
