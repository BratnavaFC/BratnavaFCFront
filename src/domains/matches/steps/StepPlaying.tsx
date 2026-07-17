import { Loader2, RefreshCw, Trophy, Zap } from "lucide-react";
import { useState } from "react";
import type { GoalDto, PlayerInMatchDto, ReplayEventType } from "../matchTypes";
import { GoalTracker } from "./GoalTracker";
import { teamButtonStyle, teamLabel } from "../../../utils/teamColorUtils";

export function StepPlaying({
    admin,
    onRefresh,
    onPublishEvent,
    participants,
    goals,
    addingGoal,
    onAddGoal,
    removingGoal,
    onRemoveGoal,
    teamAName,
    teamAHex,
    teamBName,
    teamBHex,
}: {
    admin: boolean;
    onRefresh: () => void;
    onPublishEvent?: (type: ReplayEventType, eventTime: string) => Promise<void>;
    participants: PlayerInMatchDto[];
    goals: GoalDto[];
    addingGoal: boolean;
    onAddGoal: (scorerPlayerId: string, assistPlayerId: string | null, time: string) => Promise<void>;
    removingGoal: Record<string, boolean>;
    onRemoveGoal: (goalId: string) => void;
    teamAName?: string;
    teamAHex?: string;
    teamBName?: string;
    teamBHex?: string;
}) {
    const [publishingType, setPublishingType] = useState<ReplayEventType | null>(null);
    const teamAReplayName = teamLabel("A", { name: teamAName, hex: teamAHex });
    const teamBReplayName = teamLabel("B", { name: teamBName, hex: teamBHex });

    const COOLDOWN_MS = 1500;

    function handlePublish(type: ReplayEventType, eventTime: string) {
        if (!onPublishEvent) return;
        setPublishingType(type);
        onPublishEvent(type, eventTime).catch(() => {});
        setTimeout(() => setPublishingType(null), COOLDOWN_MS);
    }

    return (
        <div className="space-y-4">
            <div className="card overflow-hidden p-0">
                {/* Emerald accent strip */}
                <div className="h-1 w-full bg-emerald-500" />

                <div className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            {/* Pulsing live indicator */}
                            <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-900/30 shrink-0">
                                <span className="absolute inline-flex h-3.5 w-3.5 rounded-full bg-emerald-400 opacity-75 animate-ping" />
                                <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500" />
                            </div>

                            <div>
                                <div className="font-semibold text-slate-900 dark:text-white">Em Jogo</div>
                                <div className="text-xs text-slate-500">
                                    {admin
                                        ? "Partida em andamento."
                                        : "Partida em andamento (visualização)."}
                                </div>
                            </div>
                        </div>

                        {admin ? (
                            <button
                                onClick={onRefresh}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs transition hover:bg-slate-50 dark:hover:bg-slate-800/50 shadow-sm dark:shadow-none dark:ring-1 dark:ring-slate-700/50"
                            >
                                <RefreshCw size={12} />
                                Recarregar
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* Botões de replay — disponível para todos os participantes */}
            {onPublishEvent && (
                <div className="card p-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 font-medium uppercase tracking-wide">
                        Replay
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                        <button
                            onClick={() => handlePublish('GolTimeA', new Date().toISOString())}
                            disabled={publishingType !== null}
                            className="flex items-center justify-center gap-2 rounded-xl border disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 text-sm transition"
                            style={{ backgroundColor: "#059669", borderColor: "#059669", ...teamButtonStyle(teamAHex) }}
                        >
                            {publishingType === 'GolTimeA'
                                ? <Loader2 size={18} className="animate-spin" />
                                : <Trophy size={18} />}
                            Gol {teamAReplayName}
                        </button>
                        <button
                            onClick={() => handlePublish('GolTimeB', new Date().toISOString())}
                            disabled={publishingType !== null}
                            className="flex items-center justify-center gap-2 rounded-xl border disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 text-sm transition"
                            style={{ backgroundColor: "#dc2626", borderColor: "#dc2626", ...teamButtonStyle(teamBHex) }}
                        >
                            {publishingType === 'GolTimeB'
                                ? <Loader2 size={18} className="animate-spin" />
                                : <Trophy size={18} />}
                            Gol {teamBReplayName}
                        </button>
                        <button
                            onClick={() => handlePublish('Jogada', new Date().toISOString())}
                            disabled={publishingType !== null}
                            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 text-sm transition"
                        >
                            {publishingType === 'Jogada'
                                ? <Loader2 size={18} className="animate-spin" />
                                : <Zap size={18} />}
                            Jogada
                        </button>
                    </div>
                </div>
            )}

            {/* GoalTracker — visível para todos; somente admin pode remover */}
            <GoalTracker
                participants={participants}
                goals={goals}
                addingGoal={addingGoal}
                onAddGoal={onAddGoal}
                removingGoal={removingGoal}
                onRemoveGoal={onRemoveGoal}
                canRemove={admin}
                teamAName={teamAName}
                teamAHex={teamAHex}
                teamBName={teamBName}
                teamBHex={teamBHex}
            />
        </div>
    );
}
