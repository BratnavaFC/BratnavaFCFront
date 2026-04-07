import { Loader2, RefreshCw, StopCircle, Trophy, Zap } from "lucide-react";
import { useState } from "react";
import type { GoalDto, PlayerInMatchDto } from "../matchTypes";
import { GoalTracker } from "./GoalTracker";

export function StepPlaying({
    admin,
    onRefresh,
    onEnd,
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
    onEnd: () => void;
    onPublishEvent?: (type: 'Gol' | 'Jogada') => Promise<void>;
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
    const [publishingGol, setPublishingGol]       = useState(false);
    const [publishingJogada, setPublishingJogada] = useState(false);

    const COOLDOWN_MS = 1500;

    function handlePublish(type: 'Gol' | 'Jogada') {
        if (!onPublishEvent) return;
        if (type === 'Gol') setPublishingGol(true);
        else setPublishingJogada(true);
        onPublishEvent(type).catch(() => {});
        setTimeout(() => {
            if (type === 'Gol') setPublishingGol(false);
            else setPublishingJogada(false);
        }, COOLDOWN_MS);
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
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={onRefresh}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs transition hover:bg-slate-50 dark:hover:bg-slate-800/50 shadow-sm dark:shadow-none dark:ring-1 dark:ring-slate-700/50"
                                >
                                    <RefreshCw size={12} />
                                    Recarregar
                                </button>

                                <button
                                    className="btn flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white border-transparent"
                                    onClick={onEnd}
                                    title="Encerrar partida"
                                >
                                    <StopCircle size={14} />
                                    Encerrar
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* Botões de replay — somente admin */}
            {admin && onPublishEvent && (
                <div className="card p-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 font-medium uppercase tracking-wide">
                        Replay
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => handlePublish('Gol')}
                            disabled={publishingGol || publishingJogada}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 text-base transition"
                        >
                            {publishingGol
                                ? <Loader2 size={18} className="animate-spin" />
                                : <Trophy size={18} />}
                            GOL
                        </button>
                        <button
                            onClick={() => handlePublish('Jogada')}
                            disabled={publishingGol || publishingJogada}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 text-base transition"
                        >
                            {publishingJogada
                                ? <Loader2 size={18} className="animate-spin" />
                                : <Zap size={18} />}
                            JOGADA
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
