import { useEffect, useMemo, useState } from 'react';
import { Section } from '../components/Section';
import { Stepper, Step } from '../components/Stepper';
import {
    MatchesApi,
    TeamColorApi,
    TeamGenApi,
    GroupSettingsApi,
} from '../api/endpoints';
import { useAccountStore } from '../auth/accountStore';
import { isAdmin } from '../auth/guards';

type GroupSettingsDto = {
    maxPlayersPerMatch?: number;
    maxPlayers?: number;
    maxPlayersInMatch?: number;
    defaultPlaceName?: string;
    placeName?: string;
    defaultMatchTime?: string; // "20:00"
    matchTime?: string; // "20:00"
};

type PlayerInMatchDto = {
    matchPlayerId: string;   // ⚠️ existe, mas NÃO usamos para aceitar/recusar
    playerId: string;        // ✅ ESTE é o que usamos em tudo
    playerName: string;
    isGoalkeeper: boolean;
    team: number;
    inviteResponse: number;  // 1 None, 2 Rejected, 3 Accepted
};

type MatchDetailsDto = {
    matchId: string;
    groupId: string;
    groupName: string;
    playedAt: string; // ISO
    placeName: string;

    status: number;
    statusName: string;

    teamAGoals?: number | null;
    teamBGoals?: number | null;

    unassignedPlayers: PlayerInMatchDto[];
    teamAPlayers: PlayerInMatchDto[];
    teamBPlayers: PlayerInMatchDto[];
};

const InviteResponse = {
    None: 1,
    Rejected: 2,
    Accepted: 3,
} as const;

function pad2(n: number) {
    return String(n).padStart(2, '0');
}

