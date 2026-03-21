import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PlayersApi, MatchesApi, PaymentsApi } from '../api/endpoints';
import { useAccountStore } from '../auth/accountStore';
import { getResponseMessage } from '../api/apiResponse';
import { MiniShirt } from '../domains/matches/ui/MiniShirt';
import { Calendar, CalendarDays, History, LayoutDashboard, MapPin, RefreshCw, Star, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useGroupIcons } from '../hooks/useGroupIcons';
import { IconRenderer } from '../components/IconRenderer';
import { resolveIcon } from '../lib/groupIcons';

// ─── Local types ──────────────────────────────────────────────────────────────

type MyPlayer = {
  playerId: string;
  groupId: string;
  playerName: string;
  isGoalkeeper: boolean;
  skillPoints: number;
  isGuest: boolean;
};

type TeamColor = { id: string; name: string; hexValue: string };

type MatchPlayer = {
  matchPlayerId: string;
  playerId: string;
  playerName: string;
  isGoalkeeper: boolean;
  team: number;          // 0=unassigned 1=A 2=B
  inviteResponse: number; // 1=None 2=Rejected 3=Accepted
};

type Goal = {
  goalId: string;
  scorerPlayerId: string;
  assistPlayerId?: string | null;
};

type MatchMvp = { playerId: string; playerName: string; team: number };

