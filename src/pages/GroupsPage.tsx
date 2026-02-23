// src/pages/GroupsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Section } from "../components/Section";
import { Field } from "../components/Field";
import { GroupsApi, PlayersApi } from "../api/endpoints";
import { useAccountStore } from "../auth/accountStore";
import { isAdmin } from "../auth/guards";

type MyPlayerDto = {
    playerId: string;
    userId: string;
    groupId: string;
    playerName: string;
    isGoalkeeper: boolean;
    skillPoints: number;
    status: number;
    groupName: string;
};

function cls(...xs: Array<string | false | null | undefined>) {
    return xs.filter(Boolean).join(" ");
}

function safeGuid(v: any) {
    if (typeof v !== "string") return "";
    const t = v.trim();
    if (!t || t === "undefined" || t === "null") return "";
    return t;
}

export default function GroupsPage() {
    const store = useAccountStore();
    const active = store.getActive();
    const admin = isAdmin();

    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    const [myPlayers, setMyPlayers] = useState<MyPlayerDto[]>([]);

    // fallback manual
    const [groupIdManual, setGroupIdManual] = useState(active?.activeGroupId ?? "");
    const [playerIdManual, setPlayerIdManual] = useState((active as any)?.activePlayerId ?? "");

    // create (admin)
    const [name, setName] = useState("Bratnava FC");
    const [place, setPlace] = useState("Boca Jrs");
    const [dayOfWeek, setDayOfWeek] = useState(2);
    const [time, setTime] = useState("20:00");

    const activeGroupId = active?.activeGroupId ?? "";
    const activePlayerId = (active as any)?.activePlayerId ?? "";

    function setActiveGroupAndPlayer(groupId: string, playerId: string) {
        const gid = safeGuid(groupId);
        const pid = safeGuid(playerId);
        if (!gid || !pid) return;

        store.updateActive({ activeGroupId: gid, activePlayerId: pid } as any);
        setGroupIdManual(gid);
        setPlayerIdManual(pid);
        setMsg("Grupo/Player ativo atualizado.");
    }

    async function loadMine() {
        setLoading(true);
        setMsg(null);
        try {
            const res = await PlayersApi.mine();
            const list = (res.data ?? []) as MyPlayerDto[];
            setMyPlayers(Array.isArray(list) ? list : []);

            // ✅ se ainda não tiver selecionado, seleciona o primeiro automaticamente
            const has = safeGuid(activeGroupId) && safeGuid(activePlayerId);
            if (!has && list?.length) {
                setActiveGroupAndPlayer(list[0].groupId, list[0].playerId);
            }
        } catch (e: any) {
            setMsg("Não foi possível carregar seus grupos automaticamente. Use o modo manual abaixo.");
            setMyPlayers([]);
        } finally {
            setLoading(false);
        }
    }

    async function createGroup() {
        if (!active?.userId) return;
        setMsg(null);

        await GroupsApi.create({
            name,
            adminUserId: active.userId,
            defaultPlaceName: place,
            defaultDayOfWeek: dayOfWeek,
            defaultTime: time,
        } as any);

        setMsg("Grupo criado! Agora crie o Player desse usuário nesse grupo, ou ajuste o fluxo pra auto-criar o Player.");
        // Depois de criar, pode recarregar “mine” (se o player existir)
        await loadMine();
    }

    function setManual() {
        const gid = safeGuid(groupIdManual);
        const pid = safeGuid(playerIdManual);
        if (!gid || !pid) return;
        setActiveGroupAndPlayer(gid, pid);
    }

    useEffect(() => {
        loadMine();
        // eslint-disable-next-line
    }, [active?.userId]);

    const sorted = useMemo(() => {
        return [...myPlayers].sort((a, b) => (a.groupName ?? "").localeCompare(b.groupName ?? ""));
    }, [myPlayers]);

    return (
        <div className="space-y-6">
            <Section
                title="Patotas (Groups)"
                right={<span className="pill">{loading ? "carregando..." : `${sorted.length} grupos`}</span>}
            >
                {/* AUTO (mine) */}
                <div className="card p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="text-sm font-semibold">Meus grupos (via Players)</div>
                            <div className="muted">Cada item é um Player do usuário em um Group.</div>
                        </div>

                        <button className="btn" onClick={loadMine}>
                            Recarregar
                        </button>
                    </div>

                    <div className="mt-3 grid md:grid-cols-2 gap-3">
                        {sorted.map((p) => {
                            const selected = safeGuid(activeGroupId) === safeGuid(p.groupId) && safeGuid(activePlayerId) === safeGuid(p.playerId);

                            return (
                                <button
                                    key={p.playerId}
                                    className={cls(
                                        "text-left rounded-xl border px-4 py-3 bg-white",
                                        selected ? "border-emerald-400" : "border-slate-200",
                                    )}
                                    onClick={() => setActiveGroupAndPlayer(p.groupId, p.playerId)}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="font-semibold truncate">{p.groupName}</div>
                                            <div className="text-xs text-slate-500 truncate">GroupId: {p.groupId}</div>
                                        </div>
                                        <span className="pill">{selected ? "Ativo" : "Usar"}</span>
                                    </div>

                                    <div className="mt-2 text-sm text-slate-700">
                                        Você: <b>{p.playerName}</b> {p.isGoalkeeper ? "🧤" : ""}
                                    </div>
                                    <div className="text-xs text-slate-500">PlayerId: {p.playerId}</div>
                                </button>
                            );
                        })}

                        {sorted.length === 0 ? <div className="muted">Nenhum grupo encontrado para este usuário.</div> : null}
                    </div>

                    <div className="mt-3 muted">
                        Selecionado: <b>{activeGroupId || "—"}</b> • Player: <b>{activePlayerId || "—"}</b>
                    </div>
                </div>

                {/* MANUAL fallback */}
                <div className="card p-4 mt-4">
                    <div className="text-sm font-semibold">Fallback manual</div>
                    <div className="muted">Só use se o endpoint /api/Players/mine não estiver funcionando.</div>

                    <div className="grid md:grid-cols-2 gap-3 mt-3">
                        <Field label="GroupId (GUID)">
                            <input className="input" value={groupIdManual} onChange={(e) => setGroupIdManual(e.target.value)} />
                        </Field>

                        <Field label="PlayerId (GUID)">
                            <input className="input" value={playerIdManual} onChange={(e) => setPlayerIdManual(e.target.value)} />
                        </Field>
                    </div>

                    <button className="btn btn-primary w-full mt-3" onClick={setManual}>
                        Usar manual
                    </button>
                </div>

                {/* CREATE group (admin) */}
                <div className="card p-4 mt-4">
                    <div className="text-sm font-semibold">Criar grupo</div>
                    {!admin ? <div className="muted mt-2">Você não é admin (criação pode ser bloqueada no backend).</div> : null}

                    <div className="mt-3 space-y-3">
                        <Field label="Nome">
                            <input className="input" value={name} onChange={(e) => setName(e.target.value)} disabled={!admin} />
                        </Field>
                        <Field label="Local padrão">
                            <input className="input" value={place} onChange={(e) => setPlace(e.target.value)} disabled={!admin} />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Dia (0-6)">
                                <input className="input" type="number" value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))} disabled={!admin} />
                            </Field>
                            <Field label="Hora">
                                <input className="input" value={time} onChange={(e) => setTime(e.target.value)} disabled={!admin} />
                            </Field>
                        </div>

                        <button className={cls("btn btn-primary w-full", !admin && "opacity-50 pointer-events-none")} onClick={createGroup}>
                            Criar
                        </button>
                    </div>
                </div>

                {msg ? <div className="text-sm text-emerald-700 mt-4">{msg}</div> : null}
            </Section>
        </div>
    );
}