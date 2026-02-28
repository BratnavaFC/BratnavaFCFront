import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    LogOut,
    UserCircle2,
    ChevronDown,
    Menu,
    Plus,
    X,
    Loader2,
    Users2,
} from "lucide-react";
import { useAccountStore } from "../auth/accountStore";
import { getRole, isAdmin } from "../auth/guards";
import { PlayersApi, GroupsApi } from "../api/endpoints";
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

function roleLabel(role: string | null) {
    return role || "User";
}

function CreateGroupModal({
    open,
    onClose,
    onCreated,
    userId,
}: {
    open: boolean;
    onClose: () => void;
    onCreated?: (groupId: string) => void;
    userId: string;
}) {
    const [name, setName] = useState("Bratnava FC");
    const [place, setPlace] = useState("Boca Jrs");
    const [dayOfWeek, setDayOfWeek] = useState(2);
    const [time, setTime] = useState("20:00");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) setError(null);
    }, [open]);

    async function handleCreate() {
        setSaving(true);
        setError(null);
        try {
            const res = await GroupsApi.create({
                name,
                userAdminIds: [userId],
                defaultPlaceName: place,
                defaultDayOfWeek: dayOfWeek,
                defaultTime: time,
            } as any);
            const newGroupId: string = res.data?.id ?? res.data?.groupId ?? "";
            if (newGroupId) onCreated?.(newGroupId);
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
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
                onClick={onClose}
            />
            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                                <Users2 size={18} />
                            </div>
                            <div>
                                <div className="text-base font-semibold text-slate-900">Criar grupo</div>
                                <div className="text-xs text-slate-500">Bratnava FC</div>
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

                    <div className="p-5 space-y-4">
                        {error && (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                {error}
                            </div>
                        )}

                        <div className="space-y-3">
                            <Field label="Nome">
                                <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} />
                            </Field>
                            <Field label="Local padrao">
                                <input className="input w-full" value={place} onChange={(e) => setPlace(e.target.value)} />
                            </Field>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Dia (0=Dom, 1=Seg...)">
                                    <input className="input w-full" type="number" min={0} max={6} value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))} />
                                </Field>
                                <Field label="Hora">
                                    <input className="input w-full" value={time} onChange={(e) => setTime(e.target.value)} />
                                </Field>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                            <button type="button" className="btn" onClick={onClose} disabled={saving}>
                                Cancelar
                            </button>
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

