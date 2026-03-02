import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PlayerInMatchDto, PlayerWeightDto, TeamOptionDto } from "../matchTypes";
import { cls, fmtWeight } from "../matchUtils";

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
}) {
    const safeIdx = Math.max(0, Math.min(selectedIndex, options.length - 1));
    const opt = options[safeIdx];

    const aHex = normalizeHex(teamAHex ?? "");
    const bHex = normalizeHex(teamBHex ?? "");
    const aName = teamAName || "Time A";
    const bName = teamBName || "Time B";
    const aHasColor = (teamAHex ?? "").trim().length > 0;
    const bHasColor = (teamBHex ?? "").trim().length > 0;

    const renderTeam = (hex: string, name: string, hasColor: boolean, list: PlayerWeightDto[]) => {
        const white = isWhiteHex(hex);
        return (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {/* Team header */}
                <div
                    className="flex items-center justify-between px-3 py-2.5"
                    style={
                        hasColor
                            ? { backgroundColor: hex + "18", borderBottom: `2px solid ${hex}` }
                            : { borderBottom: "2px solid #e2e8f0" }
                    }
                >
                    <div className="flex items-center gap-1.5">
                        {hasColor && (
                            <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{
                                    backgroundColor: hex,
                                    outline: white ? "1px solid #cbd5e1" : "none",
                                    outlineOffset: "1px",
                                }}
                            />
                        )}
                        <span
                            className="text-sm font-semibold"
                            style={{ color: hasColor && !white ? hex : "#0f172a" }}
                        >
                            {name}
                        </span>
                    </div>
                    <span className="text-xs text-slate-400">{list.length}j</span>
                </div>

                {/* Player list */}
                <ul className="divide-y divide-slate-50">
                    {list.map((x) => {
                        const player = byPlayerId.get(x.playerId);
                        const playerName = player?.playerName ?? x.playerId;
                        const isGk = !!player?.isGoalkeeper;
                        return (
                            <li key={x.playerId} className="flex items-center gap-2.5 px-3 py-2">
                                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center shrink-0">
                                    {playerName.charAt(0).toUpperCase()}
                                </span>
                                <span className="truncate flex-1 text-sm font-medium text-slate-900">
                                    {playerName}
                                    {isGk && (
                                        <span title="Goleiro" className="ml-1 text-xs">
                                            🧤
                                        </span>
                                    )}
                                </span>
                                {adminView && (
                                    <span className="text-xs font-mono text-slate-400 shrink-0">
                                        {fmtWeight(x.weight)}
                                    </span>
                                )}
                            </li>
                        );
                    })}
                    {list.length === 0 && (
                        <li className="px-3 py-3 text-xs text-slate-400">Nenhum jogador</li>
                    )}
                </ul>
            </div>
        );
    };

    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
                <div>
                    <div className="font-semibold text-slate-900 text-sm">Opções geradas</div>
                    <div className="text-xs text-slate-500">
                        {adminView
                            ? "Pesos são EffectiveWinRate."
                            : "Aguardando opção escolhida pelo admin."}
                    </div>
                </div>

                {/* Pagination controls */}
                <div className="flex items-center gap-1.5">
                    <button
                        disabled={safeIdx <= 0}
                        onClick={() => onSelect(safeIdx - 1)}
                        className={cls(
                            "w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors",
                            safeIdx <= 0 && "opacity-40 pointer-events-none"
                        )}
                    >
                        <ChevronLeft size={15} />
                    </button>
                    <span className="text-xs font-semibold text-slate-700 min-w-[44px] text-center tabular-nums">
                        {safeIdx + 1} / {options.length}
                    </span>
                    <button
                        disabled={safeIdx >= options.length - 1}
                        onClick={() => onSelect(safeIdx + 1)}
                        className={cls(
                            "w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors",
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
                                    ? "w-5 h-2 bg-slate-800"
                                    : "w-2 h-2 bg-slate-300 hover:bg-slate-400"
                            )}
                        />
                    ))}
                </div>

                {/* Admin balance metrics — compact single row */}
                {adminView && (
                    <div className="flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden text-xs divide-x divide-slate-100">
                        <div className="flex-1 px-3 py-2">
                            <div className="text-slate-400 mb-0.5">A weight</div>
                            <div className="font-semibold text-slate-900 tabular-nums">
                                {fmtWeight(opt.teamAWeight)}
                            </div>
                        </div>
                        <div className="flex-1 px-3 py-2">
                            <div className="text-slate-400 mb-0.5">B weight</div>
                            <div className="font-semibold text-slate-900 tabular-nums">
                                {fmtWeight(opt.teamBWeight)}
                            </div>
                        </div>
                        <div className="flex-1 px-3 py-2">
                            <div className="text-slate-400 mb-0.5">Diff</div>
                            <div
                                className="font-semibold tabular-nums"
                                style={{ color: diffColor(opt.balanceDiff) }}
                            >
                                {fmtWeight(opt.balanceDiff)}
                            </div>
                        </div>
                        <div className="flex-1 px-3 py-2">
                            <div className="text-slate-400 mb-0.5">GK diff</div>
                            <div className="font-semibold text-slate-900 tabular-nums">
                                {opt.goalkeeperDiff ?? 0}
                            </div>
                        </div>
                    </div>
                )}

                {/* Team panels */}
                <div className="grid md:grid-cols-2 gap-3">
                    {renderTeam(aHex, aName, aHasColor, opt.teamA)}
                    {renderTeam(bHex, bName, bHasColor, opt.teamB)}
                </div>
            </div>
        </div>
    );
}
