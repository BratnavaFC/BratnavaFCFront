// src/pages/GroupsPage.tsx
import { useEffect, useRef, useState } from "react";
import { Section } from "../components/Section";
import { GroupInvitesApi, GroupsApi, UsersApi } from "../api/endpoints";
import { useAccountStore } from "../auth/accountStore";
import { Check, Loader2, Search, UserPlus, X } from "lucide-react";

// ─── DTOs ────────────────────────────────────────────────────────────────────

type PlayerDto = {
    id: string;
    userId?: string | null;
    name: string;
    skillPoints: number;
    isGoalkeeper: boolean;
    isGuest: boolean;
    status: number;
};

type GroupDto = {
    id: string;
    name: string;
    players: PlayerDto[];
};

type UserResult = {
    id: string;
    userName: string;
    firstName: string;
    lastName: string;
    email: string;
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
    const [query, setQuery]       = useState("");
    const [results, setResults]   = useState<UserResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [invited, setInvited]   = useState<Set<string>>(new Set());
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

        return () => clearTimeout(timer);   // cancela se o usuario digitar antes dos 400ms
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
                                const isMember   = existingUserIds.has(u.id);
                                const isInvited  = invited.has(u.id);
                                const isInviting = !!inviting[u.id];
                                const err        = inviteErr[u.id];

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

// ─── GroupsPage ──────────────────────────────────────────────────────────────

export default function GroupsPage() {
    const active       = useAccountStore((s) => s.getActive());
    const activeGroupId  = active?.activeGroupId ?? "";
    const activePlayerId = active?.activePlayerId ?? "";

    const [group, setGroup]     = useState<GroupDto | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState<string | null>(null);
    const [inviteOpen, setInviteOpen] = useState(false);

    useEffect(() => {
        if (!activeGroupId) { setGroup(null); return; }
        setLoading(true);
        setError(null);
        GroupsApi.get(activeGroupId)
            .then((res) => setGroup(res.data as GroupDto))
            .catch(() => setError("Nao foi possivel carregar os dados da patota."))
            .finally(() => setLoading(false));
    }, [activeGroupId]);

    const activePlayers = group?.players?.filter((p) => p.status === 1) ?? [];
    const existingUserIds = new Set(
        (group?.players ?? []).map((p) => p.userId).filter((id): id is string => !!id)
    );
    const guestPlayers = (group?.players ?? []).filter((p) => p.isGuest && !p.userId);

    return (
        <div className="space-y-6">
            <Section
                title={group ? group.name : "Patotas (Groups)"}
                right={
                    loading ? (
                        <Loader2 size={16} className="animate-spin text-slate-400" />
                    ) : group ? (
                        <div className="flex items-center gap-2">
                            <span className="pill">{activePlayers.length} jogadores</span>
                            <button
                                type="button"
                                className="btn btn-primary flex items-center gap-1.5 text-sm"
                                onClick={() => setInviteOpen(true)}
                            >
                                <UserPlus size={15} />
                                Convidar
                            </button>
                        </div>
                    ) : null
                }
            >
                {!activeGroupId ? (
                    <div className="muted">Selecione sua patota pelo seletor no topo da pagina.</div>
                ) : error ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
                ) : loading ? (
                    <div className="muted flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando...</div>
                ) : activePlayers.length === 0 ? (
                    <div className="muted">Nenhum jogador ativo nesta patota.</div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-3">
                        {activePlayers.map((p) => {
                            const isMe = p.id === activePlayerId;
                            return (
                                <div
                                    key={p.id}
                                    className={[
                                        "rounded-xl border px-4 py-3 bg-white flex items-center justify-between gap-3",
                                        isMe ? "border-emerald-400" : "border-slate-200",
                                    ].join(" ")}
                                >
                                    <div className="min-w-0">
                                        <div className="font-semibold truncate flex items-center gap-2">
                                            {p.name}
                                            {p.isGoalkeeper && <span className="text-xs">🧤</span>}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            Habilidade: {p.skillPoints}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {p.isGuest && (
                                            <span className="text-[11px] px-2 py-0.5 rounded-full border bg-amber-50 border-amber-200 text-amber-700">
                                                Convidado
                                            </span>
                                        )}
                                        {isMe && <span className="pill">Voce</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Section>

            <InviteModal
                open={inviteOpen}
                onClose={() => setInviteOpen(false)}
                groupId={activeGroupId}
                groupName={group?.name ?? ""}
                existingUserIds={existingUserIds}
                guestPlayers={guestPlayers}
            />
        </div>
    );
}
