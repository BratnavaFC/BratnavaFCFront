import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    LogOut,
    ChevronDown,
    Menu,
    Plus,
    X,
    Loader2,
    Users2,
    Check,
    UserPlus,
    ChevronRight,
} from "lucide-react";
import { useAccountStore } from "../auth/accountStore";
import { isAdmin } from "../auth/guards";
import { PlayersApi, GroupsApi, GroupSettingsApi } from "../api/endpoints";
import { Field } from "../components/Field";

type MyPlayerDto = {
    playerId: string;
    groupId: string;
    playerName: string;
    groupName: string;
};

type Props = {
    isMobile?: boolean;
    onMenuClick?: () => void;
};

/* ─── helpers ─────────────────────────────────────────────────────────── */

function getInitials(name: string): string {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join("");
}

// Deterministic pastel gradient per name
const GRADIENTS = [
    "from-violet-500 to-indigo-500",
    "from-sky-500 to-cyan-400",
    "from-emerald-500 to-teal-400",
    "from-orange-400 to-rose-500",
    "from-pink-500 to-fuchsia-500",
    "from-amber-400 to-orange-500",
];
function avatarGradient(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
    return GRADIENTS[h % GRADIENTS.length];
}

/* ─── Avatar ───────────────────────────────────────────────────────────── */

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
    const initials = getInitials(name) || "?";
    const gradient = avatarGradient(name);
    const sz = size === "sm" ? "h-7 w-7 text-[11px]" : size === "lg" ? "h-10 w-10 text-sm" : "h-9 w-9 text-xs";
    return (
        <span
            className={`${sz} bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center font-bold text-white select-none shrink-0`}
        >
            {initials}
        </span>
    );
}

/* ─── CreateGroupModal ─────────────────────────────────────────────────── */

function CreateGroupModal({
    open, onClose, onCreated, userId,
}: { open: boolean; onClose: () => void; onCreated?: (id: string) => void; userId: string }) {
    const [name, setName] = useState("Bratnava FC");
    const [place, setPlace] = useState("Boca Jrs");
    const [dayOfWeek, setDayOfWeek] = useState(2);
    const [time, setTime] = useState("20:00");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { if (open) setError(null); }, [open]);

    async function handleCreate() {
        setSaving(true);
        setError(null);
        try {
            const res = await GroupsApi.create({ name, userAdminIds: [userId], defaultPlaceName: place, defaultDayOfWeek: dayOfWeek, defaultTime: time } as any);
            const newGroupId: string = (res.data?.data as any)?.id ?? (res.data?.data as any)?.groupId ?? "";
            if (newGroupId) {
                try {
                    await GroupSettingsApi.upsert(newGroupId, {
                        minPlayers: 5, maxPlayers: 6,
                        defaultPlaceName: place || null,
                        defaultDayOfWeek: dayOfWeek,
                        defaultKickoffTime: time ? `${time}:00` : null,
                    } as any);
                } catch { /* non-critical */ }
                onCreated?.(newGroupId);
            }
            onClose();
        } catch (e: any) {
            const data = e?.response?.data;
            const errors = data?.errors;
            let msg = "Falha ao criar grupo.";
            if (errors && typeof errors === "object") {
                const first = Object.values(errors)[0];
                if (Array.isArray(first) && typeof first[0] === "string") msg = first[0];
            } else if (typeof data?.message === "string") {
                msg = data.message;
            } else if (typeof e?.message === "string") {
                msg = e.message;
            }
            setError(msg);
        } finally {
            setSaving(false);
        }
    }

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 shadow-2xl dark:ring-1 dark:ring-slate-700/50 border dark:border-slate-700 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b dark:border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center">
                                <Users2 size={18} />
                            </div>
                            <div>
                                <div className="text-base font-semibold text-slate-900 dark:text-white">Criar grupo</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">Bratnava FC</div>
                            </div>
                        </div>
                        <button onClick={onClose} className="h-9 w-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" type="button">
                            <X size={18} />
                        </button>
                    </div>
                    <div className="p-5 space-y-4">
                        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
                        <div className="space-y-3">
                            <Field label="Nome"><input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} /></Field>
                            <Field label="Local padrão"><input className="input w-full" value={place} onChange={(e) => setPlace(e.target.value)} /></Field>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Dia (0=Dom…)"><input className="input w-full" type="number" min={0} max={6} value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))} /></Field>
                                <Field label="Hora"><input className="input w-full" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <button type="button" className="btn" onClick={onClose} disabled={saving}>Cancelar</button>
                            <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                {saving ? "Criando..." : "Criar"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── useClickOutside ──────────────────────────────────────────────────── */

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
    useEffect(() => {
        function onDown(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) handler();
        }
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [ref, handler]);
}