type MatchDetails = {
  matchId: string;
  playedAt: string;
  placeName: string;
  status: number;
  statusName: string;
  teamAGoals?: number | null;
  teamBGoals?: number | null;
  teamAColor?: TeamColor | null;
  teamBColor?: TeamColor | null;
  teamAPlayers: MatchPlayer[];
  teamBPlayers: MatchPlayer[];
  unassignedPlayers: MatchPlayer[];
  computedMvp?: MatchMvp | null;
  goals?: Goal[];
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const normalizeHex = (hex?: string | null) => {
  const v = (hex ?? '').trim();
  if (!v) return null;
  return v.startsWith('#') ? v : `#${v}`;
};

function formatDate(playedAt?: string) {
  if (!playedAt) return null;
  const d = new Date(playedAt);
  if (isNaN(d.getTime())) return null;
  return {
    day:   d.toLocaleDateString('pt-BR', { day: '2-digit' }),
    month: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
    time:  d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    full:  d.toLocaleString('pt-BR', {
      weekday: 'short', day: '2-digit', month: 'short',
      year: 'numeric', hour: '2-digit', minute: '2-digit',
    }),
    short: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
  };
}

function getPlayerInMatch(match: MatchDetails, playerId: string) {
  const inA = match.teamAPlayers?.find(p => p.playerId === playerId);
  if (inA) return { player: inA, color: match.teamAColor ?? null };
  const inB = match.teamBPlayers?.find(p => p.playerId === playerId);
  if (inB) return { player: inB, color: match.teamBColor ?? null };
  const unassigned = match.unassignedPlayers?.find(p => p.playerId === playerId);
  if (unassigned) return { player: unassigned, color: null };
  return null;
}

function getOutcome(team: number, teamAGoals?: number | null, teamBGoals?: number | null) {
  if (typeof teamAGoals !== 'number' || typeof teamBGoals !== 'number') return null;
  if (teamAGoals === teamBGoals) return 'draw' as const;
  if (team === 1) return teamAGoals > teamBGoals ? 'win' as const : 'loss' as const;
  if (team === 2) return teamBGoals > teamAGoals ? 'win' as const : 'loss' as const;
  return null;
}

// ─── Small UI atoms ───────────────────────────────────────────────────────────

function ColorDot({ hex, lg }: { hex?: string | null; lg?: boolean }) {
  const color = normalizeHex(hex);
  if (!color) return <span className={`inline-block rounded-full bg-slate-200 shrink-0 ${lg ? 'h-5 w-5' : 'h-3.5 w-3.5'}`} />;
  const isWhite = color.toLowerCase() === '#ffffff';
  return (
    <span
      className={`inline-block rounded-full border shrink-0 ${lg ? 'h-5 w-5' : 'h-3.5 w-3.5'} ${isWhite ? 'border-slate-300 shadow-sm' : 'border-white/30'}`}
      style={{ backgroundColor: color }}
    />
  );
}

function StatusBadge({ text }: { text?: string }) {
  const s = (text ?? '').toLowerCase();
  let cls = 'bg-slate-50 text-slate-600 border-slate-200';
  if (s.includes('final') || s.includes('done'))          cls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  else if (s.includes('jog') || s.includes('play') || s.includes('live'))
                                                           cls = 'bg-blue-50 text-blue-700 border-blue-200';
  else if (s.includes('time') || s.includes('match'))     cls = 'bg-violet-50 text-violet-700 border-violet-200';
  else if (s.includes('aceit') || s.includes('accept'))   cls = 'bg-amber-50 text-amber-700 border-amber-200';
  else if (s.includes('pós') || s.includes('post') || s.includes('encer'))
                                                           cls = 'bg-orange-50 text-orange-700 border-orange-200';
  return (
    <span className={`text-[10px] font-medium rounded-full border px-2.5 py-0.5 ${cls}`}>{text}</span>
  );
}

function InviteBadge({ response }: { response?: number }) {
  if (response === 3)
    return <span className="text-xs rounded-full border px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200">Confirmado ✓</span>;
  if (response === 2)
    return <span className="text-xs rounded-full border px-2.5 py-0.5 bg-red-50 text-red-700 border-red-200">Recusado</span>;
  return <span className="text-xs rounded-full border px-2.5 py-0.5 bg-amber-50 text-amber-700 border-amber-200">Pendente</span>;
}

const OUTCOME_META = {
  win:  { label: 'Vitória', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  draw: { label: 'Empate',  cls: 'bg-amber-50  text-amber-700  border-amber-200'  },
  loss: { label: 'Derrota', cls: 'bg-red-50    text-red-700    border-red-200'    },
} as const;

// ─── DashboardPage ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const store = useAccountStore();
  const active = store.getActive();
  const groupId         = active?.activeGroupId ?? null;
  const selectedPlayerId = active?.activePlayerId ?? '';

  const [myPlayers,    setMyPlayers]    = useState<MyPlayer[]>([]);

  const [currentMatch,    setCurrentMatch]    = useState<MatchDetails | null>(null);
  const [currentLoading,  setCurrentLoading]  = useState(false);
  const [noCurrentMatch,  setNoCurrentMatch]  = useState(false);

  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentDetails, setRecentDetails] = useState<Record<string, MatchDetails>>({});

  const [paymentSummary,        setPaymentSummary]        = useState<any>(null);
  const [paymentSummaryLoading, setPaymentSummaryLoading] = useState(false);

  const selectedPlayer = useMemo(() => myPlayers.find(p => p.playerId === selectedPlayerId), [myPlayers, selectedPlayerId]);

  // ── load players for active group ──────────────────────────────────────────
  async function loadPlayers() {
    if (!groupId) return;
    try {
      const res = await PlayersApi.mine();
      const all: any[] = res.data.data! ?? [];
      const filtered = all.filter(p => p.groupId === groupId) as MyPlayer[];
      setMyPlayers(filtered);
      if (filtered.length > 0 && !filtered.find(p => p.playerId === selectedPlayerId)) {
        store.updateActive({ activePlayerId: filtered[0].playerId });
      }
    } catch (e) {
      toast.error(getResponseMessage(e, 'Falha ao carregar jogadores.'));
    }
  }

  // ── load current match ─────────────────────────────────────────────────────
  async function loadCurrentMatch() {
    if (!groupId) return;
    setCurrentLoading(true);
    setCurrentMatch(null);
    setNoCurrentMatch(false);
    try {
      const headerRes = await MatchesApi.getCurrent(groupId);
      const matchId = (headerRes.data.data as any)?.id ?? headerRes.data.data?.matchId;
      if (!matchId) { setNoCurrentMatch(true); return; }
      const detRes = await MatchesApi.details(groupId, matchId);
      setCurrentMatch((detRes.data.data! as unknown as MatchDetails) ?? null);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404 || status === 204) setNoCurrentMatch(true);
      else toast.error(getResponseMessage(e, 'Falha ao carregar partida atual.'));
    } finally {
      setCurrentLoading(false);
    }
  }

  // ── load recent matches for player ─────────────────────────────────────────
  async function loadRecentMatches() {
    if (!groupId || !selectedPlayerId) return;
    setRecentLoading(true);
    setRecentMatches([]);
    setRecentDetails({});
    try {
      // Uma única chamada ao endpoint dedicado — retorna tudo já enriquecido
      const res = await MatchesApi.playerRecent(groupId, selectedPlayerId, 3);
      setRecentMatches(Array.isArray(res.data.data) ? res.data.data as any[] : []);
    } catch (e) {
      toast.error(getResponseMessage(e, 'Falha ao carregar histórico.'));
    } finally {
      setRecentLoading(false);
    }
  }

  // ── load payment summary ───────────────────────────────────────────────────
  async function loadPaymentSummary() {
    if (!groupId) return;
    setPaymentSummaryLoading(true);
    try {
      const res = await PaymentsApi.getMySummary(groupId);
      setPaymentSummary((res.data.data ?? null) as any);
    } catch {
      // silencioso — summary é best-effort
    } finally {
      setPaymentSummaryLoading(false);
    }
  }

  // ── effects ────────────────────────────────────────────────────────────────
  useEffect(() => { loadPlayers(); loadCurrentMatch(); loadPaymentSummary(); /* eslint-disable-next-line */ }, [groupId, selectedPlayerId]);
  useEffect(() => { loadRecentMatches(); /* eslint-disable-next-line */ }, [groupId, selectedPlayerId]);

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="relative rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-6 py-6 overflow-hidden shadow-lg">
        <div className="absolute inset-0 pointer-events-none opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="relative flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
            <LayoutDashboard size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-black leading-tight">Dashboard</h1>
            <p className="text-sm text-white/50 mt-0.5">
              {selectedPlayer ? selectedPlayer.playerName : groupId ? 'Selecione um jogador' : 'Selecione um grupo no Dashboard'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Partida atual ── */}
      <div className="card p-0 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <CalendarDays size={13} className="text-blue-600" />
            </div>
            <span className="text-sm font-semibold text-slate-800">Partida atual</span>
          </div>
          {groupId && (
            <button
              type="button"
              onClick={loadCurrentMatch}
              disabled={currentLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <RefreshCw size={12} className={currentLoading ? 'animate-spin' : ''} />
              Atualizar
            </button>
          )}
        </div>
        <div className="p-5">
          {!groupId ? (
            <p className="text-sm text-slate-400 text-center py-6">Selecione uma patota para ver a partida atual.</p>
          ) : currentLoading ? (
            <div className="h-32 rounded-2xl bg-slate-100 animate-pulse" />
          ) : noCurrentMatch || !currentMatch ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
              <Calendar size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-500">Nenhuma partida em andamento</p>
              <p className="text-xs text-slate-400 mt-1">
                Inicie uma partida na seção <b>Partidas</b>.
              </p>
            </div>
          ) : (
            <CurrentMatchCard match={currentMatch} playerId={selectedPlayerId} />
          )}
        </div>
      </div>

      {/* ── Últimas partidas ── */}
      <div className="card p-0 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <History size={13} className="text-violet-600" />
            </div>
            <span className="text-sm font-semibold text-slate-800">
              Últimas partidas{selectedPlayer ? ` · ${selectedPlayer.playerName}` : ''}
            </span>
          </div>
          {selectedPlayerId && groupId && (
            <button
              type="button"
              onClick={loadRecentMatches}
              disabled={recentLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <RefreshCw size={12} className={recentLoading ? 'animate-spin' : ''} />
              Atualizar
            </button>
          )}
        </div>
        <div className="p-5">
          {!selectedPlayerId ? (
            <p className="text-sm text-slate-400 text-center py-6">Selecione um jogador para ver suas últimas partidas.</p>
          ) : recentLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />)}
            </div>
          ) : recentMatches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
              <Calendar size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-500">Nenhuma partida encontrada</p>
              <p className="text-xs text-slate-400 mt-1">As últimas partidas do jogador aparecerão aqui.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentMatches.map(m => (
                <RecentMatchCard key={m.matchId} match={m} groupId={groupId ?? ''} />
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

// ─── CurrentMatchCard ─────────────────────────────────────────────────────────

function CurrentMatchCard({ match, playerId }: { match: MatchDetails; playerId: string }) {
  const nav   = useNavigate();
  const dates = formatDate(match.playedAt);
  const found = playerId ? getPlayerInMatch(match, playerId) : null;
  const isAssigned   = found && found.player.team !== 0;
  const isUnassigned = found && found.player.team === 0;

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white overflow-hidden cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all"
      onClick={() => nav('/app/matches')}
      role="button"
    >

      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 bg-slate-900 px-5 py-3">
        <div className="flex items-center gap-2 text-sm text-white min-w-0">
          <Clock size={14} className="text-slate-400 shrink-0" />
          <span className="font-medium truncate">{dates?.full ?? '—'}</span>
        </div>
        <StatusBadge text={match.statusName} />
      </div>

      {/* Body */}
      <div className="px-5 py-4 flex flex-col sm:flex-row gap-5">

        {/* Left — match info */}
        <div className="flex-1 space-y-3 min-w-0">
          {match.placeName && (
            <div className="flex items-center gap-1.5 text-sm text-slate-600">
              <MapPin size={14} className="text-slate-400 shrink-0" />
              {match.placeName}
            </div>
          )}

          {/* Teams side by side */}
          <div className="flex items-center gap-4 flex-wrap">
            <TeamBlock
              color={match.teamAColor}
              label="Time A"
              count={match.teamAPlayers?.length ?? 0}
            />
            <span className="text-xs font-bold text-slate-300">VS</span>
            <TeamBlock
              color={match.teamBColor}
              label="Time B"
              count={match.teamBPlayers?.length ?? 0}
            />
          </div>

          {/* Score if available */}
          {typeof match.teamAGoals === 'number' && typeof match.teamBGoals === 'number' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Placar:</span>
              <div className="flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1">
                <span className="text-sm font-extrabold text-white tabular-nums">{match.teamAGoals}</span>
                <span className="text-slate-500 text-xs mx-0.5">×</span>
                <span className="text-sm font-extrabold text-white tabular-nums">{match.teamBGoals}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right — player status */}
        {playerId && (
          <div className="sm:border-l sm:border-slate-100 sm:pl-5 shrink-0 min-w-[170px]">
            <div className="label mb-3">Sua situação</div>

            {!found ? (
              <p className="text-sm text-slate-400">Não está nesta partida.</p>
            ) : isUnassigned ? (
              <div className="space-y-2">
                <p className="text-sm text-slate-500">Aguardando alocação de time.</p>
                <InviteBadge response={found.player.inviteResponse} />
              </div>
            ) : isAssigned && found ? (
              <div className="space-y-2">
                <MiniShirt
                  color={found.color?.hexValue ?? ''}
                  label={`Time ${found.player.team === 1 ? 'A' : 'B'} · ${found.color?.name ?? '—'}`}
                />
                <InviteBadge response={found.player.inviteResponse} />
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function TeamBlock({ color, label, count }: { color?: TeamColor | null; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <ColorDot hex={color?.hexValue} lg />
      <div className="text-xs">
        <div className="font-medium text-slate-700">{color?.name ?? label}</div>
        <div className="text-slate-400">{count} jogador{count !== 1 ? 'es' : ''}</div>
      </div>
    </div>
  );
}

// ─── RecentMatchCard ──────────────────────────────────────────────────────────

function RecentMatchCard({ match, groupId }: { match: any; groupId: string }) {
  const nav   = useNavigate();
  const icons = useGroupIcons(groupId);

  // Campos diretos do PlayerRecentMatchDto
  const matchId     = match?.matchId;
  const dates       = formatDate(match?.playedAt);
  const scoreA      = match?.teamAGoals ?? null;
  const scoreB      = match?.teamBGoals ?? null;
  const hasScore    = typeof scoreA === 'number' && typeof scoreB === 'number';
  const playerTeam  = match?.playerTeam as 1 | 2 | null;    // 1=A / 2=B
  const teamAHex    = normalizeHex(match?.teamAColorHex);
  const teamAName   = match?.teamAColorName ?? 'Time A';
  const teamBHex    = normalizeHex(match?.teamBColorHex);
  const teamBName   = match?.teamBColorName ?? 'Time B';
  const myHex       = playerTeam === 1 ? teamAHex  : playerTeam === 2 ? teamBHex  : null;
  const myName      = playerTeam === 1 ? teamAName : playerTeam === 2 ? teamBName : null;
  const goals       = match?.playerGoals   as number ?? 0;
  const assists     = match?.playerAssists as number ?? 0;

  const outcome: 'win' | 'loss' | 'draw' | null = (() => {
    if (!hasScore || !playerTeam) return null;
    const mine = playerTeam === 1 ? scoreA : scoreB;
    const opp  = playerTeam === 1 ? scoreB : scoreA;
    if (mine > opp) return 'win';
    if (mine < opp) return 'loss';
    return 'draw';
  })();

  const OUTCOME = {
    win:  { label: 'Vitória', cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
    loss: { label: 'Derrota', cls: 'bg-rose-50 border-rose-200 text-rose-700' },
    draw: { label: 'Empate',  cls: 'bg-slate-50 border-slate-200 text-slate-600' },
  } as const;

  return (
    <button
      className="w-full text-left rounded-2xl border border-slate-200 bg-white overflow-hidden flex items-stretch cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all"
      onClick={() => nav(`/app/history/${groupId}/${matchId}`)}
    >
      {/* Accent strip — neutra */}
      <div className="w-1 shrink-0 bg-slate-200" />

      {/* Date box */}
      <div className="flex flex-col items-center justify-center bg-slate-50 border-r border-slate-100 px-4 py-3 shrink-0 min-w-[58px]">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{dates?.month ?? '—'}</div>
        <div className="text-xl font-extrabold text-slate-800 leading-none">{dates?.day ?? '—'}</div>
        {dates?.time && <div className="text-[10px] text-slate-400 mt-0.5">{dates.time}</div>}
      </div>

      {/* Info */}
      <div className="flex flex-1 items-center gap-3 px-4 py-3 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">

            {/* Cor do time do jogador */}
            {myHex || myName ? (
              <div className="flex items-center gap-1.5">
                {myHex && <ColorDot hex={myHex} />}
                <span className="text-[10px] text-slate-500 font-medium">{myName}</span>
              </div>
            ) : (teamAHex || teamBHex) ? (
              <div className="flex items-center gap-1">
                {teamAHex && <ColorDot hex={teamAHex} />}
                <span className="text-[10px] text-slate-300 font-bold">vs</span>
                {teamBHex && <ColorDot hex={teamBHex} />}
              </div>
            ) : null}

            {/* Resultado */}
            {outcome && (
              <span className={`text-[10px] font-medium rounded-full border px-2 py-0.5 leading-none ${OUTCOME[outcome].cls}`}>
                {OUTCOME[outcome].label}
              </span>
            )}

            {/* Gols */}
            {goals !== null && goals > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-slate-500 font-medium">
                <IconRenderer value={resolveIcon(icons, 'goal')} size={20} />
                {goals}
              </span>
            )}

            {/* Assistências */}
            {assists !== null && assists > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-slate-500 font-medium">
                <IconRenderer value={resolveIcon(icons, 'assist')} size={20} />
                {assists}
              </span>
            )}
          </div>
        </div>

        {/* Placar */}
        {hasScore && (
          <div className="flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 shrink-0">
            <span className="text-sm font-extrabold text-white tabular-nums leading-none">{scoreA}</span>
            <span className="text-slate-500 text-xs mx-0.5">×</span>
            <span className="text-sm font-extrabold text-white tabular-nums leading-none">{scoreB}</span>
          </div>
        )}
      </div>
    </button>
  );
}