function toDateInputValue(d: Date) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function isValidHHmm(v: string) {
    if (!/^\d{2}:\d{2}$/.test(v)) return false;
    const [hh, mm] = v.split(':').map(Number);
    return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

function toUtcIso(dateStr: string, timeStr: string) {
    const local = new Date(`${dateStr}T${timeStr}:00`);
    return local.toISOString();
}

function isFinalized(m: any) {
    return m?.statusName === 'Finalized' || m?.status === 4;
}

function cls(...xs: Array<string | false | null | undefined>) {
    return xs.filter(Boolean).join(' ');
}

function getMaxPlayers(gs: GroupSettingsDto | null) {
    const n =
        gs?.maxPlayersPerMatch ??
        gs?.maxPlayersInMatch ??
        gs?.maxPlayers ??
        12;
    return Math.max(2, Number(n) || 12);
}

function getMatchId(m: any): string | null {
    const id = m?.matchId ?? null;
    if (typeof id !== 'string') return null;
    const t = id.trim();
    if (!t || t === 'undefined' || t === 'null') return null;
    return t;
}

function canUserActOnPlayer(isUserAdmin: boolean, activePlayerId: string | null, targetPlayerId: string) {
    if (isUserAdmin) return true;
    if (!activePlayerId) return false;
    return activePlayerId === targetPlayerId;
}

export default function MatchesPage() {
    const store = useAccountStore();
    const active = store.getActive();
    const groupId = active?.activeGroupId;

    // ✅ aqui precisa ser o PlayerId do usuário logado (não MatchPlayerId!)
    const activePlayerId: string | null =
        (active as any)?.activePlayerId ??
        null;

    const admin = isAdmin();

    const [matches, setMatches] = useState<any[]>([]);
    const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
    const [current, setCurrent] = useState<MatchDetailsDto | null>(null);

    const [teamColors, setTeamColors] = useState<any[]>([]);
    const [groupSettings, setGroupSettings] = useState<GroupSettingsDto | null>(null);

    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);

    // ✅ MUTATING POR PLAYERID (não por matchPlayerId)
    const [mutatingInvite, setMutatingInvite] = useState<Record<string, boolean>>({});

    // criar partida
    const [placeName, setPlaceName] = useState('');
    const [playedAtDate, setPlayedAtDate] = useState(() => toDateInputValue(new Date()));
    const [playedAtTime, setPlayedAtTime] = useState('');

    // teamgen
    const [strategyType, setStrategyType] = useState(0);
    const [includeGoalkeepers, setIncludeGoalkeepers] = useState(true);
    const [playersPerTeam, setPlayersPerTeam] = useState(6);

    const maxPlayers = useMemo(() => getMaxPlayers(groupSettings), [groupSettings]);

    const placeNameOk = placeName.trim().length > 0;
    const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(playedAtDate);
    const timeOk = isValidHHmm(playedAtTime);
    const canCreateMatch = !!groupId && placeNameOk && dateOk && timeOk && !creating;

    function pickActiveMatch(list: any[]) {
        if (!Array.isArray(list) || list.length === 0) return null;
        const notFinalized = list
            .filter(m => !isFinalized(m))
            .sort((a, b) => new Date(b.playedAt ?? 0).getTime() - new Date(a.playedAt ?? 0).getTime());
        return notFinalized[0] ?? null;
    }

    async function loadDetails(matchId: string) {
        if (!groupId || !matchId) return;
        // ✅ seu endpoint de details normalmente precisa groupId + matchId
        const res = await MatchesApi.details(groupId, matchId);
        setCurrent(res.data as MatchDetailsDto);
    }

    async function loadList() {
        if (!groupId) return;
        setLoading(true);
        try {
            const [matchesRes, colorsRes, settingsRes] = await Promise.all([
                MatchesApi.list(groupId),
                TeamColorApi.list(groupId),
                GroupSettingsApi.get(groupId),
            ]);

            const list = matchesRes.data ?? [];
            setMatches(list);
            setTeamColors(colorsRes.data ?? []);

            const gs = (settingsRes.data ?? null) as GroupSettingsDto | null;
            setGroupSettings(gs);

            if (gs) {
                const suggestedPlace = gs.defaultPlaceName ?? gs.placeName;
                const suggestedTime = gs.defaultMatchTime ?? gs.matchTime;
                setPlaceName(prev => prev.trim().length ? prev : (suggestedPlace ?? ''));
                setPlayedAtTime(prev => prev.trim().length ? prev : (suggestedTime ?? ''));
            }

            const activeMatch = pickActiveMatch(list);
            const id = getMatchId(activeMatch);

            setCurrentMatchId(id);
            if (!id) setCurrent(null);
            else await loadDetails(id);
        } finally {
            setLoading(false);
        }
    }

    async function refreshCurrent() {
        if (!currentMatchId) return;
        await loadDetails(currentMatchId);
    }

    async function createMatch() {
        if (!canCreateMatch) return;
        setCreating(true);
        try {
            const playedAt = toUtcIso(playedAtDate, playedAtTime);
            await MatchesApi.create(groupId!, { placeName: placeName.trim(), playedAt } as any);
            await loadList();
        } finally {
            setCreating(false);
        }
    }

    async function generateTeams() {
        if (!groupId) return;
        const req = { groupId, strategyType, playersPerTeam, includeGoalkeepers } as any;
        const res = await TeamGenApi.generate(req);
        setCurrent((c: any) => ({ ...c, generatedTeams: res.data }));
    }

    async function setColorsRandom() {
        if (!groupId || !currentMatchId) return;
        const a = teamColors[0];
        const b = teamColors[1] ?? teamColors[0];
        if (!a || !b) return;

        await MatchesApi.setColors(groupId, currentMatchId, { teamAColorId: a.id, teamBColorId: b.id } as any);
        await refreshCurrent();
    }

    async function start() {
        if (!groupId || !currentMatchId) return;
        await MatchesApi.start(groupId, currentMatchId);
        await refreshCurrent();
    }

    async function end() {
        if (!groupId || !currentMatchId) return;
        await MatchesApi.end(groupId, currentMatchId);
        await refreshCurrent();
    }

    async function finalize() {
        if (!groupId || !currentMatchId) return;
        await MatchesApi.finalize(groupId, currentMatchId);
        await loadList();
    }

    /**
     * ✅ Accept/Decline usando PLAYERID
     */
    async function acceptInvite(playerId: string) {
        if (!groupId || !currentMatchId) return;

        setMutatingInvite(prev => ({ ...prev, [playerId]: true }));
        try {
            await MatchesApi.accept(groupId, currentMatchId, { playerId } as any);
            await refreshCurrent();
        } finally {
            setMutatingInvite(prev => ({ ...prev, [playerId]: false }));
        }
    }

    async function rejectInvite(playerId: string) {
        if (!groupId || !currentMatchId) return;

        setMutatingInvite(prev => ({ ...prev, [playerId]: true }));
        try {
            await MatchesApi.reject(groupId, currentMatchId, { playerId } as any);
            await refreshCurrent();
        } finally {
            setMutatingInvite(prev => ({ ...prev, [playerId]: false }));
        }
    }

    const stepKey = useMemo(() => {
        if (!current) return 'create';

        const statusName = current.statusName;  
        const statusCode = current.status;      

        if (statusName === 'Created' || statusCode === 0) return 'invite';
        if (statusName === 'TeamsGenerated' || statusCode === 1) return 'teams';
        if (statusName === 'Started' || statusCode === 2) return 'playing';
        if (statusName === 'Ended' || statusCode === 3) return 'post';
        if (statusName === 'Finalized' || statusCode === 4) return 'done';

        return 'invite';
    }, [current]);

    function stepsOrderDone(k: string, activeK: string) {
        const order = ['create', 'invite', 'teams', 'playing', 'post', 'done'];
        return order.indexOf(k) < order.indexOf(activeK);
    }

    const steps: Step[] = [
        { key: 'create', title: 'Criar', subtitle: 'Nova partida' },
        { key: 'invite', title: 'Convites', subtitle: 'Aceites/Recusas' },
        { key: 'teams', title: 'Times', subtitle: 'Gerar / swap / setar' },
        { key: 'playing', title: 'Jogo', subtitle: 'Start / End' },
        { key: 'post', title: 'Pós-jogo', subtitle: 'MVP / Gols / Placar' },
        { key: 'done', title: 'Final', subtitle: 'Finalizada' },
    ].map(s => ({ ...s, done: stepsOrderDone(s.key, stepKey) }));

    /**
     * ✅ REGRA: convites vêm de UnassignedPlayers.
     * ✅ LISTA E AÇÃO usam PlayerId.
     */
    const invitePool = useMemo<PlayerInMatchDto[]>(() => {
        const list = current?.unassignedPlayers ?? [];
        return Array.isArray(list) ? list : [];
    }, [current]);

    const accepted = useMemo(
        () => invitePool.filter(p => Number(p.inviteResponse) === InviteResponse.Accepted),
        [invitePool]
    );

    const rejected = useMemo(
        () => invitePool.filter(p => Number(p.inviteResponse) === InviteResponse.Rejected),
        [invitePool]
    );

    const pending = useMemo(
        () => invitePool.filter(p => Number(p.inviteResponse) === InviteResponse.None),
        [invitePool]
    );

    const acceptedCount = accepted.length;
    const acceptedOverLimit = acceptedCount > maxPlayers;

    useEffect(() => {
        loadList();
        // eslint-disable-next-line
    }, [groupId]);

    function InviteList({
        title,
        items,
        variant,
    }: {
        title: string;
        items: PlayerInMatchDto[];
        variant: 'accepted' | 'rejected' | 'pending';
    }) {
        return (
            <div className="card p-4">
                <div className="flex items-center justify-between">
                    <div className="font-semibold">{title}</div>
                    <span className="pill">{items.length}</span>
                </div>

                <div className="mt-3 grid gap-2">
                    {items.map((p) => {
                        const pid = p.playerId; // ✅ SEMPRE PLAYERID
                        const name = p.playerName || '—';

                        const canAct = canUserActOnPlayer(admin, activePlayerId, pid);
                        const busy = !!mutatingInvite[pid];

                        // Pending: pode aceitar ou recusar
                        // Accepted: pode recusar
                        // Rejected: pode aceitar
                        const showAccept = canAct && (variant === 'pending' || variant === 'rejected');
                        const showReject = canAct && (variant === 'pending' || variant === 'accepted');

                        return (
                            <div
                                key={pid} // ✅ chave por PLAYERID
                                className="flex items-center justify-between gap-3 border border-slate-200 rounded-xl px-3 py-2 bg-white"
                            >
                                <div className="min-w-0">
                                    <div className="font-medium truncate">{name}</div>

                                    {/* ✅ Mostra PlayerId (não MatchPlayerId) */}
                                    <div className="text-xs text-slate-500 truncate">{pid}</div>

                                    {/* opcional debug */}
                                    {/* <div className="text-[10px] text-slate-400 truncate">mp: {p.matchPlayerId}</div> */}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    {showReject ? (
                                        <button
                                            className={cls('btn', busy && 'opacity-50 pointer-events-none')}
                                            title="Recusar"
                                            disabled={busy}
                                            onClick={() => rejectInvite(pid)} // ✅ PLAYERID
                                        >
                                            ✕
                                        </button>
                                    ) : null}

                                    {showAccept ? (
                                        <button
                                            className={cls('btn btn-primary', busy && 'opacity-50 pointer-events-none')}
                                            title="Aceitar"
                                            disabled={busy}
                                            onClick={() => acceptInvite(pid)} // ✅ PLAYERID
                                        >
                                            ✓
                                        </button>
                                    ) : null}

                                    {!canAct ? <span className="pill">—</span> : null}
                                </div>
                            </div>
                        );
                    })}

                    {items.length === 0 ? <div className="muted">Nenhum.</div> : null}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Section
                title="Partida (Match Wizard)"
                right={<span className="pill">{loading ? 'carregando...' : current ? 'ativa' : 'sem partida'}</span>}
            >
                {!groupId ? (
                    <div className="muted">Selecione um Group no Dashboard.</div>
                ) : (
                    <div className="space-y-4">
                        <Stepper steps={steps} activeKey={stepKey} />

                        {/* CREATE */}
                        {!current ? (
                            <div className="grid lg:grid-cols-2 gap-4">
                                <div className="card p-4 space-y-4">
                                    <div className="font-semibold">Criar nova partida</div>
                                    <div className="muted">Não pode criar sem <b>Local</b> e <b>Horário</b>.</div>

                                    <label className="block">
                                        <div className="label">Local (PlaceName) *</div>
                                        <input
                                            className="input"
                                            placeholder="Ex: Boca Jrs"
                                            value={placeName}
                                            onChange={(e) => setPlaceName(e.target.value)}
                                        />
                                    </label>

                                    <div className="grid grid-cols-2 gap-3">
                                        <label className="block">
                                            <div className="label">Data *</div>
                                            <input
                                                className="input"
                                                type="date"
                                                value={playedAtDate}
                                                onChange={(e) => setPlayedAtDate(e.target.value)}
                                            />
                                        </label>

                                        <label className="block">
                                            <div className="label">Horário *</div>
                                            <input
                                                className="input"
                                                type="time"
                                                value={playedAtTime}
                                                onChange={(e) => setPlayedAtTime(e.target.value)}
                                            />
                                        </label>
                                    </div>

                                    <button
                                        className={cls('btn btn-primary', !canCreateMatch && 'opacity-50 pointer-events-none')}
                                        disabled={!canCreateMatch}
                                        onClick={createMatch}
                                    >
                                        {creating ? 'Criando...' : 'Criar partida'}
                                    </button>
                                </div>

                                <div className="card p-4">
                                    <div className="font-semibold">Histórico</div>
                                    <div className="muted">Se existir partida não-finalizada, ela será carregada automaticamente.</div>

                                    <div className="mt-3 grid gap-2">
                                        {matches.map((m) => {
                                            const id = getMatchId(m);
                                            if (!id) return null;

                                            return (
                                                <button
                                                    key={id}
                                                    className="btn justify-between"
                                                    onClick={async () => {
                                                        setCurrentMatchId(id);
                                                        await loadDetails(id);
                                                    }}
                                                >
                                                    <span>{m.playedAt ? new Date(m.playedAt).toLocaleString() : 'Partida'} • {m.statusName ?? m.status}</span>
                                                    <span className="pill">{id === currentMatchId ? 'Selecionada' : 'Abrir'}</span>
                                                </button>
                                            );
                                        })}
                                        {matches.length === 0 ? <div className="muted">Sem partidas ainda.</div> : null}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* HEADER CURRENT */}
                                <div className="card p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="font-semibold">Partida Atual</div>
                                            <div className="muted mt-1 truncate">
                                                {current.playedAt ? new Date(current.playedAt).toLocaleString() : '—'} • {current.placeName ?? '—'}
                                            </div>
                                            <div className="muted">Status: {String(current.statusName ?? current.status)}</div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="pill">Aceitos: {acceptedCount}/{maxPlayers}</span>
                                            <span className="pill">Pendentes: {pending.length}</span>
                                        </div>
                                    </div>

                                    {acceptedOverLimit ? (
                                        <div className="mt-3 text-sm text-red-700">
                                            Passou do limite de aceitos: <b>{acceptedCount}</b> / <b>{maxPlayers}</b>. Recuse alguns para poder iniciar.
                                        </div>
                                    ) : null}
                                </div>

                                {/* INVITES */}
                                {stepKey === 'invite' ? (
                                    <div className="space-y-4">
                                        <div className="grid lg:grid-cols-3 gap-4">
                                            <InviteList title="Aceitos" items={accepted} variant="accepted" />
                                            <InviteList title="Não Aceitos" items={rejected} variant="rejected" />
                                            <InviteList title="Pendentes" items={pending} variant="pending" />
                                        </div>

                                        <div className="card p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="muted text-sm">
                                                    {admin ? (
                                                        <>Admin: você pode aceitar/recusar <b>qualquer jogador</b>.</>
                                                    ) : (
                                                        <>Você só pode aceitar/recusar <b>seu próprio nome</b>.</>
                                                    )}
                                                    <div className="muted">
                                                        Regras: pendente → qualquer lista; aceito ↔ não aceito; <b>não volta para pendente</b>.
                                                    </div>
                                                </div>

                                                {admin ? (
                                                    <div className="flex items-center gap-2">
                                                        <button className="btn" onClick={setColorsRandom}>Sortear cores</button>
                                                        <button
                                                            className={cls('btn btn-primary', (acceptedOverLimit || acceptedCount < 2) && 'opacity-50 pointer-events-none')}
                                                            disabled={acceptedOverLimit || acceptedCount < 2}
                                                            onClick={start}
                                                            title={
                                                                acceptedOverLimit
                                                                    ? 'Reduza aceitos para o limite'
                                                                    : acceptedCount < 2
                                                                        ? 'Precisa de pelo menos 2 aceitos'
                                                                        : 'Iniciar'
                                                            }
                                                        >
                                                            Start
                                                        </button>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                ) : null}

                                {/* OUTRAS AÇÕES */}
                                <div className="grid lg:grid-cols-2 gap-4">
                                    <div className="card p-4">
                                        <div className="font-semibold">Ações</div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {admin ? <button className="btn btn-primary" onClick={start} disabled={acceptedOverLimit || acceptedCount < 2}>Start</button> : null}
                                            {admin ? <button className="btn" onClick={end}>End</button> : null}
                                            {admin ? <button className="btn btn-primary" onClick={finalize}>Finalize</button> : null}
                                            {admin ? <button className="btn" onClick={generateTeams}>Gerar times</button> : null}
                                            {admin ? <button className="btn" onClick={setColorsRandom}>Sortear cores</button> : null}
                                            <button className="btn" onClick={refreshCurrent}>Recarregar</button>
                                        </div>
                                    </div>

                                    <div className="card p-4">
                                        <div className="font-semibold">TeamGeneration (config)</div>
                                        <div className="grid grid-cols-3 gap-3 mt-3">
                                            <label className="block">
                                                <div className="label">StrategyType</div>
                                                <input
                                                    className="input"
                                                    type="number"
                                                    value={strategyType}
                                                    onChange={(e) => setStrategyType(Number(e.target.value))}
                                                />
                                            </label>
                                            <label className="block">
                                                <div className="label">Players/Team</div>
                                                <input
                                                    className="input"
                                                    type="number"
                                                    value={playersPerTeam}
                                                    onChange={(e) => setPlayersPerTeam(Number(e.target.value))}
                                                />
                                            </label>
                                            <label className="block">
                                                <div className="label">Include GK</div>
                                                <input className="input" value={includeGoalkeepers ? 'true' : 'false'} readOnly />
                                            </label>
                                        </div>

                                        <label className="flex items-center gap-2 mt-3">
                                            <input
                                                type="checkbox"
                                                checked={includeGoalkeepers}
                                                onChange={(e) => setIncludeGoalkeepers(e.target.checked)}
                                            />
                                            <span className="text-sm font-medium text-slate-700">Incluir goleiros</span>
                                        </label>

                                        {current && (current as any).generatedTeams ? (
                                            <pre className="mt-3 text-xs bg-slate-900 text-slate-50 rounded-xl p-3 overflow-auto max-h-64">
                                                {JSON.stringify((current as any).generatedTeams, null, 2)}
                                            </pre>
                                        ) : (
                                            <div className="muted mt-3">Gere times para visualizar aqui.</div>
                                        )}
                                    </div>
                                </div>

                                {/* HISTÓRICO */}
                                <div className="card p-4">
                                    <div className="font-semibold">Histórico</div>
                                    <div className="muted">Clique para abrir uma partida</div>
                                    <div className="mt-3 grid gap-2">
                                        {matches.map((m) => {
                                            const id = getMatchId(m);
                                            if (!id) return null;

                                            return (
                                                <button
                                                    key={id}
                                                    className="btn justify-between"
                                                    onClick={async () => {
                                                        setCurrentMatchId(id);
                                                        await loadDetails(id);
                                                    }}
                                                >
                                                    <span>{m.playedAt ? new Date(m.playedAt).toLocaleString() : 'Partida'} • {m.statusName ?? m.status}</span>
                                                    <span className="pill">{id === currentMatchId ? 'Selecionada' : 'Abrir'}</span>
                                                </button>
                                            );
                                        })}
                                        {matches.length === 0 ? <div className="muted">Sem partidas ainda.</div> : null}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </Section>
        </div>
    );
}