/* ─── Topbar ───────────────────────────────────────────────────────────── */

export default function Topbar({ isMobile = false, onMenuClick }: Props) {
    const nav = useNavigate();

    const accounts         = useAccountStore((s) => s.accounts);
    const activeAccountId  = useAccountStore((s) => s.activeAccountId);
    const setActiveAccount = useAccountStore((s) => s.setActiveAccount);
    const logoutActive     = useAccountStore((s) => s.logoutActive);
    const getActive        = useAccountStore((s) => s.getActive);
    const updateActive     = useAccountStore((s) => s.updateActive);

    const active = getActive();
    const admin  = isAdmin();

    const [myPlayers, setMyPlayers]         = useState<MyPlayerDto[]>([]);
    const [createGroupOpen, setCreateGroupOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen]   = useState(false);
    const [playerMenuOpen, setPlayerMenuOpen] = useState(false);

    const userMenuRef   = useRef<HTMLDivElement>(null);
    const playerMenuRef = useRef<HTMLDivElement>(null);

    useClickOutside(userMenuRef,   () => setUserMenuOpen(false));
    useClickOutside(playerMenuRef, () => setPlayerMenuOpen(false));

    /* ── fetch logic ── */
    useEffect(() => {
        if (!active?.userId) { setMyPlayers([]); return; }
        const userId = active.userId;

        function fetchAdminIds() {
            GroupsApi.listByAdmin(userId)
                .then((res) => {
                    const ids = ((res.data?.data ?? []) as unknown[]).map((g: any) => g.id ?? g.groupId).filter(Boolean) as string[];
                    updateActive({ groupAdminIds: ids });
                }).catch(() => {});
            GroupsApi.listByFinanceiro(userId)
                .then((res) => {
                    const ids = ((res.data?.data ?? []) as unknown[]).map((g: any) => g.id ?? g.groupId).filter(Boolean) as string[];
                    updateActive({ groupFinanceiroIds: ids });
                }).catch(() => {});
        }

        PlayersApi.mine()
            .then((res) => {
                const list = ((res.data?.data ?? []) as unknown) as MyPlayerDto[];
                setMyPlayers(list);
                if (list.length > 0 && !active.activePlayerId)
                    updateActive({ activePlayerId: list[0].playerId, activeGroupId: list[0].groupId });
            })
            .catch(() => setMyPlayers([]));

        fetchAdminIds();

        function onFocus() { fetchAdminIds(); }
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, [active?.userId]);

    /* ── derived ── */
    const activePlayer = useMemo(
        () => myPlayers.find((p) => p.playerId === active?.activePlayerId) ?? myPlayers[0],
        [myPlayers, active?.activePlayerId],
    );

    const displayName = activePlayer?.playerName || active?.name || active?.email || "—";

    const subtitle = activePlayer
        ? activePlayer.groupName
        : null;

    function handlePlayerChange(playerId: string) {
        const player = myPlayers.find((p) => p.playerId === playerId);
        if (!player) return;
        updateActive({ activePlayerId: player.playerId, activeGroupId: player.groupId });
        setPlayerMenuOpen(false);
        nav("/app");
    }

    function handleAccountSwitch(userId: string) {
        setActiveAccount(userId);
        setUserMenuOpen(false);
        nav("/app");
    }

    function handleLogout() {
        setUserMenuOpen(false);
        logoutActive();
        nav("/login");
    }

    /* ── render ── */
    return (
        <>
            <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-3 md:px-5 flex items-center justify-between gap-2 shrink-0">

                {/* ── LEFT ── */}
                <div className="flex items-center gap-2 min-w-0">
                    {isMobile && (
                        <button
                            type="button"
                            className="h-9 w-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.97] transition grid place-items-center shrink-0"
                            onClick={onMenuClick}
                            aria-label="Abrir menu"
                        >
                            <Menu size={18} className="text-slate-600 dark:text-slate-400" />
                        </button>
                    )}

                    {/* Avatar + name */}
                    <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar name={displayName} />
                        <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 dark:text-white leading-tight truncate max-w-[110px] sm:max-w-[160px]">
                                {displayName}
                            </div>
                            {subtitle && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[110px] sm:max-w-[160px]">
                                    {subtitle}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Player switcher — only when multiple players, desktop */}
                    {!isMobile && myPlayers.length > 1 && (
                        <div ref={playerMenuRef} className="relative ml-1">
                            <button
                                type="button"
                                onClick={() => setPlayerMenuOpen((v) => !v)}
                                className="flex items-center gap-1.5 h-8 pl-3 pr-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                            >
                                <span className="max-w-[120px] truncate">{activePlayer?.groupName ?? "Grupo"}</span>
                                <ChevronDown size={13} className={`transition-transform ${playerMenuOpen ? "rotate-180" : ""}`} />
                            </button>

                            {playerMenuOpen && (
                                <div className="absolute left-0 top-full mt-1.5 z-50 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg dark:ring-1 dark:ring-slate-700/40 overflow-hidden">
                                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                                        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Patota ativa</span>
                                    </div>
                                    {myPlayers.map((p) => (
                                        <button
                                            key={p.playerId}
                                            type="button"
                                            onClick={() => handlePlayerChange(p.playerId)}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition text-left"
                                        >
                                            <Avatar name={p.playerName} size="sm" />
                                            <div className="min-w-0 flex-1">
                                                <div className="font-medium text-slate-800 dark:text-slate-200 truncate">{p.playerName}</div>
                                                <div className="text-xs text-slate-400 dark:text-slate-500 truncate">{p.groupName}</div>
                                            </div>
                                            {p.playerId === active?.activePlayerId && (
                                                <Check size={14} className="text-emerald-500 shrink-0" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── RIGHT ── */}
                <div className="flex items-center gap-2 shrink-0">

                    {/* Create group — admin only */}
                    {admin && !isMobile && (
                        <button
                            type="button"
                            title="Criar grupo"
                            onClick={() => setCreateGroupOpen(true)}
                            className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-[0.97] transition grid place-items-center"
                        >
                            <Plus size={16} className="text-slate-600 dark:text-slate-400" />
                        </button>
                    )}

                    {/* User menu */}
                    <div ref={userMenuRef} className="relative">
                        <button
                            type="button"
                            onClick={() => setUserMenuOpen((v) => !v)}
                            className="flex items-center gap-2 h-9 pl-1 pr-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-[0.97] transition"
                            aria-label="Menu do usuário"
                        >
                            <Avatar name={displayName} size="sm" />
                            {!isMobile && (
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 max-w-[100px] truncate">
                                    {accounts.length > 1 ? `${accounts.length} contas` : displayName}
                                </span>
                            )}
                            <ChevronDown size={13} className={`text-slate-400 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
                        </button>

                        {userMenuOpen && (
                            <div className="absolute right-0 top-full mt-1.5 z-50 w-64 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl dark:ring-1 dark:ring-slate-700/40 overflow-hidden">

                                {/* Accounts list */}
                                <div className="px-3 pt-3 pb-1.5">
                                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1">Contas</span>
                                </div>
                                {accounts.map((a) => {
                                    const aName = a.name || a.email || a.userId;
                                    const isActive = a.userId === activeAccountId;
                                    return (
                                        <button
                                            key={a.userId}
                                            type="button"
                                            onClick={() => handleAccountSwitch(a.userId)}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition text-left ${isActive ? "bg-slate-50 dark:bg-slate-800" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                                        >
                                            <Avatar name={aName} size="sm" />
                                            <div className="min-w-0 flex-1">
                                                <div className="font-medium text-slate-800 dark:text-slate-200 truncate">{aName}</div>
                                                {a.email && a.email !== aName && (
                                                    <div className="text-xs text-slate-400 dark:text-slate-500 truncate">{a.email}</div>
                                                )}
                                            </div>
                                            {isActive && <Check size={14} className="text-emerald-500 shrink-0" />}
                                        </button>
                                    );
                                })}

                                {/* Mobile: player switcher */}
                                {isMobile && myPlayers.length > 1 && (
                                    <>
                                        <div className="mx-3 my-1 border-t border-slate-100 dark:border-slate-800" />
                                        <div className="px-3 pt-1 pb-1.5">
                                            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1">Patota</span>
                                        </div>
                                        {myPlayers.map((p) => (
                                            <button
                                                key={p.playerId}
                                                type="button"
                                                onClick={() => { handlePlayerChange(p.playerId); setUserMenuOpen(false); }}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition text-left"
                                            >
                                                <Avatar name={p.playerName} size="sm" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-medium text-slate-800 dark:text-slate-200 truncate">{p.playerName}</div>
                                                    <div className="text-xs text-slate-400 dark:text-slate-500 truncate">{p.groupName}</div>
                                                </div>
                                                {p.playerId === active?.activePlayerId && <Check size={14} className="text-emerald-500 shrink-0" />}
                                            </button>
                                        ))}
                                    </>
                                )}

                                {/* Actions */}
                                <div className="mx-3 my-1 border-t border-slate-100 dark:border-slate-800" />

                                {admin && (
                                    <button
                                        type="button"
                                        onClick={() => { setUserMenuOpen(false); setCreateGroupOpen(true); }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition text-left"
                                    >
                                        <span className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                            <Users2 size={14} className="text-slate-600 dark:text-slate-400" />
                                        </span>
                                        <span className="text-slate-700 dark:text-slate-300 font-medium">Criar grupo</span>
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={() => { setUserMenuOpen(false); nav("/login?add=1"); }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition text-left"
                                >
                                    <span className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                        <UserPlus size={14} className="text-slate-600 dark:text-slate-400" />
                                    </span>
                                    <span className="text-slate-700 dark:text-slate-300 font-medium">Adicionar conta</span>
                                </button>

                                <div className="mx-3 my-1 border-t border-slate-100 dark:border-slate-800" />

                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    disabled={!active}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 mb-1.5 text-sm hover:bg-rose-50 dark:hover:bg-rose-500/10 transition text-left disabled:opacity-50 rounded-b-2xl"
                                >
                                    <span className="h-7 w-7 rounded-lg bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center shrink-0">
                                        <LogOut size={14} className="text-rose-500" />
                                    </span>
                                    <span className="text-rose-600 dark:text-rose-400 font-medium">Sair</span>
                                </button>

                            </div>
                        )}
                    </div>
                </div>
            </header>

            {active?.userId && (
                <CreateGroupModal
                    open={createGroupOpen}
                    onClose={() => setCreateGroupOpen(false)}
                    onCreated={(newGroupId) => {
                        const current = useAccountStore.getState().getActive()?.groupAdminIds ?? [];
                        updateActive({ groupAdminIds: [...current, newGroupId] });
                    }}
                    userId={active.userId}
                />
            )}
        </>
    );
}