export default function Topbar({ isMobile = false, onMenuClick }: Props) {
    const nav = useNavigate();

    const accounts = useAccountStore((s) => s.accounts);
    const activeAccountId = useAccountStore((s) => s.activeAccountId);
    const setActiveAccount = useAccountStore((s) => s.setActiveAccount);
    const logoutActive = useAccountStore((s) => s.logoutActive);
    const getActive = useAccountStore((s) => s.getActive);

    const active = getActive();
    const role = getRole();
    const admin = isAdmin();
    const updateActive = useAccountStore((s) => s.updateActive);

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [myPlayers, setMyPlayers] = useState<MyPlayerDto[]>([]);
    const [createGroupOpen, setCreateGroupOpen] = useState(false);

    useEffect(() => {
        if (!active?.userId) {
            setMyPlayers([]);
            return;
        }
        const userId = active.userId;
        PlayersApi.mine()
            .then((res) => {
                const list = (res.data ?? []) as MyPlayerDto[];
                setMyPlayers(list);
                if (list.length > 0 && !active.activePlayerId) {
                    updateActive({ activePlayerId: list[0].playerId, activeGroupId: list[0].groupId });
                }
            })
            .catch(() => setMyPlayers([]));
        GroupsApi.listByAdmin(userId)
            .then((res) => {
                const ids = (res.data ?? []).map((g: any) => g.id ?? g.groupId).filter(Boolean) as string[];
                updateActive({ groupAdminIds: ids });
            })
            .catch(() => {});
    }, [active?.userId]);

    function handlePlayerChange(playerId: string) {
        const player = myPlayers.find((p) => p.playerId === playerId);
        if (!player) return;
        updateActive({ activePlayerId: player.playerId, activeGroupId: player.groupId });
    }

    const display = useMemo(() => {
        if (!active) return { name: "—" };
        return { name: active.name || active.email || active.userId };
    }, [active]);

    const onLogout = () => {
        logoutActive();
        nav("/login");
    };

    return (
        <>
            <header className="h-16 bg-white border-b border-slate-200 px-3 md:px-6 flex items-center justify-between gap-3">
                {/* LEFT */}
                <div className="flex items-center gap-3 min-w-0">
                    {isMobile ? (
                        <button
                            type="button"
                            className="h-10 w-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] transition grid place-items-center"
                            onClick={onMenuClick}
                            aria-label="Abrir menu"
                        >
                            <Menu size={18} className="text-slate-700" />
                        </button>
                    ) : null}

                    <UserCircle2 className="text-slate-700 shrink-0" />

                    <div className="min-w-0">
                        <div className="font-semibold leading-tight truncate">{display.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                            <span className="pill">{roleLabel(role)}</span>
                            {!isMobile ? <span>Conta ativa</span> : null}
                        </div>
                    </div>
                </div>

                {/* RIGHT */}
                <div className="flex items-center gap-2 shrink-0">
                    {/* Criar grupo (apenas admin) */}
                    {admin ? (
                        <button
                            type="button"
                            title="Criar grupo"
                            aria-label="Criar grupo"
                            className="h-10 w-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-900 active:scale-[0.97] transition grid place-items-center"
                            onClick={() => setCreateGroupOpen(true)}
                        >
                            <Plus size={18} className="text-slate-700" />
                        </button>
                    ) : null}

                    {/* Player selector */}
                    {myPlayers.length === 1 ? (
                        <span className="text-sm text-slate-600 font-medium px-2 truncate max-w-[200px]">
                            {myPlayers[0].playerName} ({myPlayers[0].groupName})
                        </span>
                    ) : myPlayers.length > 1 ? (
                        <div className="relative">
                            <select
                                value={active?.activePlayerId ?? ""}
                                onChange={(e) => handlePlayerChange(e.target.value)}
                                className={[
                                    "input appearance-none pr-9",
                                    isMobile ? "h-10 text-sm w-[150px]" : "w-[220px]",
                                ].join(" ")}
                            >
                                <option value="" disabled>Selecionar player</option>
                                {myPlayers.map((p) => (
                                    <option key={p.playerId} value={p.playerId}>
                                        {p.playerName} ({p.groupName})
                                    </option>
                                ))}
                            </select>
                            <ChevronDown
                                size={16}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                            />
                        </div>
                    ) : null}

                    {/* Account selector */}
                    <div className="relative">
                        <select
                            value={activeAccountId ?? ""}
                            onChange={(e) => setActiveAccount(e.target.value)}
                            className={[
                                "input appearance-none pr-9",
                                isMobile ? "h-10 text-sm w-[160px]" : "w-[240px]",
                            ].join(" ")}
                        >
                            {activeAccountId == null ? (
                                <option value="" disabled>Selecione</option>
                            ) : null}
                            {accounts.map((a) => (
                                <option key={a.userId} value={a.userId}>
                                    {a.name || a.email || a.userId}
                                </option>
                            ))}
                        </select>
                        <ChevronDown
                            size={16}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                        />
                    </div>

                    {/* Desktop actions */}
                    {!isMobile ? (
                        <>
                            <button className="btn" onClick={() => nav("/login?add=1")}>
                                Adicionar conta
                            </button>
                            <button className="btn btn-danger" onClick={onLogout} disabled={!active}>
                                <LogOut size={16} /> Sair
                            </button>
                        </>
                    ) : (
                        <div className="relative">
                            <button
                                type="button"
                                className="h-10 w-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] transition grid place-items-center"
                                onClick={() => setMobileMenuOpen((v) => !v)}
                                aria-label="Acoes"
                            >
                                <ChevronDown size={18} className="text-slate-700" />
                            </button>

                            {mobileMenuOpen ? (
                                <>
                                    <button
                                        className="fixed inset-0 z-40"
                                        aria-label="Fechar acoes"
                                        onClick={() => setMobileMenuOpen(false)}
                                    />
                                    <div className="absolute right-0 mt-2 z-50 w-56 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                        <button
                                            className="w-full px-3 py-2.5 text-sm text-left hover:bg-slate-50 flex items-center gap-2"
                                            onClick={() => { setMobileMenuOpen(false); nav("/login?add=1"); }}
                                        >
                                            <Plus size={16} className="text-slate-700" />
                                            Adicionar conta
                                        </button>
                                        <button
                                            className="w-full px-3 py-2.5 text-sm text-left hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50"
                                            onClick={() => { setMobileMenuOpen(false); onLogout(); }}
                                            disabled={!active}
                                        >
                                            <LogOut size={16} className="text-slate-700" />
                                            Sair
                                        </button>
                                    </div>
                                </>
                            ) : null}
                        </div>
                    )}
                </div>
            </header>

            {active?.userId ? (
                <CreateGroupModal
                    open={createGroupOpen}
                    onClose={() => setCreateGroupOpen(false)}
                    onCreated={(newGroupId) => {
                        const current = useAccountStore.getState().getActive()?.groupAdminIds ?? [];
                        updateActive({ groupAdminIds: [...current, newGroupId] });
                    }}
                    userId={active.userId}
                />
            ) : null}
        </>
    );
}
