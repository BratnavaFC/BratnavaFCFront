import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PlayersApi, MatchesApi, PaymentsApi, PollsApi, CalendarApi } from '../api/endpoints';
import type { CalendarEvent } from '../types/calendar';
import { usePaymentStore, calcPendingPaymentsCount } from '../stores/paymentStore';
import { useAccountStore } from '../auth/accountStore';
import { getResponseMessage } from '../api/apiResponse';
import {
  Calendar, CalendarDays, History, LayoutDashboard, MapPin,
  RefreshCw, Clock, CheckCircle2, AlertCircle, DollarSign,
  ChevronRight, Vote, PartyPopper,
} from 'lucide-react';
import { useGroupIcons } from '../hooks/useGroupIcons';
import { IconRenderer } from '../components/IconRenderer';
import { resolveIcon } from '../lib/groupIcons';
import StatNumber from '../components/StatNumber';
import type { MatchHeaderDto } from '../domains/matches/matchTypes';

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
  team: number;
  inviteResponse: number;
};

type Goal = { goalId: string; scorerPlayerId: string; assistPlayerId?: string | null };
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
  computedMvps?: MatchMvp[] | null;
  goals?: Goal[];
};

interface DashPollSummary {
  id: string;
  title: string;
  status: 'open' | 'closed';
  deadlineDate?: string | null;
  deadlineTime?: string | null;
  totalVoters: number;
  hasVoted: boolean;
  type: 'poll' | 'event';
  eventDate?: string | null;
  eventTime?: string | null;
  eventLocation?: string | null;
  eventIcon?: string | null;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const normalizeHex = (hex?: string | null) => {
  const v = (hex ?? '').trim();
  if (!v) return null;
  return v.startsWith('#') ? v : `#${v}`;
};

function formatDate(playedAt?: string) {
  if (!playedAt) return null;
  const utcStr = playedAt.endsWith('Z') || playedAt.includes('+') ? playedAt : playedAt + 'Z';
  const d = new Date(utcStr);
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

function formatDeadline(date?: string | null, time?: string | null): string {
  if (!date) return '';
  const d = new Date(`${date}T${time ?? '23:59'}:00`);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function isDeadlinePassed(date?: string | null, time?: string | null): boolean {
  if (!date) return false;
  return new Date(`${date}T${time ?? '23:59'}:59`) < new Date();
}

function stepKeyColor(stepKey?: string) {
  switch (stepKey) {
    case 'playing':     return { bar: 'bg-blue-500',   badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800' };
    case 'post':        return { bar: 'bg-orange-400', badge: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800' };
    case 'matchmaking': return { bar: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800' };
    case 'acceptation': return { bar: 'bg-amber-400',  badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800' };
    default:            return { bar: 'bg-slate-300 dark:bg-slate-600', badge: 'bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700' };
  }
}

// ─── Small atoms ──────────────────────────────────────────────────────────────

function ColorDot({ hex, lg }: { hex?: string | null; lg?: boolean }) {
  const color = normalizeHex(hex);
  if (!color) return <span className={`inline-block rounded-full bg-slate-200 dark:bg-slate-700 shrink-0 ${lg ? 'h-5 w-5' : 'h-3.5 w-3.5'}`} />;
  const isWhite = color.toLowerCase() === '#ffffff';
  return (
    <span
      className={`inline-block rounded-full border shrink-0 ${lg ? 'h-5 w-5' : 'h-3.5 w-3.5'} ${isWhite ? 'border-slate-300 dark:border-slate-600 shadow-sm' : 'border-white/30'}`}
      style={{ backgroundColor: color }}
    />
  );
}

function SectionCard({
  icon, iconBg, iconColor, title, action, loading, children, className = '',
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  action?: { label: string; onClick: () => void };
  loading?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`card p-0 overflow-hidden shadow-sm ${className}`}>
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 flex items-center gap-2.5">
        <div className={`h-6 w-6 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
          <span className={iconColor}>{icon}</span>
        </div>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1 truncate">{title}</span>
        {loading && <RefreshCw size={12} className="animate-spin text-slate-400 shrink-0" />}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs transition hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
          >
            {action.label}
            <ChevronRight size={11} />
          </button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── UpcomingMatchRow ─────────────────────────────────────────────────────────

function UpcomingMatchRow({ match }: { match: MatchHeaderDto }) {
  const nav   = useNavigate();
  const dates = formatDate(match.playedAt);
  const isLive = match.stepKey === 'playing';
  const { bar, badge } = stepKeyColor(match.stepKey);

  return (
    <button
      type="button"
      onClick={() => nav('/app/matches')}
      className="w-full flex items-stretch text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all"
    >
      {/* Accent bar */}
      <div className={`w-1 shrink-0 ${bar}`} />

      {/* Date box */}
      <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/50 border-r border-slate-100 dark:border-slate-800 px-3 py-2.5 shrink-0 min-w-[52px]">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {dates?.month ?? '—'}
        </span>
        <span className="text-lg font-extrabold text-slate-800 dark:text-slate-100 leading-tight">
          {dates?.day ?? '—'}
        </span>
        {dates?.time && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{dates.time}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 px-3 py-2.5 flex flex-col justify-center gap-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isLive && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              Ao vivo
            </span>
          )}
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${badge}`}>
            {match.statusName}
          </span>
        </div>
        {match.placeName && (
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
            <MapPin size={10} className="shrink-0 text-slate-300 dark:text-slate-600" />
            {match.placeName}
          </p>
        )}
      </div>

      {/* Score or chevron */}
      <div className="flex items-center pr-3 shrink-0">
        {typeof match.teamAGoals === 'number' && typeof match.teamBGoals === 'number' ? (
          <div className="rounded-lg bg-slate-900 dark:bg-slate-700 px-2.5 py-1.5 text-center">
            <span className="text-sm font-extrabold text-white tabular-nums">
              {match.teamAGoals} <span className="text-slate-400 font-normal text-[10px]">×</span> {match.teamBGoals}
            </span>
          </div>
        ) : (
          <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />
        )}
      </div>
    </button>
  );
}

// ─── OpenPollRow ──────────────────────────────────────────────────────────────

function OpenPollRow({ poll }: { poll: DashPollSummary }) {
  const nav = useNavigate();
  const passed = isDeadlinePassed(poll.deadlineDate, poll.deadlineTime);

  return (
    <button
      type="button"
      onClick={() => nav('/app/polls')}
      className="w-full flex items-center gap-3 text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 hover:border-slate-300 dark:hover:border-slate-600 transition-all"
    >
      {/* Dot indicator */}
      <span className={`h-2 w-2 rounded-full shrink-0 ${poll.hasVoted ? 'bg-emerald-400' : 'bg-indigo-400'}`} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{poll.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-400">
            {poll.totalVoters} voto{poll.totalVoters !== 1 ? 's' : ''}
          </span>
          {poll.deadlineDate && !passed && (
            <span className="flex items-center gap-0.5 text-xs text-amber-500">
              <Clock size={9} />
              {formatDeadline(poll.deadlineDate, poll.deadlineTime)}
            </span>
          )}
          {poll.deadlineDate && passed && (
            <span className="text-xs text-rose-400">Prazo encerrado</span>
          )}
        </div>
      </div>

      {poll.hasVoted ? (
        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
          <CheckCircle2 size={13} /> Votei
        </span>
      ) : (
        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 shrink-0 flex items-center gap-0.5">
          Votar <ChevronRight size={12} />
        </span>
      )}
    </button>
  );
}

// ─── EventCarousel ────────────────────────────────────────────────────────────

function EventCarousel({ events, loading }: { events: CalendarEvent[]; loading: boolean }) {
  const nav = useNavigate();
  const [active, setActive] = useState(0);

  // Reset index when events change
  useEffect(() => { setActive(0); }, [events.length]);

  // Auto-advance every 5 seconds
  useEffect(() => {
    if (events.length <= 1) return;
    const id = setInterval(() => setActive(i => (i + 1) % events.length), 5000);
    return () => clearInterval(id);
  }, [events.length]);

  if (loading && events.length === 0) {
    return <div className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />;
  }

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-6 text-center">
        <PartyPopper size={20} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
        <p className="text-xs text-slate-400">Nenhum evento próximo</p>
      </div>
    );
  }

  const ev = events[active];
  const evDate = ev.date ? new Date(ev.date + 'T00:00:00') : null;
  const monthLabel = evDate?.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') ?? '—';
  const dayLabel   = evDate?.toLocaleDateString('pt-BR', { day:   '2-digit' }) ?? '—';
  const icon       = ev.icon ?? ev.categoryIcon ?? null;

  const borderColor = ev.categoryColor ? `${ev.categoryColor}50` : undefined;
  const bgColor     = ev.categoryColor ? `${ev.categoryColor}08` : undefined;

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={() => nav('/app/calendar')}
        className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-3 hover:border-slate-300 dark:hover:border-slate-600 transition-all"
        style={borderColor ? { borderColor, backgroundColor: bgColor } : undefined}
      >
        <div className="flex items-stretch gap-3">
          {/* Mini date box */}
          <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/60 rounded-lg px-2.5 py-2 shrink-0 min-w-[46px] border border-slate-100 dark:border-slate-700/50">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {monthLabel}
            </span>
            <span className="text-xl font-extrabold text-slate-800 dark:text-slate-100 leading-tight">
              {dayLabel}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2 leading-snug">
              {icon ? `${icon} ` : ''}{ev.title}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {!ev.timeTBD && ev.time && (
                <span className="flex items-center gap-0.5 text-xs text-slate-400">
                  <Clock size={9} className="shrink-0" />{ev.time.slice(0, 5)}
                </span>
              )}
              {ev.timeTBD && (
                <span className="text-xs text-slate-400">Horário a confirmar</span>
              )}
              {ev.categoryName && (
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                  style={ev.categoryColor ? {
                    color: ev.categoryColor,
                    borderColor: `${ev.categoryColor}40`,
                    backgroundColor: `${ev.categoryColor}12`,
                  } : undefined}
                >
                  {ev.categoryName}
                </span>
              )}
            </div>
            {ev.description && (
              <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{ev.description}</p>
            )}
          </div>
        </div>
      </button>

      {/* Dot indicators + counter */}
      {events.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {events.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Evento ${i + 1}`}
              className={`rounded-full transition-all duration-300 ${
                i === active
                  ? 'w-4 h-1.5 bg-violet-500'
                  : 'w-1.5 h-1.5 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── RecentMatchCard ──────────────────────────────────────────────────────────

function RecentMatchCard({ match, groupId }: { match: any; groupId: string }) {
  const nav   = useNavigate();
  const icons = useGroupIcons(groupId);

  const matchId    = match?.matchId;
  const dates      = formatDate(match?.playedAt);
  const scoreA     = match?.teamAGoals ?? null;
  const scoreB     = match?.teamBGoals ?? null;
  const hasScore   = typeof scoreA === 'number' && typeof scoreB === 'number';
  const playerTeam = match?.playerTeam as 1 | 2 | null;
  const teamAHex   = normalizeHex(match?.teamAColorHex);
  const teamAName  = match?.teamAColorName ?? 'Time A';
  const teamBHex   = normalizeHex(match?.teamBColorHex);
  const teamBName  = match?.teamBColorName ?? 'Time B';
  const myHex      = playerTeam === 1 ? teamAHex  : playerTeam === 2 ? teamBHex  : null;
  const myName     = playerTeam === 1 ? teamAName : playerTeam === 2 ? teamBName : null;
  const goals      = match?.playerGoals    as number ?? 0;
  const assists    = match?.playerAssists  as number ?? 0;
  const ownGoals   = match?.playerOwnGoals as number ?? 0;

  const outcome: 'win' | 'loss' | 'draw' | null = (() => {
    if (!hasScore || !playerTeam) return null;
    const mine = playerTeam === 1 ? scoreA : scoreB;
    const opp  = playerTeam === 1 ? scoreB : scoreA;
    if (mine > opp) return 'win';
    if (mine < opp) return 'loss';
    return 'draw';
  })();

  const OUTCOME = {
    win:  { label: 'Vitória', cls: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400' },
    loss: { label: 'Derrota', cls: 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-400' },
    draw: { label: 'Empate',  cls: 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-400' },
  } as const;

  return (
    <button
      className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden flex items-stretch hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all"
      onClick={() => nav(`/app/history/${groupId}/${matchId}`)}
    >
      <div className="w-1 shrink-0 bg-slate-200 dark:bg-slate-700" />
      <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/50 border-r border-slate-100 dark:border-slate-800 px-3 py-2.5 shrink-0 min-w-[52px]">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{dates?.month ?? '—'}</div>
        <div className="text-lg font-extrabold text-slate-800 dark:text-slate-100 leading-tight">{dates?.day ?? '—'}</div>
        {dates?.time && <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{dates.time}</div>}
      </div>
      <div className="flex flex-1 items-center gap-3 px-3 py-2.5 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {myHex || myName ? (
              <div className="flex items-center gap-1.5">
                {myHex && <ColorDot hex={myHex} />}
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{myName}</span>
              </div>
            ) : (teamAHex || teamBHex) ? (
              <div className="flex items-center gap-1">
                {teamAHex && <ColorDot hex={teamAHex} />}
                <span className="text-xs text-slate-300 dark:text-slate-600 font-bold">vs</span>
                {teamBHex && <ColorDot hex={teamBHex} />}
              </div>
            ) : null}
            {outcome && (
              <span className={`text-xs font-medium rounded-full border px-2 py-0.5 leading-none ${OUTCOME[outcome].cls}`}>
                {OUTCOME[outcome].label}
              </span>
            )}
            {goals > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <IconRenderer value={resolveIcon(icons, 'goal')} size={18} />
                <StatNumber value={goals} />
              </span>
            )}
            {assists > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <IconRenderer value={resolveIcon(icons, 'assist')} size={18} />
                <StatNumber value={assists} />
              </span>
            )}
            {ownGoals > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-red-500 font-medium">
                <IconRenderer value={resolveIcon(icons, 'ownGoal')} size={18} />
                <StatNumber value={ownGoals} />
              </span>
            )}
            {match?.isPlayerMvp && (
              <span className="flex items-center gap-1 text-xs text-amber-500 font-semibold">
                <IconRenderer value={resolveIcon(icons, 'mvp')} size={16} />
                MVP
              </span>
            )}
          </div>
        </div>
        {hasScore && (
          <div className="rounded-lg bg-slate-900 dark:bg-slate-700 px-2.5 py-1.5 shrink-0 text-center">
            <div className="text-sm font-extrabold text-white leading-none tabular-nums">
              {scoreA} <span className="text-slate-400 font-normal text-[10px]">×</span> {scoreB}
            </div>
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ rows = 1 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
      ))}
    </div>
  );
}

// ─── DashboardPage ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();
  const store  = useAccountStore();
  const active = store.getActive();
  const groupId         = active?.activeGroupId ?? null;
  const selectedPlayerId = active?.activePlayerId ?? '';

  const [myPlayers,    setMyPlayers]    = useState<MyPlayer[]>([]);

  // Upcoming matches
  const [upcomingMatches,  setUpcomingMatches]  = useState<MatchHeaderDto[]>([]);
  const [upcomingLoading,  setUpcomingLoading]  = useState(false);

  // Polls (open votes)
  const [polls,        setPolls]        = useState<DashPollSummary[]>([]);
  const [pollsLoading, setPollsLoading] = useState(false);

  // Calendar events (upcoming)
  const [events,        setEvents]        = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Recent matches
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  // Payment
  const [paymentSummary,        setPaymentSummary]        = useState<any>(null);
  const [paymentSummaryLoading, setPaymentSummaryLoading] = useState(false);
  const setPendingPaymentsCount = usePaymentStore((s) => s.setPendingPaymentsCount);

  const selectedPlayer = useMemo(
    () => myPlayers.find(p => p.playerId === selectedPlayerId),
    [myPlayers, selectedPlayerId],
  );

  // Derived: open polls (type poll, open status)
  const openPolls = useMemo(
    () => polls.filter(p => p.type === 'poll' && p.status === 'open'),
    [polls],
  );


  // ── loaders ────────────────────────────────────────────────────────────────

  async function loadPlayers() {
    if (!groupId) return;
    try {
      const res = await PlayersApi.mine();
      const all: any[] = res.data.data! ?? [];
      const filtered = all.filter(p => p.groupId === groupId) as MyPlayer[];
      setMyPlayers(filtered);
      const currentPlayerId = store.getActive()?.activePlayerId ?? '';
      if (filtered.length > 0 && !filtered.find(p => p.playerId === currentPlayerId)) {
        store.updateActive({ activePlayerId: filtered[0].playerId });
      }
    } catch (e) {
      toast.error(getResponseMessage(e, 'Falha ao carregar jogadores.'));
    }
  }

  async function loadUpcoming() {
    if (!groupId) return;
    setUpcomingLoading(true);
    try {
      const res = await MatchesApi.upcoming(groupId);
      const list = (res.data as any)?.data ?? res.data ?? [];
      setUpcomingMatches(Array.isArray(list) ? list : []);
    } catch (e: any) {
      if (e?.response?.status !== 404) {
        toast.error(getResponseMessage(e, 'Falha ao carregar partidas.'));
      }
      setUpcomingMatches([]);
    } finally {
      setUpcomingLoading(false);
    }
  }

  async function loadPolls() {
    if (!groupId) return;
    setPollsLoading(true);
    try {
      const res = await PollsApi.getPolls(groupId);
      const list = (res.data as any)?.data ?? res.data ?? [];
      setPolls(Array.isArray(list) ? list : []);
    } catch {
      setPolls([]);
    } finally {
      setPollsLoading(false);
    }
  }

  async function loadEvents() {
    if (!groupId) return;
    setEventsLoading(true);
    try {
      const now = new Date();
      const start = now.toISOString().slice(0, 10);
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + 4);
      const end = endDate.toISOString().slice(0, 10);
      const res = await CalendarApi.events(groupId, start, end);
      const list = ((res.data as any)?.data ?? res.data ?? []) as CalendarEvent[];
      const upcoming = list
        .filter(e => e.date >= start)
        .sort((a, b) => {
          const aKey = `${a.date}T${a.time ?? '00:00'}`;
          const bKey = `${b.date}T${b.time ?? '00:00'}`;
          return aKey.localeCompare(bKey);
        })
        .slice(0, 3);
      setEvents(upcoming);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }

  async function loadRecentMatches() {
    if (!groupId || !selectedPlayerId) return;
    setRecentLoading(true);
    setRecentMatches([]);
    try {
      const res = await MatchesApi.playerRecent(groupId, selectedPlayerId, 3);
      setRecentMatches(Array.isArray(res.data.data) ? res.data.data as any[] : []);
    } catch (e) {
      toast.error(getResponseMessage(e, 'Falha ao carregar histórico.'));
    } finally {
      setRecentLoading(false);
    }
  }

  async function loadPaymentSummary() {
    if (!groupId) return;
    setPaymentSummaryLoading(true);
    try {
      const res = await PaymentsApi.getMySummary(groupId);
      const summary = (res.data.data ?? null) as any;
      setPaymentSummary(summary);
      setPendingPaymentsCount(calcPendingPaymentsCount(summary));
    } catch {
      // best-effort
    } finally {
      setPaymentSummaryLoading(false);
    }
  }

  async function refreshAll() {
    await Promise.allSettled([loadUpcoming(), loadPolls(), loadEvents(), loadPaymentSummary()]);
  }

  useEffect(() => {
    loadPlayers();
    loadUpcoming();
    loadPolls();
    loadEvents();
    loadPaymentSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  useEffect(() => {
    loadRecentMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, selectedPlayerId]);

  // ── render ─────────────────────────────────────────────────────────────────

  const hasData = !!groupId;

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="page-header">
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="page-header-icon">
              <LayoutDashboard size={18} />
            </div>
            <div>
              <h1 className="text-xl font-black leading-tight">Dashboard</h1>
              <p className="text-xs text-white/60 mt-0.5">
                {selectedPlayer ? selectedPlayer.playerName : groupId ? 'Selecione um jogador' : 'Selecione um grupo'}
              </p>
            </div>
          </div>
          {hasData && (
            <button
              type="button"
              onClick={refreshAll}
              disabled={upcomingLoading || pollsLoading || eventsLoading}
              title="Atualizar tudo"
              className="h-8 w-8 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 flex items-center justify-center transition shrink-0 disabled:opacity-50"
            >
              <RefreshCw size={14} className={(upcomingLoading || pollsLoading || eventsLoading) ? 'animate-spin' : ''} />
            </button>
          )}
        </div>
      </div>

      {!hasData ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400">
          <LayoutDashboard size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Selecione uma patota no topo</p>
          <p className="text-xs mt-1 opacity-60">Os dados aparecerão aqui assim que uma patota for selecionada.</p>
        </div>
      ) : (
        <div className="space-y-4">

          {/* ── Layout grid desktop ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">

            {/* ── Próximas Partidas — 2/3 ── */}
            <div className="md:col-span-2">
              <SectionCard
                icon={<CalendarDays size={13} />}
                iconBg="bg-blue-500/10"
                iconColor="text-blue-600"
                title="Próximas Partidas"
                action={{ label: 'Ver tudo', onClick: () => navigate('/app/matches') }}
                loading={upcomingLoading}
              >
                {upcomingLoading && upcomingMatches.length === 0 ? (
                  <Skeleton rows={2} />
                ) : upcomingMatches.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-8 text-center">
                    <Calendar size={24} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Sem partidas em andamento</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      Crie uma partida na seção <b>Partidas</b>.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {upcomingMatches.map(m => (
                      <UpcomingMatchRow key={m.matchId} match={m} />
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>

            {/* ── Financeiro — 1/3 ── */}
            <div className="md:col-span-1">
              <SectionCard
                icon={<DollarSign size={13} />}
                iconBg="bg-emerald-500/10"
                iconColor="text-emerald-600"
                title="Financeiro"
                action={{ label: 'Ver', onClick: () => navigate('/app/payments') }}
                loading={paymentSummaryLoading}
              >
                {paymentSummaryLoading && !paymentSummary ? (
                  <div className="h-16 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                ) : !paymentSummary ? (
                  <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-3">Não disponível.</p>
                ) : paymentSummary.isUpToDate ? (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-3">
                    <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Em dia</p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400/80 mt-0.5">Sem pendências.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/20 px-3 py-3">
                    <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Pendências</p>
                      <div className="flex flex-col gap-0.5 mt-1">
                        {paymentSummary.hasPendingMonthly && (
                          <span className="text-xs text-amber-800 dark:text-amber-300">
                            {paymentSummary.pendingMonthsCount} {paymentSummary.pendingMonthsCount === 1 ? 'mensalidade' : 'mensalidades'}
                          </span>
                        )}
                        {paymentSummary.pendingExtraCharges?.length > 0 && (
                          <span className="text-xs text-amber-800 dark:text-amber-300">
                            {paymentSummary.pendingExtraCharges.length} {paymentSummary.pendingExtraCharges.length === 1 ? 'cobrança extra' : 'cobranças extras'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </SectionCard>
            </div>

            {/* ── Votações em aberto — expande para 3 cols se sem eventos ── */}
            {(pollsLoading || openPolls.length > 0) && (
              <div className={eventsLoading || events.length > 0 ? 'md:col-span-2' : 'md:col-span-3'}>
                <SectionCard
                  icon={<Vote size={13} />}
                  iconBg="bg-indigo-500/10"
                  iconColor="text-indigo-600"
                  title={`Votações${openPolls.length > 0 ? ` · ${openPolls.length}` : ''}`}
                  action={{ label: 'Ver tudo', onClick: () => navigate('/app/polls') }}
                  loading={pollsLoading}
                >
                  {pollsLoading && openPolls.length === 0 ? (
                    <Skeleton rows={2} />
                  ) : (
                    <div className="space-y-2">
                      {openPolls.map(p => (
                        <OpenPollRow key={p.id} poll={p} />
                      ))}
                    </div>
                  )}
                </SectionCard>
              </div>
            )}

            {/* ── Próximos Eventos — 1/3 on desktop ── */}
            {(eventsLoading || events.length > 0) && (
              <div className="md:col-span-1">
                <SectionCard
                  icon={<PartyPopper size={13} />}
                  iconBg="bg-violet-500/10"
                  iconColor="text-violet-600"
                  title="Próximos Eventos"
                  action={{ label: 'Calendário', onClick: () => navigate('/app/calendar') }}
                  loading={eventsLoading}
                >
                  <EventCarousel events={events} loading={eventsLoading} />
                </SectionCard>
              </div>
            )}

            {/* ── Caso especial: votações ocupa col-span-3 se não há eventos ── */}
            {/* Handled by col-span-2 above when events absent */}

            {/* ── Últimas Partidas — full width ── */}
            <div className="md:col-span-3">
              <SectionCard
                icon={<History size={13} />}
                iconBg="bg-violet-500/10"
                iconColor="text-violet-600"
                title={`Minhas últimas partidas${selectedPlayer ? ` · ${selectedPlayer.playerName}` : ''}`}
                loading={recentLoading}
              >
                {!selectedPlayerId ? (
                  <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">
                    Selecione um jogador para ver suas últimas partidas.
                  </p>
                ) : recentLoading ? (
                  <Skeleton rows={3} />
                ) : recentMatches.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-8 text-center">
                    <Calendar size={24} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Nenhuma partida encontrada</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">As últimas partidas do jogador aparecerão aqui.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentMatches.map(m => (
                      <RecentMatchCard key={m.matchId} match={m} groupId={groupId ?? ''} />
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
