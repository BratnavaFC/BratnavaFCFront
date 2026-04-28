import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
    Coins, Trophy, Target, TrendingUp, TrendingDown,
    Minus, Loader2, RefreshCw, Check, X, ChevronDown,
    History, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { BetApi, MatchesApi } from "../api/endpoints";
import { useAccountStore } from "../auth/accountStore";
import { isGroupAdmin } from "../auth/guards";
import { getResponseMessage } from "../api/apiResponse";
import type {
    CurrentMatchBetContextDto,
    BetLeaderboardEntryDto,
    SelectionForm,
    BetCategory,
    BetPlayer,
    MatchBetHistoryDto,
    BetPreviewDto,
    BetPreviewUserDto,
} from "../domains/bets/betTypes";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeamInfo { name: string; hex: string; }

interface BetSummary {
    winningTeam?: "TeamA" | "TeamB" | "Draw";
    finalScore?:  string;
    goals:        Record<string, number>; // matchPlayerId → count
    assists:      Record<string, number>;
}

function parseBetSummary(myBet: any): BetSummary {
    const summary: BetSummary = { goals: {}, assists: {} };
    if (!myBet?.selections) return summary;
    for (const sel of myBet.selections as any[]) {
        if (sel.category === "WinningTeam") {
            summary.winningTeam = sel.predictedValue as any;
        } else if (sel.category === "FinalScore") {
            summary.finalScore = sel.predictedValue;
        } else if (sel.category === "PlayerGoals") {
            const [id, n] = sel.predictedValue.split("|");
            summary.goals[id] = (summary.goals[id] ?? 0) + (parseInt(n) || 0);
        } else if (sel.category === "PlayerAssists") {
            const [id, n] = sel.predictedValue.split("|");
            summary.assists[id] = (summary.assists[id] ?? 0) + (parseInt(n) || 0);
        }
    }
    return summary;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<BetCategory, string> = {
    WinningTeam:   "Time vencedor",
    FinalScore:    "Placar final",
    PlayerGoals:   "Gols de jogador",
    PlayerAssists: "Assistências de jogador",
};

const CATEGORY_MULTIPLIERS: Record<string, string> = {
    WinningTeam:   "×1 (ou ×2.5 se Empate)",
    FinalScore:    "×4 (exato) | reembolso ±1 gol",
    PlayerGoals:   "×2.5 (exato) | reembolso ±1",
    PlayerAssists: "×2.5 (exato) | reembolso ±1",
};

const MAX_WAGER = 200;

function buildPredictedValue(sel: SelectionForm): string {
    switch (sel.category) {
        case "WinningTeam":   return sel.winTeam ?? "TeamA";
        case "FinalScore":    return `${sel.scoreA ?? 0}:${sel.scoreB ?? 0}`;
        case "PlayerGoals":
        case "PlayerAssists": return `${sel.playerMatchId ?? ""}|${sel.playerCount ?? 0}`;
    }
}

function selectionIsValid(sel: SelectionForm): boolean {
    if (sel.fichasWagered < 30) return false;
    switch (sel.category) {
        case "WinningTeam":   return !!sel.winTeam;
        case "FinalScore":    return sel.scoreA !== undefined && sel.scoreB !== undefined;
        case "PlayerGoals":
        case "PlayerAssists": return !!sel.playerMatchId;
    }
}

function formatValue(category: string, value: string | null | undefined): string {
    if (!value) return "–";
    if (category === "WinningTeam") {
        return value === "TeamA" ? "Time A" : value === "TeamB" ? "Time B" : "Empate";
    }
    if (category === "FinalScore") {
        return value.replace(":", " × ");
    }
    // PlayerGoals | PlayerAssists: "{matchPlayerId}|{count}"
    const parts = value.split("|");
    if (parts.length >= 2) {
        const n = parts[1];
        return category === "PlayerGoals"
            ? `${n} gol${n !== "1" ? "s" : ""}`
            : `${n} assist.`;
    }
    return value;
}

function resultIcon(isCorrect?: boolean | null, isPartial?: boolean | null) {
    if (isCorrect)            return <Check size={14} className="text-emerald-400" />;
    if (isPartial)            return <Minus size={14} className="text-amber-400" />;
    if (isCorrect === false)  return <X     size={14} className="text-red-400"  />;
    return null;
}

/** Retorna true quando o placar é compatível com o vencedor apostado. */
function scoreConsistentWithWinner(
    winTeam: "TeamA" | "TeamB" | "Draw" | undefined,
    scoreA:  number | undefined,
    scoreB:  number | undefined,
): boolean {
    if (!winTeam || scoreA === undefined || scoreB === undefined) return true;
    if (winTeam === "TeamA") return scoreA > scoreB;
    if (winTeam === "TeamB") return scoreB > scoreA;
    if (winTeam === "Draw")  return scoreA === scoreB;
    return true;
}

function fichasColor(v: number | null | undefined) {
    if (v == null) return "text-slate-400";
    if (v > 0)  return "text-emerald-400";
    if (v < 0)  return "text-red-400";
    return "text-amber-400";
}

function teamLabel(team: number) {
    if (team === 1) return "Time A";
    if (team === 2) return "Time B";
    return "Sem time";
}

// ── NumberStepper ─────────────────────────────────────────────────────────────

function NumberStepper({
    value, min, max, step = 1, disabled, onChange, size = "md",
}: {
    value: number;
    min: number;
    max: number;
    step?: number;
    disabled?: boolean;
    onChange: (v: number) => void;
    size?: "sm" | "md" | "lg";
}) {
    const [raw, setRaw] = useState(String(value));

    // Keep raw in sync when value changes externally (e.g. button clicks)
    useEffect(() => { setRaw(String(value)); }, [value]);

    const btnBase = "flex items-center justify-center rounded-lg font-bold select-none transition-colors active:scale-95 touch-manipulation";
    const sizeMap = {
        sm: { btn: "w-8 h-8 text-base",  inp: "w-12 text-sm font-bold py-1"   },
        md: { btn: "w-10 h-10 text-lg",  inp: "w-14 text-lg font-black py-1.5" },
        lg: { btn: "w-12 h-12 text-xl",  inp: "w-16 text-2xl font-black py-2"  },
    };
    const s = sizeMap[size];
    const dec = () => onChange(Math.max(min, value - step));
    const inc = () => onChange(Math.min(max, value + step));

    const commit = (str: string) => {
        const n = parseInt(str, 10);
        if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
        else setRaw(String(value));
    };

    return (
        <div className="flex items-center gap-1">
            <button type="button" onClick={dec} disabled={disabled || value <= min}
                className={[btnBase, s.btn,
                    "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200",
                    "hover:bg-slate-200 dark:hover:bg-slate-600",
                    "disabled:opacity-30 disabled:cursor-default",
                ].join(" ")}>−</button>
            <input
                type="number"
                inputMode="numeric"
                value={raw}
                disabled={disabled}
                onChange={(e) => setRaw(e.target.value)}
                onBlur={(e) => commit(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && commit(raw)}
                className={[
                    s.inp,
                    "text-center tabular-nums rounded-lg border border-slate-200 dark:border-slate-600",
                    "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100",
                    "focus:outline-none focus:ring-2 focus:ring-slate-400",
                    "disabled:opacity-40 disabled:cursor-default",
                    "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                ].join(" ")}
            />
            <button type="button" onClick={inc} disabled={disabled || value >= max}
                className={[btnBase, s.btn,
                    "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200",
                    "hover:bg-slate-200 dark:hover:bg-slate-600",
                    "disabled:opacity-30 disabled:cursor-default",
                ].join(" ")}>+</button>
        </div>
    );
}

// ── SelectionCard ─────────────────────────────────────────────────────────────

function SelectionCard({
    sel, index, players, onUpdate, onRemove, canRemove, teamA, teamB, locked, winnerHint,
}: {
    sel: SelectionForm;
    index: number;
    players: BetPlayer[];
    onUpdate: (updated: SelectionForm) => void;
    onRemove: () => void;
    canRemove: boolean;
    teamA?: TeamInfo;
    teamB?: TeamInfo;
    locked?: boolean;
    /** Aposta de vencedor atual (para validação cruzada com FinalScore) */
    winnerHint?: "TeamA" | "TeamB" | "Draw";
}) {
    const isObrigatorio = sel.category === "WinningTeam";

    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-black tracking-wider text-slate-400">#{index + 1}</span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {CATEGORY_LABELS[sel.category]}
                    </span>
                    {isObrigatorio && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
                            obrigatório
                        </span>
                    )}
                </div>
                {canRemove && !isObrigatorio && (
                    <button type="button" onClick={onRemove}
                        className="text-slate-400 hover:text-red-400 transition-colors">
                        <X size={16} />
                    </button>
                )}
            </div>

            <p className="text-[11px] text-slate-400">{CATEGORY_MULTIPLIERS[sel.category]}</p>

            {sel.category === "WinningTeam" && (
                <div className="grid grid-cols-3 gap-2">
                    {(["TeamA", "Draw", "TeamB"] as const).map((opt) => {
                        const info   = opt === "TeamA" ? teamA : opt === "TeamB" ? teamB : undefined;
                        const label  = opt === "TeamA" ? (teamA?.name ?? "Time A")
                                     : opt === "TeamB" ? (teamB?.name ?? "Time B")
                                     : "Empate";
                        const active = sel.winTeam === opt;
                        return (
                            <button key={opt} type="button"
                                onClick={() => !locked && onUpdate({ ...sel, winTeam: opt })}
                                disabled={locked && !active}
                                style={active && info ? { background: info.hex, borderColor: info.hex, color: "#fff" } : undefined}
                                className={[
                                    "py-2 rounded-xl text-sm font-semibold border transition-all flex items-center justify-center gap-1.5",
                                    locked && !active ? "opacity-30 cursor-default" : "",
                                    active && !info
                                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent"
                                        : !active
                                            ? "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"
                                            : "",
                                ].join(" ")}>
                                {info && !active && (
                                    <span className="inline-block w-2 h-2 rounded-full shrink-0"
                                        style={{ background: info.hex }} />
                                )}
                                {label}
                            </button>
                        );
                    })}
                </div>
            )}

            {sel.category === "FinalScore" && (
                <>
                    <div className="flex items-center gap-3">
                        <div className="flex-1">
                            <label className="text-[10px] font-medium uppercase tracking-wide flex items-center gap-1"
                                style={{ color: teamA?.hex ?? undefined }}>
                                {teamA ? <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: teamA.hex }} /> : null}
                                {teamA?.name ?? "Time A"}
                            </label>
                            <div className="mt-1 flex justify-center">
                                <NumberStepper value={sel.scoreA ?? 0} min={0} max={20} disabled={locked}
                                    onChange={(v) => onUpdate({ ...sel, scoreA: v })} size="lg" />
                            </div>
                        </div>
                        <span className="text-xl font-black text-slate-400 mt-5">×</span>
                        <div className="flex-1">
                            <label className="text-[10px] font-medium uppercase tracking-wide flex items-center gap-1"
                                style={{ color: teamB?.hex ?? undefined }}>
                                {teamB ? <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: teamB.hex }} /> : null}
                                {teamB?.name ?? "Time B"}
                            </label>
                            <div className="mt-1 flex justify-center">
                                <NumberStepper value={sel.scoreB ?? 0} min={0} max={20} disabled={locked}
                                    onChange={(v) => onUpdate({ ...sel, scoreB: v })} size="lg" />
                            </div>
                        </div>
                    </div>
                    {winnerHint && !scoreConsistentWithWinner(winnerHint, sel.scoreA, sel.scoreB) && (
                        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mt-1">
                            <span>⚠️</span>
                            {winnerHint === "Draw"
                                ? "Placar inconsistente: empate exige gols iguais."
                                : `Placar inconsistente: ${winnerHint === "TeamA" ? (teamA?.name ?? "Time A") : (teamB?.name ?? "Time B")} precisa ter mais gols.`}
                        </p>
                    )}
                </>
            )}

            {(sel.category === "PlayerGoals" || sel.category === "PlayerAssists") && (
                <div className="space-y-2">
                    <select
                        value={sel.playerMatchId ?? ""}
                        disabled={locked}
                        onChange={(e) => onUpdate({ ...sel, playerMatchId: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-60 disabled:cursor-default">
                        <option value="">Selecione um jogador…</option>
                        {players.filter((p) => p.team !== 0).map((p) => (
                            <option key={p.matchPlayerId} value={p.matchPlayerId}>
                                {p.name} ({p.team === 1 ? (teamA?.name ?? "Time A") : (teamB?.name ?? "Time B")})
                            </option>
                        ))}
                    </select>
                    <div className="flex items-center gap-3">
                        <label className="text-xs text-slate-500 whitespace-nowrap">
                            {sel.category === "PlayerGoals" ? "Gols previstos:" : "Assistências previstas:"}
                        </label>
                        <NumberStepper value={sel.playerCount ?? 0} min={0} max={20} disabled={locked}
                            onChange={(v) => onUpdate({ ...sel, playerCount: v })} size="sm" />
                    </div>
                </div>
            )}

            <div className="flex items-center gap-3 pt-1 border-t border-slate-100 dark:border-slate-700">
                <Coins size={14} className="text-amber-400 shrink-0" />
                <label className="text-xs text-slate-500">Bratnava Coins:</label>
                <NumberStepper value={sel.fichasWagered} min={30} max={MAX_WAGER} step={10} disabled={locked}
                    onChange={(v) => onUpdate({ ...sel, fichasWagered: v })} size="sm" />
            </div>
        </div>
    );
}

// ── Painel de parcial (todos os usuários) ────────────────────────────────────

function BetPreviewPanel({
    groupId,
    matchId,
    admin,
    players,
}: {
    groupId: string;
    matchId: string;
    admin: boolean;
    players: BetPlayer[];
}) {
    const myUserId = useAccountStore(s => s.accounts.find(a => a.userId === s.activeAccountId)?.userId);
    const [preview,      setPreview]      = useState<BetPreviewDto | null>(null);
    const [loading,      setLoading]      = useState(false);
    const [expanded,     setExpanded]     = useState<Set<string>>(new Set());
    const [open,         setOpen]         = useState(true);
    // null = visão do admin (expande tudo); string = impersona esse usuário
    const [viewAsUserId, setViewAsUserId] = useState<string | null>(null);

    const playerNameByMpId = Object.fromEntries(players.map((p) => [p.matchPlayerId, p.name]));

    /**
     * Regra de expansão:
     *  - Admin sem "ver como": expande qualquer linha
     *  - Admin em modo "ver como": expande só a linha do jogador selecionado
     *  - Usuário comum: expande só a própria linha
     */
    function canExpand(userId: string): boolean {
        if (admin) return viewAsUserId === null ? true : userId === viewAsUserId;
        return userId === myUserId;
    }

    /** Quem recebe o rótulo "(você)" */
    function isViewAsMe(userId: string): boolean {
        if (admin && viewAsUserId !== null) return userId === viewAsUserId;
        return userId === myUserId;
    }

    function toggleUser(userId: string) {
        if (!canExpand(userId)) return;
        setExpanded((prev) => {
            const next = new Set(prev);
            next.has(userId) ? next.delete(userId) : next.add(userId);
            return next;
        });
    }

    async function load() {
        setLoading(true);
        try {
            const res = await BetApi.getPreview(groupId, matchId);
            setPreview((res.data as any) as BetPreviewDto);
            setOpen(true);
        } catch {
            // silently ignore: sem partida atual ou sem apostas
        } finally {
            setLoading(false);
        }
    }

    // Carrega automaticamente na montagem
    useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    /** Formata o valor mostrando o nome do jogador quando disponível. */
    function formatPreviewValue(category: string, value: string | null | undefined): string {
        if (!value) return "–";
        if (category === "WinningTeam") return value === "TeamA" ? "Time A" : value === "TeamB" ? "Time B" : "Empate";
        if (category === "FinalScore")  return value.replace(":", " × ");
        const parts = value.split("|");
        if (parts.length >= 2) {
            const name  = playerNameByMpId[parts[0]] ?? "Jogador";
            const count = parts[1];
            return category === "PlayerGoals"
                ? `${name} — ${count} gol${count !== "1" ? "s" : ""}`
                : `${name} — ${count} assist.`;
        }
        return value;
    }

    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Header / toggle */}
            <div className="flex items-center gap-2 px-4 py-3">
                <Eye size={15} className="text-indigo-400 shrink-0" />
                <span className="flex-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Como vai ficar — parcial
                </span>

                {/* Seletor "Ver como" — visível apenas para admins quando há bettors */}
                {admin && preview && preview.userBets.length > 0 && (
                    <select
                        value={viewAsUserId ?? ""}
                        onChange={(e) => {
                            setViewAsUserId(e.target.value || null);
                            setExpanded(new Set()); // colapsa tudo ao trocar perspectiva
                        }}
                        className="text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                        <option value="">👁️ Admin (todos)</option>
                        {preview.userBets.map((u) => (
                            <option key={u.userId} value={u.userId}>{u.userName}</option>
                        ))}
                    </select>
                )}

                {/* Botão colapsar/expandir painel */}
                <button
                    type="button"
                    onClick={() => { if (!preview && !loading) load(); else setOpen((o) => !o); }}
                    disabled={loading}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                    {loading
                        ? <Loader2 size={14} className="animate-spin" />
                        : preview
                            ? <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                            : <RefreshCw size={13} />
                    }
                </button>

                {/* Atualizar */}
                {preview && (
                    <button type="button" onClick={load} disabled={loading}
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                    </button>
                )}
            </div>

            {open && preview && (
                <div className="border-t border-slate-100 dark:border-slate-700">
                    {/* Score badge */}
                    <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-800/40">
                        <span className="text-xs text-slate-500">
                            Placar atual:{" "}
                            <span className="font-black text-slate-800 dark:text-white">
                                {preview.currentScoreA} × {preview.currentScoreB}
                            </span>
                        </span>
                        {admin && viewAsUserId !== null && (
                            <span className="text-xs text-indigo-400 font-medium">
                                Visão de: {preview.userBets.find(u => u.userId === viewAsUserId)?.userName}
                            </span>
                        )}
                    </div>

                    {preview.userBets.length === 0 ? (
                        <div className="px-4 py-8 text-center text-slate-400 text-sm">
                            Nenhuma aposta registrada ainda.
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {preview.userBets.map((userBet: BetPreviewUserDto, rank: number) => {
                                const isOpen      = expanded.has(userBet.userId);
                                const expandable  = canExpand(userBet.userId);
                                const isMe        = isViewAsMe(userBet.userId);
                                const betNet      = userBet.simulatedBetEarnings;
                                const total       = userBet.simulatedTotal;
                                const correctCnt  = userBet.selections.filter((s) => s.isCorrect).length;
                                const partialCnt  = userBet.selections.filter((s) => s.isPartialCredit).length;

                                return (
                                    <div key={userBet.userId}>
                                        <div
                                            role={expandable ? "button" : undefined}
                                            tabIndex={expandable ? 0 : undefined}
                                            onClick={expandable ? () => toggleUser(userBet.userId) : undefined}
                                            onKeyDown={expandable ? (e) => e.key === "Enter" && toggleUser(userBet.userId) : undefined}
                                            className={[
                                                "flex items-center gap-3 px-4 py-3",
                                                isMe ? "bg-indigo-50/50 dark:bg-indigo-900/10" : "",
                                                expandable ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors" : "",
                                            ].filter(Boolean).join(" ")}>
                                            {/* Rank */}
                                            <span className="text-sm w-6 text-center shrink-0">
                                                {rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : `${rank + 1}º`}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                                                    {userBet.userName}
                                                    {isMe && <span className="text-xs font-normal text-slate-400 ml-1">(você)</span>}
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    {userBet.selections.length} seleç{userBet.selections.length !== 1 ? "ões" : "ão"}
                                                    {" · "}{correctCnt} acerto{correctCnt !== 1 ? "s" : ""}
                                                    {partialCnt > 0 && ` · ${partialCnt} parcial`}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0 mr-1">
                                                <div className={`flex items-center gap-1 font-bold text-sm justify-end ${fichasColor(betNet)}`}>
                                                    {betNet > 0 ? <TrendingUp size={13} /> : betNet < 0 ? <TrendingDown size={13} /> : <Minus size={13} />}
                                                    {betNet > 0 ? "+" : ""}{betNet}
                                                </div>
                                                <p className="text-xs text-slate-400">Total +{total}</p>
                                            </div>
                                            {expandable && (
                                                <ChevronDown size={14} className={`text-slate-400 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`} />
                                            )}
                                        </div>

                                        {expandable && isOpen && (
                                            <div className="bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-700/50 divide-y divide-slate-100 dark:divide-slate-700/30">
                                                {userBet.selections.map((sel) => (
                                                    <div key={sel.id} className="flex items-start gap-3 px-5 py-2.5">
                                                        <div className="mt-0.5 w-4 flex justify-center shrink-0">
                                                            {resultIcon(sel.isCorrect, sel.isPartialCredit)}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                                {CATEGORY_LABELS[sel.category as BetCategory] ?? sel.category}
                                                            </p>
                                                            <p className="text-xs text-slate-400 mt-0.5">
                                                                Apostou:{" "}
                                                                <span className="font-medium text-slate-600 dark:text-slate-300">
                                                                    {formatPreviewValue(sel.category, sel.predictedValue)}
                                                                </span>
                                                                {sel.actualValue && (
                                                                    <>
                                                                        {" "}· Agora:{" "}
                                                                        <span className="font-medium text-slate-600 dark:text-slate-300">
                                                                            {formatPreviewValue(sel.category, sel.actualValue)}
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </p>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <p className="text-xs text-slate-400">{sel.fichasWagered} BC</p>
                                                            <p className={`text-xs font-bold ${fichasColor(sel.fichasEarned)}`}>
                                                                {sel.fichasEarned != null
                                                                    ? (sel.fichasEarned > 0 ? "+" : "") + sel.fichasEarned
                                                                    : "–"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                                {/* Base reward */}
                                                <div className="flex items-center justify-between px-5 py-2 bg-white/50 dark:bg-slate-900/20">
                                                    <span className="text-xs text-slate-400">Base por participação</span>
                                                    <span className="text-xs font-bold text-emerald-500">+200</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Tab: Aposta Atual ─────────────────────────────────────────────────────────

function CurrentBetTab({ groupId }: { groupId: string }) {
    const [ctx,        setCtx]        = useState<CurrentMatchBetContextDto | null>(null);
    const [loading,    setLoading]    = useState(true);
    const [saving,        setSaving]        = useState(false);
    const [deleting,      setDeleting]      = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [showBetStatus, setShowBetStatus] = useState(false);
    const [balance,    setBalance]    = useState<number | null>(null);
    const [teamA,      setTeamA]      = useState<TeamInfo | undefined>();
    const [teamB,      setTeamB]      = useState<TeamInfo | undefined>();
    const [selections, setSelections] = useState<SelectionForm[]>([
        { category: "WinningTeam", predictedValue: "", fichasWagered: 50, winTeam: undefined },
    ]);

    async function load() {
        setLoading(true);

        const [balResult, ctxResult] = await Promise.allSettled([
            BetApi.getMyBalance(groupId),
            BetApi.getCurrentContext(groupId),
        ]);

        if (balResult.status === "fulfilled") {
            setBalance((balResult.value.data as any).balance ?? 0);
        }

        if (ctxResult.status === "fulfilled") {
            const context = (ctxResult.value.data as any) as CurrentMatchBetContextDto;
            setCtx(context);

            // Buscar cores/nomes dos times para a partida atual
            try {
                const detRes = await MatchesApi.details(groupId, context.matchId);
                const det    = (detRes.data as any)?.data ?? detRes.data;
                if (det?.teamAColor?.name) setTeamA({ name: det.teamAColor.name, hex: det.teamAColor.hexValue ?? "#0f172a" });
                if (det?.teamBColor?.name) setTeamB({ name: det.teamBColor.name, hex: det.teamBColor.hexValue ?? "#0f172a" });
            } catch { /* sem cores definidas */ }

            if (context?.myBet?.selections?.length) {
                const sels: SelectionForm[] = context.myBet.selections.map((s: any) => {
                    const base: SelectionForm = {
                        category:       s.category as BetCategory,
                        predictedValue: s.predictedValue,
                        fichasWagered:  s.fichasWagered,
                    };
                    if (s.category === "WinningTeam") {
                        base.winTeam = s.predictedValue as any;
                    } else if (s.category === "FinalScore") {
                        const parts = s.predictedValue.split(":");
                        base.scoreA = parseInt(parts[0]) || 0;
                        base.scoreB = parseInt(parts[1]) || 0;
                    } else {
                        const parts = s.predictedValue.split("|");
                        base.playerMatchId = parts[0];
                        base.playerCount   = parseInt(parts[1]) || 0;
                    }
                    return base;
                });
                setSelections(sels);
            }
        } else {
            const err = (ctxResult as PromiseRejectedResult).reason;
            if (err?.response?.status !== 404) {
                toast.error(getResponseMessage(err, "Falha ao carregar contexto de apostas."));
            }
            setCtx(null);
        }

        setLoading(false);
    }

    useEffect(() => { load(); }, [groupId]);

    function addCategory(cat: BetCategory) {
        if (selections.length >= 5) return;
        // WinningTeam e FinalScore só podem aparecer uma vez
        if ((cat === "WinningTeam" || cat === "FinalScore") && selections.some((s) => s.category === cat)) return;
        setSelections((prev) => [
            ...prev,
            { category: cat, predictedValue: "", fichasWagered: 30, winTeam: undefined },
        ]);
    }

    function removeSelection(i: number) {
        setSelections((prev) => prev.filter((_, idx) => idx !== i));
    }

    function updateSelection(i: number, updated: SelectionForm) {
        setSelections((prev) => prev.map((s, idx) => idx === i ? updated : s));
    }

    async function handleSubmit() {
        const invalid = selections.find((s) => !selectionIsValid(s));
        if (invalid) {
            toast.error(`Seleção incompleta: ${CATEGORY_LABELS[invalid.category]}`);
            return;
        }

        const total = selections.reduce((s, sel) => s + sel.fichasWagered, 0);
        if (total > MAX_WAGER) {
            toast.error(`Máximo ${MAX_WAGER} Bratnava Coins por partida. Total atual: ${total}`);
            return;
        }

        // Validação cruzada: placar deve ser consistente com vencedor
        const winSel   = selections.find((s) => s.category === "WinningTeam");
        const scoreSel = selections.find((s) => s.category === "FinalScore");
        if (winSel && scoreSel && !scoreConsistentWithWinner(winSel.winTeam, scoreSel.scoreA, scoreSel.scoreB)) {
            toast.error("O placar apostado é incompatível com o time vencedor escolhido.");
            return;
        }

        const dto = {
            selections: selections.map((s) => ({
                category:       s.category,
                predictedValue: buildPredictedValue(s),
                fichasWagered:  s.fichasWagered,
            })),
        };

        setSaving(true);
        try {
            await BetApi.placeOrUpdateBet(groupId, ctx!.matchId, dto);
            toast.success("Aposta registrada!");
            load();
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao salvar aposta."));
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        if (!ctx) return;
        setDeleting(true);
        try {
            await BetApi.deleteBet(groupId, ctx.matchId);
            toast.success("Aposta removida.");
            setConfirmDelete(false);
            setSelections([{ category: "WinningTeam", predictedValue: "", fichasWagered: 50, winTeam: undefined }]);
            load();
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao remover aposta."));
        } finally {
            setDeleting(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 size={28} className="animate-spin text-slate-400" />
            </div>
        );
    }

    if (!ctx) {
        return (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400">
                <Target size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Nenhuma partida em andamento</p>
                <p className="text-xs mt-1 opacity-60">As apostas ficam disponíveis durante o matchmaking.</p>
            </div>
        );
    }

    const adminOfGroup  = isGroupAdmin(groupId);
    const isLocked      = !ctx.betWindowOpen;
    const totalWager    = selections.reduce((s, sel) => s + sel.fichasWagered, 0);
    const overMax       = totalWager > MAX_WAGER;
    const canAddMore    = selections.length < 5;
    const availableCats = (["FinalScore", "PlayerGoals", "PlayerAssists"] as BetCategory[])
        .filter((c) => {
            // FinalScore: só uma entrada
            if (c === "FinalScore") return !selections.some((s) => s.category === c);
            // PlayerGoals / PlayerAssists: pode adicionar mais enquanto houver slots
            return true;
        });

    return (
        <div className="space-y-5">
            {/* Toggle: status das apostas dos jogadores */}
            {(() => {
                // Apenas mensalistas entram na contagem/lista de apostas pendentes
                const members  = ctx.players.filter((p) => !p.isGuest);
                const total    = members.length;
                const betCount = members.filter((p) => p.hasBet).length;
                return (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setShowBetStatus((v) => !v)}
                            className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="text-left">
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                    {betCount} de {total} jogador{total !== 1 ? "es" : ""} já {betCount !== 1 ? "fizeram" : "fez"} sua aposta
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {new Date(ctx.playedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                                    {" · "}{ctx.statusName}
                                </p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <div className="text-right">
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">Saldo</p>
                                    <div className={`flex items-center gap-1 font-bold text-sm ${fichasColor(balance)}`}>
                                        <Coins size={13} className="text-amber-400" />
                                        {balance?.toLocaleString() ?? "–"}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); load(); }}
                                    disabled={loading}
                                    title="Atualizar lista de jogadores"
                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors disabled:opacity-40">
                                    <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                                </button>
                                <ChevronDown size={16} className={`text-slate-400 transition-transform ${showBetStatus ? "rotate-180" : ""}`} />
                            </div>
                        </button>

                        {showBetStatus && (
                            <div className="border-t border-slate-100 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/50">
                                {members.map((p) => (
                                    <div key={p.matchPlayerId} className="flex items-center justify-between px-4 py-2.5">
                                        <span className="text-sm text-slate-700 dark:text-slate-300">{p.name}</span>
                                        {p.hasBet
                                            ? (
                                                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
                                                    <Check size={13} />
                                                    Apostou
                                                    {p.totalFichasWagered != null && (
                                                        <span className="text-emerald-400/80 font-normal">
                                                            · {p.totalFichasWagered} BC
                                                        </span>
                                                    )}
                                                </span>
                                            )
                                            : <span className="text-xs text-slate-400">Aguardando…</span>
                                        }
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })()}

            {isLocked && (
                <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-4 text-center">
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                        Janela de apostas encerrada
                    </p>
                    <p className="text-xs text-amber-600/70 dark:text-amber-500/70 mt-0.5">
                        As apostas só podem ser feitas durante o matchmaking.
                    </p>
                </div>
            )}

            {isLocked && !ctx.myBet && (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center text-slate-400">
                    <p className="text-sm">Você não fez uma aposta nesta partida.</p>
                </div>
            )}

            {/* Escalação + resumo de apostas */}
            {ctx.players.some((p) => p.team !== 0) && (() => {
                const summary = parseBetSummary(ctx.myBet);
                const winA    = summary.winningTeam === "TeamA";
                const winB    = summary.winningTeam === "TeamB";
                const isDraw  = summary.winningTeam === "Draw";

                return (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        {/* Headers dos times */}
                        <div className="grid grid-cols-2">
                            <div className="px-3 py-2 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white"
                                style={{ background: teamA?.hex ?? "#334155" }}>
                                {teamA?.name ?? "Time A"}
                                {(winA || isDraw) && ctx.myBet && (
                                    <span className="text-[10px] font-black bg-white/20 px-1.5 py-0.5 rounded-full">
                                        {isDraw ? "EMPATE" : "✓ VITÓRIA"}
                                    </span>
                                )}
                            </div>
                            <div className="px-3 py-2 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white border-l border-white/20"
                                style={{ background: teamB?.hex ?? "#334155" }}>
                                {teamB?.name ?? "Time B"}
                                {(winB || isDraw) && ctx.myBet && (
                                    <span className="text-[10px] font-black bg-white/20 px-1.5 py-0.5 rounded-full">
                                        {isDraw ? "EMPATE" : "✓ VITÓRIA"}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Placar previsto */}
                        {summary.finalScore && (
                            <div className="text-center text-[11px] text-slate-500 dark:text-slate-400 py-1 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                                Placar previsto: <span className="font-bold text-slate-700 dark:text-slate-200">{summary.finalScore.replace(":", " × ")}</span>
                            </div>
                        )}

                        {/* Jogadores */}
                        <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-700">
                            <div className="py-1">
                                {ctx.players.filter((p) => p.team === 1).map((p) => {
                                    const g = summary.goals[p.matchPlayerId];
                                    const a = summary.assists[p.matchPlayerId];
                                    return (
                                        <div key={p.matchPlayerId} className="flex items-center justify-between px-3 py-1 gap-2">
                                            <span className="text-xs text-slate-700 dark:text-slate-300 truncate">{p.name}</span>
                                            {(g || a) ? (
                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0 whitespace-nowrap">
                                                    {g ? `${g}⚽` : ""}{a ? ` ${a}🅰️` : ""}
                                                </span>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="py-1">
                                {ctx.players.filter((p) => p.team === 2).map((p) => {
                                    const g = summary.goals[p.matchPlayerId];
                                    const a = summary.assists[p.matchPlayerId];
                                    return (
                                        <div key={p.matchPlayerId} className="flex items-center justify-between px-3 py-1 gap-2">
                                            <span className="text-xs text-slate-700 dark:text-slate-300 truncate">{p.name}</span>
                                            {(g || a) ? (
                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0 whitespace-nowrap">
                                                    {g ? `${g}⚽` : ""}{a ? ` ${a}🅰️` : ""}
                                                </span>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Seleções (form ou somente leitura) */}
            {(ctx.myBet || !isLocked) && (
                <div className="space-y-3">
                    {selections.map((sel, i) => {
                        const winSel = selections.find((s) => s.category === "WinningTeam");
                        return (
                            <SelectionCard
                                key={i}
                                sel={sel}
                                index={i}
                                players={ctx.players}
                                onUpdate={(updated) => updateSelection(i, updated)}
                                onRemove={() => removeSelection(i)}
                                canRemove={!isLocked}
                                locked={isLocked}
                                teamA={teamA}
                                teamB={teamB}
                                winnerHint={sel.category === "FinalScore" ? winSel?.winTeam : undefined}
                            />
                        );
                    })}
                </div>
            )}

            {/* Add category */}
            {!isLocked && canAddMore && availableCats.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {availableCats.map((cat) => (
                        <button key={cat} type="button" onClick={() => addCategory(cat)}
                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-all">
                            + {CATEGORY_LABELS[cat]}
                        </button>
                    ))}
                </div>
            )}

            {/* Parcial das apostas durante matchmaking — exclusivo para admin */}
            {adminOfGroup && (
                <BetPreviewPanel
                    groupId={groupId}
                    matchId={ctx.matchId}
                    admin={adminOfGroup}
                    players={ctx.players}
                />
            )}

            {/* Total + submit */}
            {!isLocked && (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-500">
                            Total:{" "}
                            <span className={`font-bold ${overMax ? "text-red-500" : "text-slate-800 dark:text-slate-100"}`}>
                                {totalWager}/{MAX_WAGER} BC
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {ctx.myBet && (
                                confirmDelete ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-red-500 dark:text-red-400 font-medium">Resetar tudo?</span>
                                        <button type="button" onClick={() => setConfirmDelete(false)}
                                            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                                            Não
                                        </button>
                                        <button type="button" onClick={handleDelete} disabled={deleting}
                                            className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all disabled:opacity-50">
                                            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                            Sim, resetar
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setConfirmDelete(true)}
                                        className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                                        <X size={14} /> Resetar apostas
                                    </button>
                                )
                            )}
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={saving || overMax}
                                className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold px-5 py-2 rounded-xl transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
                                {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                                {ctx.myBet ? "Atualizar aposta" : "Confirmar aposta"}
                            </button>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}

// ── Tab: Histórico ────────────────────────────────────────────────────────────

function HistoryTab({ groupId }: { groupId: string }) {
    const [history,       setHistory]       = useState<MatchBetHistoryDto[]>([]);
    const [leaderboard,   setLeaderboard]   = useState<BetLeaderboardEntryDto[]>([]);
    const [loading,       setLoading]       = useState(true);
    const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
    const [expandedUser,  setExpandedUser]  = useState<string | null>(null);

    const myUserId = useAccountStore(
        (s) => s.accounts.find((a) => a.userId === s.activeAccountId)?.userId
    );

    async function load() {
        setLoading(true);
        try {
            const [histRes, lbRes] = await Promise.all([
                BetApi.getHistory(groupId),
                BetApi.getLeaderboard(groupId),
            ]);
            setHistory((histRes.data as any) as MatchBetHistoryDto[]);
            setLeaderboard((lbRes.data as any) as BetLeaderboardEntryDto[]);
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao carregar histórico."));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, [groupId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 size={28} className="animate-spin text-slate-400" />
            </div>
        );
    }

    const myEntry = leaderboard.find((e) => e.userId === myUserId);

    return (
        <div className="space-y-5">
            {/* My balance + rank */}
            {myEntry && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Seu saldo</p>
                        <div className={`flex items-center gap-1.5 font-black text-xl mt-0.5 ${fichasColor(myEntry.balance)}`}>
                            <Coins size={16} className="text-amber-400" />
                            {myEntry.balance > 0 ? "+" : ""}{myEntry.balance.toLocaleString()}
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Posição</p>
                        <p className="text-xl font-black text-slate-800 dark:text-slate-100 mt-0.5">
                            {myEntry.rank <= 3
                                ? ["🥇", "🥈", "🥉"][myEntry.rank - 1]
                                : `${myEntry.rank}º`}
                        </p>
                    </div>
                </div>
            )}

            {/* Match history list */}
            {history.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400">
                    <History size={36} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">Nenhuma partida finalizada</p>
                    <p className="text-xs mt-1 opacity-60">O histórico aparece após partidas serem finalizadas.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {history.map((match) => {
                        const isMatchOpen = expandedMatch === match.matchId;
                        const matchDate   = new Date(match.playedAt).toLocaleDateString("pt-BR", {
                            day: "2-digit", month: "short", year: "numeric",
                        });

                        return (
                            <div key={match.matchId}
                                className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                {/* Match header */}
                                <button type="button"
                                    onClick={() => setExpandedMatch(isMatchOpen ? null : match.matchId)}
                                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{matchDate}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            {match.userBets.length} aposta{match.userBets.length !== 1 ? "s" : ""}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-base font-black text-slate-800 dark:text-slate-100">
                                            {match.teamAGoals} × {match.teamBGoals}
                                        </span>
                                        <ChevronDown size={16} className={`text-slate-400 transition-transform ${isMatchOpen ? "rotate-180" : ""}`} />
                                    </div>
                                </button>

                                {/* Player bets */}
                                {isMatchOpen && (
                                    <div className="border-t border-slate-100 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/50">
                                        {match.userBets.map((userBet) => {
                                            const userKey    = `${match.matchId}:${userBet.userId}`;
                                            const isUserOpen = expandedUser === userKey;
                                            const isMe       = userBet.userId === myUserId;
                                            const expandable = true;

                                            return (
                                                <div key={userBet.userId}>
                                                    <div
                                                        role={expandable ? "button" : undefined}
                                                        tabIndex={expandable ? 0 : undefined}
                                                        onClick={expandable ? () => setExpandedUser(isUserOpen ? null : userKey) : undefined}
                                                        onKeyDown={expandable ? (e) => e.key === "Enter" && setExpandedUser(isUserOpen ? null : userKey) : undefined}
                                                        className={[
                                                            "flex items-center gap-3 px-4 py-3",
                                                            isMe ? "bg-slate-50/50 dark:bg-slate-800/30" : "",
                                                            expandable ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors" : "",
                                                        ].filter(Boolean).join(" ")}>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                                                                {userBet.userName}
                                                                {isMe && <span className="text-xs font-normal text-slate-400 ml-1">(você)</span>}
                                                            </p>
                                                            <p className="text-xs text-slate-400 mt-0.5">
                                                                {new Date(userBet.placedAt).toLocaleDateString("pt-BR", {
                                                                    day: "2-digit", month: "short",
                                                                    hour: "2-digit", minute: "2-digit",
                                                                })}
                                                            </p>
                                                        </div>
                                                        <div className="text-right shrink-0 mr-1">
                                                            <div className={`flex items-center gap-1 font-bold text-sm ${fichasColor(userBet.betEarnings)}`}>
                                                                {userBet.betEarnings > 0
                                                                    ? <TrendingUp  size={13} />
                                                                    : userBet.betEarnings < 0
                                                                        ? <TrendingDown size={13} />
                                                                        : <Minus size={13} />}
                                                                {userBet.betEarnings > 0 ? "+" : ""}{userBet.betEarnings}
                                                            </div>
                                                            <p className="text-xs text-slate-400">
                                                                Total +{userBet.totalForMatch}
                                                            </p>
                                                        </div>
                                                        {expandable && (
                                                            <ChevronDown size={14} className={`text-slate-400 transition-transform shrink-0 ${isUserOpen ? "rotate-180" : ""}`} />
                                                        )}
                                                    </div>

                                                    {expandable && isUserOpen && (
                                                        <div className="bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-700/50 divide-y divide-slate-100 dark:divide-slate-700/30">
                                                            {userBet.selections.map((sel) => (
                                                                <div key={sel.id} className="flex items-start gap-3 px-5 py-2.5">
                                                                    <div className="mt-0.5 w-4 flex justify-center shrink-0">
                                                                        {resultIcon(sel.isCorrect, sel.isPartialCredit)}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                                            {CATEGORY_LABELS[sel.category as BetCategory] ?? sel.category}
                                                                        </p>
                                                                        <p className="text-xs text-slate-400 mt-0.5">
                                                                            Previsto:{" "}
                                                                            <span className="font-medium text-slate-600 dark:text-slate-300">
                                                                                {formatValue(sel.category, sel.predictedValue)}
                                                                            </span>
                                                                            {sel.actualValue && (
                                                                                <>
                                                                                    {" "}· Real:{" "}
                                                                                    <span className="font-medium text-slate-600 dark:text-slate-300">
                                                                                        {formatValue(sel.category, sel.actualValue)}
                                                                                    </span>
                                                                                </>
                                                                            )}
                                                                        </p>
                                                                    </div>
                                                                    <div className="text-right shrink-0">
                                                                        <p className="text-xs text-slate-400">{sel.fichasWagered} BC</p>
                                                                        <p className={`text-xs font-bold ${fichasColor(sel.fichasEarned)}`}>
                                                                            {sel.fichasEarned != null
                                                                                ? (sel.fichasEarned > 0 ? "+" : "") + sel.fichasEarned
                                                                                : "–"}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {/* Base reward row */}
                                                            <div className="flex items-center justify-between px-5 py-2 bg-white/50 dark:bg-slate-900/20">
                                                                <span className="text-xs text-slate-400">Base por participação</span>
                                                                <span className="text-xs font-bold text-emerald-500">+{userBet.baseReward}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="flex justify-center pt-1">
                <button type="button" onClick={load}
                    className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <RefreshCw size={12} /> Atualizar
                </button>
            </div>
        </div>
    );
}

// ── Tab: Ranking ──────────────────────────────────────────────────────────────

function RankingTab({ groupId }: { groupId: string }) {
    const [leaderboard, setLeaderboard] = useState<BetLeaderboardEntryDto[]>([]);
    const [loading, setLoading] = useState(true);
    const myUserId = useAccountStore(
        (s) => s.accounts.find((a) => a.userId === s.activeAccountId)?.userId
    );

    async function load() {
        setLoading(true);
        try {
            const res = await BetApi.getLeaderboard(groupId);
            setLeaderboard((res.data as any) as BetLeaderboardEntryDto[]);
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao carregar ranking."));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, [groupId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 size={28} className="animate-spin text-slate-400" />
            </div>
        );
    }

    if (leaderboard.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400">
                <Trophy size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Nenhum resultado ainda</p>
                <p className="text-xs mt-1 opacity-60">O ranking aparece após a primeira partida finalizada.</p>
            </div>
        );
    }

    const medalColors = ["text-amber-400", "text-slate-400", "text-orange-600"];
    const myEntry = leaderboard.find((e) => e.userId === myUserId);

    return (
        <div className="space-y-5">
            {myEntry && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Seu saldo</p>
                        <div className={`flex items-center gap-1.5 font-black text-xl mt-0.5 ${fichasColor(myEntry.balance)}`}>
                            <Coins size={16} className="text-amber-400" />
                            {myEntry.balance > 0 ? "+" : ""}{myEntry.balance.toLocaleString()}
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Posição</p>
                        <p className="text-xl font-black text-slate-800 dark:text-slate-100 mt-0.5">
                            {myEntry.rank <= 3
                                ? ["🥇", "🥈", "🥉"][myEntry.rank - 1]
                                : `${myEntry.rank}º`}
                        </p>
                    </div>
                </div>
            )}

            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700/50">
                {leaderboard.map((entry) => {
                    const isMe     = entry.userId === myUserId;
                    const medalCls = entry.rank <= 3 ? medalColors[entry.rank - 1] : "text-slate-500";
                    return (
                        <div key={entry.userId}
                            className={`flex items-center gap-3 px-4 py-3 ${isMe ? "bg-slate-50 dark:bg-slate-800/50" : ""}`}>
                            <span className={`text-sm font-black w-6 text-center ${medalCls}`}>
                                {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : `${entry.rank}º`}
                            </span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                                    {entry.userName}
                                    {isMe && <span className="text-xs font-normal text-slate-400 ml-1">(você)</span>}
                                </p>
                                <p className="text-xs text-slate-400">
                                    {entry.totalBets} aposta{entry.totalBets !== 1 ? "s" : ""} · {entry.totalCorrect} acerto{entry.totalCorrect !== 1 ? "s" : ""}
                                </p>
                            </div>
                            <div className={`flex items-center gap-1 font-bold text-sm ${fichasColor(entry.balance)}`}>
                                <Coins size={12} className="text-amber-400" />
                                {entry.balance > 0 ? "+" : ""}{entry.balance.toLocaleString()}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex justify-center pt-1">
                <button type="button" onClick={load}
                    className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <RefreshCw size={12} /> Atualizar
                </button>
            </div>
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type TabId = "atual" | "historico" | "ranking";

export default function BetPage() {
    const groupId = useAccountStore((s) => s.getActive()?.activeGroupId);
    const [tab, setTab] = useState<TabId>("atual");

    const tabs: { id: TabId; label: string; icon: ReactNode }[] = [
        { id: "atual",     label: "Aposta Atual", icon: <Target  size={15} /> },
        { id: "historico", label: "Histórico",    icon: <History size={15} /> },
        { id: "ranking",   label: "Ranking",      icon: <Trophy  size={15} /> },
    ];

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="relative rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-900 text-white px-6 py-6 overflow-hidden shadow-lg">
                <div className="absolute inset-0 pointer-events-none opacity-[0.05]"
                    style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
                <div className="relative flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                        <Coins size={26} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black leading-tight">Bet</h1>
                    </div>
                </div>
            </div>

            {!groupId ? (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400">
                    <Coins size={36} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Selecione um grupo no Dashboard.</p>
                </div>
            ) : (
                <>
                    {/* Tab bar */}
                    <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
                        {tabs.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTab(t.id)}
                                className={[
                                    "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px",
                                    tab === t.id
                                        ? "border-slate-900 dark:border-white text-slate-900 dark:text-white"
                                        : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                                ].join(" ")}>
                                {t.icon}
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {tab === "atual"     && <CurrentBetTab groupId={groupId} />}
                    {tab === "historico" && <HistoryTab    groupId={groupId} />}
                    {tab === "ranking"   && <RankingTab    groupId={groupId} />}
                </>
            )}
        </div>
    );
}
