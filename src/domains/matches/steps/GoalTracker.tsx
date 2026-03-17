import { useState } from "react";
import { ChevronUp, ChevronDown, X } from "lucide-react";
import type { GoalDto, PlayerInMatchDto } from "../matchTypes";
import { cls } from "../matchUtils";
import { useAccountStore } from "../../../auth/accountStore";
import { useGroupIcons } from "../../../hooks/useGroupIcons";
import { IconRenderer } from "../../../components/IconRenderer";
import { resolveIcon } from "../../../lib/groupIcons";

function normalizeHex(v: string): string {
    const s = (v ?? "").trim();
    if (!s) return "";
    return s.startsWith("#") ? s : `#${s}`;
}

function isWhiteOrEmpty(hex: string): boolean {
    if (!hex) return true;
    const h = hex.replace("#", "").toLowerCase();
    return h === "ffffff" || h === "fff";
}

/** Returns a usable text/border color for a team (falls back to a neutral slate) */
function teamColor(hex: string, fallback = "#475569"): string {
    const n = normalizeHex(hex);
    return n && !isWhiteOrEmpty(n) ? n : fallback;
}

function getCurrentHHmm(): string {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
}

function incrementTime(current: string, delta: number): string {
    const parts = current.split(":");
    let h = parseInt(parts[0] ?? "0", 10);
    let m = parseInt(parts[1] ?? "0", 10);
    if (isNaN(h)) h = 0;
    if (isNaN(m)) m = 0;
    const totalMinutes = ((h * 60 + m + delta) % 1440 + 1440) % 1440;
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

export function GoalTracker({
    participants,
    goals,
    addingGoal,
    onAddGoal,
    removingGoal,
    onRemoveGoal,
    canRemove,
    teamAName,
    teamAHex,
    teamBName,
    teamBHex,
}: {
    participants: PlayerInMatchDto[];
    goals: GoalDto[];
    addingGoal: boolean;
    onAddGoal: (scorerPlayerId: string, assistPlayerId: string | null, time: string, isOwnGoal: boolean) => Promise<void>;
    removingGoal: Record<string, boolean>;
    onRemoveGoal: (goalId: string) => void;
    canRemove: boolean;
    teamAName?: string;
    teamAHex?: string;
    teamBName?: string;
    teamBHex?: string;
}) {
    const aName  = teamAName  || "Time A";
    const bName  = teamBName  || "Time B";
    const aColor = teamColor(teamAHex ?? "", "#1d4ed8");
    const bColor = teamColor(teamBHex ?? "", "#dc2626");
    const [scorerId, setScorerId] = useState<string>("");
    const [assistId, setAssistId] = useState<string | null>(null);
    const [isOwnGoal, setIsOwnGoal] = useState(false);
    const [time, setTime] = useState<string>(() => getCurrentHHmm());

    const _groupId = useAccountStore(s => s.getActive()?.activeGroupId);
    const _icons = useGroupIcons(_groupId);

    const teamA = participants.filter((p) => p.team === 1);
    const teamB = participants.filter((p) => p.team === 2);

    const scorer = participants.find((p) => p.playerId === scorerId);

    // Companheiros do mesmo time (para assistência regular) OU todos (para gol contra)
    const assistCandidates = scorer
        ? participants.filter(
              (p) => p.playerId !== scorerId && (isOwnGoal ? p.team !== scorer.team : p.team === scorer.team)
          )
        : [];

    function selectScorer(playerId: string) {
        setScorerId(playerId);
        setAssistId(null);
        setIsOwnGoal(false);
    }

    function toggleAssist(playerId: string) {
        setAssistId((prev) => (prev === playerId ? null : playerId));
    }

    function clearScorer() {
        setScorerId("");
        setAssistId(null);
        setIsOwnGoal(false);
    }

    async function confirm() {
        if (!scorerId || !time.trim()) return;
        await onAddGoal(scorerId, assistId, time.trim(), isOwnGoal);
        setScorerId("");
        setAssistId(null);
        setIsOwnGoal(false);
        // tempo não é limpo — fica para o próximo gol
    }

    function renderPlayerCard(p: PlayerInMatchDto, tColor: string) {
        const isSelected = p.playerId === scorerId;
        return (
            <button
                key={p.playerId}
                className={cls(
                    "w-full text-left rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    isSelected
                        ? "border-emerald-400 bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300"
                        : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800"
                )}
                style={isSelected ? {} : { borderLeftColor: tColor, borderLeftWidth: "3px" }}
                onClick={() => (isSelected ? clearScorer() : selectScorer(p.playerId))}
            >
                <IconRenderer value={resolveIcon(_icons, p.isGoalkeeper ? 'goalkeeper' : 'player')} size={13} />{" "}
                {p.playerName}
            </button>
        );
    }

    const noParticipants = teamA.length === 0 && teamB.length === 0;

    // Retorna o time que efetivamente "recebeu" o gol:
    // – gol normal → time do marcador
    // – gol contra → time adversário do marcador
    function effectiveTeam(g: GoalDto): number {
        const p = participants.find((px) => px.playerId === g.scorerPlayerId);
        if (!p || p.team === 0) return 0;
        return g.isOwnGoal ? (p.team === 1 ? 2 : 1) : p.team;
    }

    function renderGoalRow(g: GoalDto) {
        return (
            <div
                key={g.goalId}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            >
                <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate text-sm">
                        <IconRenderer value={resolveIcon(_icons, 'goal')} size={14} />{" "}{g.scorerName}
                        {g.isOwnGoal && (
                            <span className="ml-1 text-xs font-normal text-orange-500">
                                (C)
                            </span>
                        )}
                        {g.assistName ? (
                            <span className="text-slate-500">
                                {" "}• <IconRenderer value={resolveIcon(_icons, 'assist')} size={13} />{" "}{g.assistName}
                            </span>
                        ) : null}
                    </div>
                    <div className="text-xs text-slate-500">{g.time ?? "—"}</div>
                </div>

                {canRemove && (
                    <button
                        className={cls(
                            "flex items-center justify-center w-7 h-7 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 transition-colors shrink-0",
                            removingGoal[g.goalId] && "opacity-50 pointer-events-none"
                        )}
                        disabled={!!removingGoal[g.goalId]}
                        onClick={() => onRemoveGoal(g.goalId)}
                        title="Remover gol"
                    >
                        <X size={13} />
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
            <div className="font-semibold text-slate-900">Gols da partida</div>

            {/* ── Campo de tempo — sempre visível ─────────────────────────────── */}
            <div className="flex items-center gap-2">
                <div className="label mb-0 shrink-0">Tempo:</div>
                <input
                    className="input h-9 text-sm w-24 tabular-nums text-center"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    placeholder="21:04"
                />
                <div className="flex flex-col gap-0.5">
                    <button
                        className="flex items-center justify-center w-6 h-5 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
                        onClick={() => setTime(incrementTime(time, 1))}
                        title="+1 minuto"
                    >
                        <ChevronUp size={12} />
                    </button>
                    <button
                        className="flex items-center justify-center w-6 h-5 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
                        onClick={() => setTime(incrementTime(time, -1))}
                        title="-1 minuto"
                    >
                        <ChevronDown size={12} />
                    </button>
                </div>
            </div>

            {/* ── Jogadores por time ────────────────────────────────────────── */}
            {noParticipants ? (
                <div className="text-sm text-slate-400">
                    Sem jogadores atribuídos aos times.
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    {/* Time A */}
                    <div>
                        <div
                            className="text-xs font-semibold mb-2 uppercase tracking-widest"
                            style={{ color: aColor }}
                        >
                            {aName}
                        </div>
                        <div className="space-y-1.5">
                            {teamA.length === 0 ? (
                                <div className="text-xs text-slate-400">—</div>
                            ) : (
                                teamA.map((p) => renderPlayerCard(p, aColor))
                            )}
                        </div>
                    </div>

                    {/* Time B */}
                    <div>
                        <div
                            className="text-xs font-semibold mb-2 uppercase tracking-widest"
                            style={{ color: bColor }}
                        >
                            {bName}
                        </div>
                        <div className="space-y-1.5">
                            {teamB.length === 0 ? (
                                <div className="text-xs text-slate-400">—</div>
                            ) : (
                                teamB.map((p) => renderPlayerCard(p, bColor))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Painel de confirmação (quando scorer selecionado) ─────────── */}
            {scorer && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-3">
                    {/* Scorer selecionado */}
                    <div className="text-xs text-slate-500">Marcou o gol:</div>
                    <div className="font-semibold text-slate-900">
                        <IconRenderer value={resolveIcon(_icons, 'goal')} size={15} />{" "}{scorer.playerName}
                        {" "}<IconRenderer value={resolveIcon(_icons, scorer.isGoalkeeper ? 'goalkeeper' : 'player')} size={13} />
                    </div>

                    {/* Toggle gol contra */}
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            className="w-4 h-4 rounded accent-orange-500"
                            checked={isOwnGoal}
                            onChange={(e) => {
                                setIsOwnGoal(e.target.checked);
                                setAssistId(null);
                            }}
                        />
                        <span className="text-sm text-slate-700">Gol contra</span>
                        {isOwnGoal && (
                            <span className="text-xs text-orange-600 font-medium">
                                (ponto para o time adversário)
                            </span>
                        )}
                    </label>

                    {/* Assistência */}
                    {assistCandidates.length > 0 && (
                        <div>
                            <div className="text-xs text-slate-500 mb-1.5">
                                {isOwnGoal
                                    ? "Quem forçou o gol contra (opcional):"
                                    : "Assistência (opcional):"}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {assistCandidates.map((p) => (
                                    <button
                                        key={p.playerId}
                                        className={cls(
                                            "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                                            assistId === p.playerId
                                                ? "border-emerald-400 bg-emerald-200 text-emerald-900"
                                                : "border-slate-200 bg-white hover:bg-slate-100 text-slate-700"
                                        )}
                                        onClick={() => toggleAssist(p.playerId)}
                                    >
                                        <IconRenderer value={resolveIcon(_icons, p.isGoalkeeper ? 'goalkeeper' : 'player')} size={13} />{" "}
                                        {p.playerName}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Botões */}
                    <div className="flex items-center gap-2 pt-1">
                        <button className="btn text-sm" onClick={clearScorer}>
                            Cancelar
                        </button>
                        <button
                            className={cls(
                                "btn btn-primary text-sm",
                                (!time.trim() || addingGoal) && "opacity-50 pointer-events-none"
                            )}
                            disabled={!time.trim() || addingGoal}
                            onClick={confirm}
                        >
                            {addingGoal ? "Adicionando..." : (
                                <span className="flex items-center gap-1">
                                    {isOwnGoal ? "Adicionar gol contra" : "Adicionar gol"}
                                    {" "}<IconRenderer value={resolveIcon(_icons, 'goal')} size={14} />
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Lista de gols (agrupada pelo time que recebeu) ────────────── */}
            <div className="border-t border-slate-100 pt-3">
                {goals.length === 0 ? (
                    <div className="text-xs text-slate-400">Nenhum gol registrado.</div>
                ) : (
                    <div className="space-y-3">
                        {([1, 2] as const).map((teamNum) => {
                            const teamGoals = goals.filter(
                                (g) => effectiveTeam(g) === teamNum
                            );
                            if (teamGoals.length === 0) return null;
                            const label = teamNum === 1 ? aName : bName;
                            const color = teamNum === 1 ? aColor : bColor;
                            return (
                                <div key={teamNum}>
                                    <div
                                        className="text-xs font-semibold mb-1.5 uppercase tracking-widest"
                                        style={{ color }}
                                    >
                                        {label}
                                    </div>
                                    <div className="space-y-1.5">
                                        {teamGoals.map((g) => renderGoalRow(g))}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Gols sem time conhecido (marcador não encontrado nos participantes) */}
                        {goals.filter((g) => effectiveTeam(g) === 0).map((g) =>
                            renderGoalRow(g)
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
