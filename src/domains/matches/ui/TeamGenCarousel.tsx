import { useEffect, useState } from "react";
import { ArrowLeftRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { PlayerInMatchDto, PlayerWeightDto, TeamOptionDto } from "../matchTypes";
import { cls, fmtWeight } from "../matchUtils";
import { useAccountStore } from "../../../auth/accountStore";
import { useGroupIcons } from "../../../hooks/useGroupIcons";
import { IconRenderer } from "../../../components/IconRenderer";
import { resolveIcon } from "../../../lib/groupIcons";
import { HorizontalTeamField, type FieldPlayer } from "./MatchField";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeHex(v: string): string {
    const s = (v ?? "").trim();
    if (!s) return "#e2e8f0";
    return s.startsWith("#") ? s : `#${s}`;
}

function isWhiteHex(hex: string): boolean {
    const h = normalizeHex(hex).replace("#", "").toLowerCase();
    return h === "ffffff" || h === "fff";
}

/** Color-codes the balance diff: green = great, amber = ok, red = unbalanced */
function diffColor(diff: number): string {
    if (diff <= 0.05) return "#16a34a";
    if (diff <= 0.15) return "#d97706";
    return "#dc2626";
}

// ─────────────────────────────────────────────────────────────────────────────
// TeamGenCarousel
// ─────────────────────────────────────────────────────────────────────────────

export function TeamGenCarousel({
    options,
    selectedIndex,
    onSelect,
    adminView,
    byPlayerId,
    teamAHex,
    teamAName,
    teamBHex,
    teamBName,
    onMoveToTeam,
    onSwapInOption,
}: {
    options: TeamOptionDto[];
    selectedIndex: number;
    onSelect: (idx: number) => void;
    adminView: boolean;
    byPlayerId: Map<string, PlayerInMatchDto>;
    teamAHex?: string;
    teamAName?: string;
    teamBHex?: string;
    teamBName?: string;
    onMoveToTeam?: (playerId: string, team: "A" | "B") => void;
    onSwapInOption?: (playerAId: string, playerBId: string) => void;
}) {
    const _groupId = useAccountStore(s => s.getActive()?.activeGroupId);
    const _icons = useGroupIcons(_groupId);

    const safeIdx = Math.max(0, Math.min(selectedIndex, options.length - 1));
    const opt = options[safeIdx];

    const aHex = normalizeHex(teamAHex ?? "");
    const bHex = normalizeHex(teamBHex ?? "");
    const aName = teamAName || "Time A";
    const bName = teamBName || "Time B";
    const aHasColor = (teamAHex ?? "").trim().length > 0;
    const bHasColor = (teamBHex ?? "").trim().length > 0;

    // ── Selection state (move / swap) ────────────────────────────────────────
    const [showExplanation, setShowExplanation] = useState(false);
    const [sel1Id, setSel1Id] = useState<string | null>(null);
    const [sel1Team, setSel1Team] = useState<"A" | "B" | null>(null);
    const [sel2Id, setSel2Id] = useState<string | null>(null);

    // Clear selection when navigating between carousel options
    useEffect(() => {
        setSel1Id(null);
        setSel1Team(null);
        setSel2Id(null);
    }, [safeIdx]);

    function handleTeamPlayerClick(playerId: string, team: "A" | "B") {
        if (sel1Id === playerId) { setSel1Id(null); setSel1Team(null); setSel2Id(null); return; }
        if (sel2Id === playerId) { setSel2Id(null); return; }
        if (!sel1Id) { setSel1Id(playerId); setSel1Team(team); return; }
        if (sel1Team === team) { setSel1Id(playerId); setSel2Id(null); return; }
        // Different team → set as second selection
        setSel2Id(playerId);
    }

    function doCarouselSwap() {
        if (!sel1Id || !sel2Id || !onSwapInOption) return;
        onSwapInOption(sel1Id, sel2Id);
        setSel1Id(null); setSel1Team(null); setSel2Id(null);
    }

    function clearSel() { setSel1Id(null); setSel1Team(null); setSel2Id(null); }

    const canMoveToA = !!sel1Id && sel1Team === "B" && !sel2Id && !!onMoveToTeam;
    const canMoveToB = !!sel1Id && sel1Team === "A" && !sel2Id && !!onMoveToTeam;
    const canSwapNow = !!sel1Id && !!sel2Id && !!onSwapInOption;
    const aButtonColor = aHasColor && !isWhiteHex(aHex) ? aHex : "#1d4ed8";
    const bButtonColor = bHasColor && !isWhiteHex(bHex) ? bHex : "#1d4ed8";

    // ── Converts PlayerWeightDto[] → FieldPlayer[] ────────────────────────────
    const toFieldPlayers = (list: PlayerWeightDto[]): FieldPlayer[] =>
        list.map(pw => {
            const p = byPlayerId.get(pw.playerId);
            return {
                id:            pw.playerId,
                name:          p?.playerName ?? pw.playerId,
                isGoalkeeper:  !!p?.isGoalkeeper,
                attackRating:  pw.attackRatingNorm ?? null,
                defenseRating: pw.defenseRatingNorm ?? null,
            };
        });

    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900/60">
                <div className="font-semibold text-slate-900 dark:text-white text-sm flex-1">Opções geradas</div>

                {/* Pagination controls */}
                <div className="flex items-center gap-1.5">
                    <button
                        disabled={safeIdx <= 0}
                        onClick={() => onSelect(safeIdx - 1)}
                        className={cls(
                            "w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors",
                            safeIdx <= 0 && "opacity-40 pointer-events-none"
                        )}
                    >
                        <ChevronLeft size={15} />
                    </button>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 min-w-[44px] text-center tabular-nums">
                        {safeIdx + 1} / {options.length}
                    </span>
                    <button
                        disabled={safeIdx >= options.length - 1}
                        onClick={() => onSelect(safeIdx + 1)}
                        className={cls(
                            "w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors",
                            safeIdx >= options.length - 1 && "opacity-40 pointer-events-none"
                        )}
                    >
                        <ChevronRight size={15} />
                    </button>
                </div>
            </div>

            <div className="p-4 space-y-3">
                {/* Dot indicators */}
                <div className="flex items-center justify-center gap-1.5">
                    {options.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => onSelect(i)}
                            title={`Opção ${i + 1}`}
                            className={cls(
                                "rounded-full transition-all duration-200",
                                i === safeIdx
                                    ? "w-5 h-2 bg-slate-800 dark:bg-slate-300"
                                    : "w-2 h-2 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500"
                            )}
                        />
                    ))}
                </div>

                {/* Admin balance metrics — compact single row */}
                {adminView && (() => {
                    const aTC = isWhiteHex(aHex) ? "#64748b" : aHex;
                    const bTC = isWhiteHex(bHex) ? "#64748b" : bHex;
                    const higherW = opt.teamAWeight > opt.teamBWeight ? "A" : opt.teamAWeight < opt.teamBWeight ? "B" : null;
                    return (
                        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 overflow-hidden text-xs divide-x divide-slate-100 dark:divide-slate-700">
                            <div className="flex-1 px-3 py-2">
                                <div className="text-slate-400 dark:text-slate-500 mb-0.5">⚖️ Peso</div>
                                <div className="flex items-center gap-1 tabular-nums font-semibold">
                                    <span style={{ color: aTC, opacity: higherW === "B" ? 0.5 : 1 }}>{fmtWeight(opt.teamAWeight)}</span>
                                    <span className="text-slate-300 dark:text-slate-600 font-normal">/</span>
                                    <span style={{ color: bTC, opacity: higherW === "A" ? 0.5 : 1 }}>{fmtWeight(opt.teamBWeight)}</span>
                                </div>
                            </div>
                            <div className="flex-1 px-3 py-2">
                                <div className="text-slate-400 dark:text-slate-500 mb-0.5">Diff</div>
                                <div
                                    className="font-semibold tabular-nums"
                                    style={{ color: diffColor(opt.balanceDiff) }}
                                >
                                    {fmtWeight(opt.balanceDiff)}
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Dimensional rating sums — shown only when at least one player is rated */}
                {adminView && (() => {
                    const all = [...opt.teamA, ...opt.teamB];
                    const hasData = all.some(
                        p => p.attackRatingNorm != null || p.defenseRatingNorm != null || p.physicalRatingNorm != null
                    );
                    if (!hasData) return null;

                    const aTC = isWhiteHex(aHex) ? "#64748b" : aHex;
                    const bTC = isWhiteHex(bHex) ? "#64748b" : bHex;

                    const dimSum = (arr: PlayerWeightDto[], key: keyof PlayerWeightDto) =>
                        arr.reduce((s, p) => s + (((p[key] as number | null | undefined) ?? 0)), 0);

                    const dims = [
                        { label: "⚔️ Ataque",  sumA: dimSum(opt.teamA, "attackRatingNorm"),   sumB: dimSum(opt.teamB, "attackRatingNorm")   },
                        { label: "🛡️ Defesa",  sumA: dimSum(opt.teamA, "defenseRatingNorm"),  sumB: dimSum(opt.teamB, "defenseRatingNorm")  },
                        { label: "💪 Físico",  sumA: dimSum(opt.teamA, "physicalRatingNorm"), sumB: dimSum(opt.teamB, "physicalRatingNorm") },
                    ];

                    return (
                        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 overflow-hidden text-xs divide-x divide-slate-100 dark:divide-slate-700">
                            {dims.map(({ label, sumA, sumB }) => {
                                const higher = sumA > sumB ? "A" : sumA < sumB ? "B" : null;
                                return (
                                    <div key={label} className="flex-1 px-3 py-2">
                                        <div className="text-slate-400 dark:text-slate-500 mb-0.5">{label}</div>
                                        <div className="flex items-center gap-1 tabular-nums font-semibold">
                                            <span style={{ color: aTC, opacity: higher === "B" ? 0.5 : 1 }}>
                                                {sumA.toFixed(2)}
                                            </span>
                                            <span className="text-slate-300 dark:text-slate-600 font-normal">/</span>
                                            <span style={{ color: bTC, opacity: higher === "A" ? 0.5 : 1 }}>
                                                {sumB.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}

                {/* Admin explanation */}
                {adminView && opt.explanation && (
                    <div>
                        <button
                            type="button"
                            onClick={() => setShowExplanation(v => !v)}
                            className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors underline underline-offset-2"
                        >
                            {showExplanation ? 'Ocultar resumo' : 'Ver resumo'}
                        </button>
                        {showExplanation && (
                            <div className="mt-2 rounded-lg border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-900/20 p-3 space-y-1 text-xs text-slate-700 dark:text-slate-300">
                                <p><span className="font-semibold text-indigo-700 dark:text-indigo-400">Resumo: </span>{opt.explanation.resumo}</p>
                                <p><span className="font-semibold text-indigo-700 dark:text-indigo-400">Time A: </span>{opt.explanation.analiseTimeA}</p>
                                <p><span className="font-semibold text-indigo-700 dark:text-indigo-400">Time B: </span>{opt.explanation.analiseTimeB}</p>
                                <p><span className="font-semibold text-indigo-700 dark:text-indigo-400">Conclusão: </span>{opt.explanation.conclusao}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* 3-button action bar — above team panels */}
                {adminView && (onMoveToTeam || onSwapInOption) && (
                    <div className="flex items-center justify-center gap-2">
                        <button
                            disabled={!canMoveToA}
                            onClick={() => { onMoveToTeam!(sel1Id!, "A"); clearSel(); }}
                            title={`→ ${aName}`}
                            className={cls(
                                "flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold transition-all",
                                canMoveToA
                                    ? "cursor-pointer shadow-sm hover:brightness-110 active:brightness-95"
                                    : "opacity-30 cursor-not-allowed"
                            )}
                            style={{ backgroundColor: aButtonColor, color: "white" }}
                        >
                            {"<< "}{aName}
                        </button>
                        <button
                            disabled={!canSwapNow}
                            onClick={doCarouselSwap}
                            title="Trocar jogadores"
                            className={cls(
                                "flex items-center justify-center w-9 h-9 rounded-lg transition-all",
                                canSwapNow
                                    ? "cursor-pointer shadow-sm hover:brightness-110 active:brightness-95 bg-emerald-500 text-white"
                                    : "opacity-30 cursor-not-allowed bg-emerald-500 text-white"
                            )}
                        >
                            <ArrowLeftRight size={14} />
                        </button>
                        <button
                            disabled={!canMoveToB}
                            onClick={() => { onMoveToTeam!(sel1Id!, "B"); clearSel(); }}
                            title={`→ ${bName}`}
                            className={cls(
                                "flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold transition-all",
                                canMoveToB
                                    ? "cursor-pointer shadow-sm hover:brightness-110 active:brightness-95"
                                    : "opacity-30 cursor-not-allowed"
                            )}
                            style={{ backgroundColor: bButtonColor, color: "white" }}
                        >
                            {bName}{" >>"}
                        </button>
                    </div>
                )}

                {/* Team field — horizontal */}
                <div className="flex justify-center">
                    <div style={{ width: 418 }}>
                        <HorizontalTeamField
                            teamAPlayers={toFieldPlayers(opt.teamA)}
                            teamBPlayers={toFieldPlayers(opt.teamB)}
                            teamAHex={teamAHex ?? ""}
                            teamBHex={teamBHex ?? ""}
                            teamAName={aName}
                            teamBName={bName}
                            sel1Id={sel1Id}
                            sel1Team={sel1Team}
                            sel2Id={sel2Id}
                            canInteract={adminView && (!!onMoveToTeam || !!onSwapInOption)}
                            onPlayerClick={handleTeamPlayerClick}
                        />
                    </div>
                </div>

                {/* Unassigned players */}
                {(opt.unassigned?.length ?? 0) > 0 && (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2.5 border-b border-amber-100 dark:border-amber-800/40">
                            <span className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                                Não atribuídos
                            </span>
                            <span className="text-xs text-amber-600 dark:text-amber-500">{opt.unassigned.length}j</span>
                        </div>
                        <ul className="divide-y divide-amber-50 dark:divide-amber-900/30">
                            {opt.unassigned.map((x) => {
                                const player = byPlayerId.get(x.playerId);
                                const playerName = player?.playerName ?? x.playerId;
                                const isGk = !!player?.isGoalkeeper;
                                return (
                                    <li
                                        key={x.playerId}
                                        className="flex items-center gap-2 px-3 py-2"
                                    >
                                        <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                                            {playerName.charAt(0).toUpperCase()}
                                        </span>
                                        <span className="truncate flex-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                                            {playerName}
                                            <span className="ml-1 text-xs">
                                                <IconRenderer value={resolveIcon(_icons, isGk ? 'goalkeeper' : 'player')} size={13} />
                                            </span>
                                        </span>
                                        {adminView && (
                                            <span className="text-xs font-mono text-amber-600 dark:text-amber-400 shrink-0">
                                                {fmtWeight(x.weight)}
                                            </span>
                                        )}
                                        {onMoveToTeam && adminView && (
                                            <>
                                                <button
                                                    onClick={() => onMoveToTeam(x.playerId, "A")}
                                                    title={`Mover para ${aName}`}
                                                    className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg border-2 bg-white dark:bg-slate-800 transition-colors hover:brightness-95"
                                                    style={{
                                                        color: aHasColor && !isWhiteHex(aHex) ? aHex : "#1d4ed8",
                                                        borderColor: aHasColor && !isWhiteHex(aHex) ? aHex : "#3b82f6",
                                                    }}
                                                >
                                                    → A
                                                </button>
                                                <button
                                                    onClick={() => onMoveToTeam(x.playerId, "B")}
                                                    title={`Mover para ${bName}`}
                                                    className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg border-2 bg-white dark:bg-slate-800 transition-colors hover:brightness-95"
                                                    style={{
                                                        color: bHasColor && !isWhiteHex(bHex) ? bHex : "#1d4ed8",
                                                        borderColor: bHasColor && !isWhiteHex(bHex) ? bHex : "#3b82f6",
                                                    }}
                                                >
                                                    → B
                                                </button>
                                            </>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
